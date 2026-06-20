/**
 * Aggregate 365Scores player-level stats into API-Football team-statistics shape.
 *
 * 365Scores has no team-level statistics endpoint; instead each lineup member
 * (from /web/athletes/games/lineups) carries a `stats` array keyed by a numeric
 * `type` id. We sum the countable player stats into per-team totals so the
 * statistics tab can render shots/passes/fouls/etc. when API-Football has no data
 * for the fixture (e.g. World Cup on a restricted plan).
 *
 * Ball possession is not provided by 365Scores, so it is approximated from each
 * team's share of attempted passes (a standard, close proxy).
 *
 * Matching is done by the stable numeric `type` id rather than locale-dependent
 * labels, so it works for any langId.
 */

import { logger } from './logger';

interface TeamRef {
  id: number;
  name: string;
  logo: string;
}

interface PlayerWithStats {
  side: 'home' | 'away';
  stats?: unknown[];
}

type StatRow = { type: string; value: number | string };

/** 365 stat `type` id → API-Football statistic type (simple integer sums). */
const SUM_STAT_TYPES: Record<number, string> = {
  3: 'Total Shots',
  4: 'Shots on Goal',
  5: 'Shots off Goal',
  6: 'Blocked Shots',
  9: 'Offsides',
  23: 'Goalkeeper Saves',
  42: 'Fouls',
};

/** Ratio stats "completed/attempted (pct)" — id → { completed, attempted } API types. */
const PASSES_TYPE_ID = 19; // "Passes Completed" e.g. "19/31 (61%)"
const XG_TYPE_ID = 76; // "Expected Goals" e.g. "0.05" (decimal sum)

/** Per-side accumulator. */
interface SideTotals {
  sums: Map<string, number>;
  passesCompleted: number;
  passesAttempted: number;
  xg: number;
  hasPasses: boolean;
  hasXg: boolean;
}

function emptyTotals(): SideTotals {
  return {
    sums: new Map(),
    passesCompleted: 0,
    passesAttempted: 0,
    xg: 0,
    hasPasses: false,
    hasXg: false,
  };
}

function statEntry(entry: unknown): { type: number; value: string } | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  const type = typeof e.type === 'number' ? e.type : typeof e.id === 'number' ? e.id : null;
  if (type == null) return null;
  const value = e.value ?? e.val ?? e.statValue;
  return { type, value: value == null ? '' : String(value) };
}

/** Leading integer of a value ("2", "85%", "10 (3)"). */
function parseInt0(value: string): number {
  const m = value.match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Parse "completed/attempted (pct)" → [completed, attempted]; falls back to single number. */
function parseRatio(value: string): [number, number] {
  const m = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  const single = parseInt0(value);
  return [single, single];
}

let unmatchedLogged = false;

/**
 * Build API-Football team-statistics rows from 365Scores player stats.
 * Returns [] when no countable stats are found.
 */
export function buildTeamStatisticsFrom365Players(
  players: PlayerWithStats[],
  teams: { home: TeamRef; away: TeamRef },
): unknown[] {
  const totals: Record<'home' | 'away', SideTotals> = {
    home: emptyTotals(),
    away: emptyTotals(),
  };
  const unmatched = new Map<number, string>();
  let matchedAny = false;

  for (const player of players) {
    const side = player.side;
    if (side !== 'home' && side !== 'away') continue;
    if (!Array.isArray(player.stats)) continue;
    const t = totals[side];

    for (const raw of player.stats) {
      const entry = statEntry(raw);
      if (!entry) continue;

      const sumType = SUM_STAT_TYPES[entry.type];
      if (sumType) {
        t.sums.set(sumType, (t.sums.get(sumType) ?? 0) + parseInt0(entry.value));
        matchedAny = true;
        continue;
      }

      if (entry.type === PASSES_TYPE_ID) {
        const [completed, attempted] = parseRatio(entry.value);
        t.passesCompleted += completed;
        t.passesAttempted += attempted;
        t.hasPasses = true;
        matchedAny = true;
        continue;
      }

      if (entry.type === XG_TYPE_ID) {
        const xg = parseFloat(entry.value);
        if (Number.isFinite(xg)) {
          t.xg += xg;
          t.hasXg = true;
          matchedAny = true;
        }
        continue;
      }

      if (!unmatched.has(entry.type)) {
        const name = (raw as Record<string, unknown>)?.name;
        unmatched.set(entry.type, typeof name === 'string' ? name : '');
      }
    }
  }

  if (!unmatchedLogged && unmatched.size > 0) {
    unmatchedLogged = true;
    logger.info(
      `[Stats365Agg] unmatched player-stat types (extend mapping if relevant): ${[...unmatched.entries()]
        .map(([id, name]) => `${id}:${name}`)
        .slice(0, 40)
        .join(' | ')}`,
    );
  }

  if (!matchedAny) return [];

  // Ordered output. Each builder returns null to omit a row that has no data.
  const homeT = totals.home;
  const awayT = totals.away;
  const homeRows: StatRow[] = [];
  const awayRows: StatRow[] = [];

  const pushSum = (type: string) => {
    const h = homeT.sums.get(type);
    const a = awayT.sums.get(type);
    if (h == null && a == null) return;
    homeRows.push({ type, value: h ?? 0 });
    awayRows.push({ type, value: a ?? 0 });
  };

  // Ball possession ≈ share of attempted passes (365 has no native possession).
  const totalAttempted = homeT.passesAttempted + awayT.passesAttempted;
  if (totalAttempted > 0) {
    const homePoss = Math.round((homeT.passesAttempted / totalAttempted) * 100);
    homeRows.push({ type: 'Ball Possession', value: `${homePoss}%` });
    awayRows.push({ type: 'Ball Possession', value: `${100 - homePoss}%` });
  }

  pushSum('Total Shots');
  pushSum('Shots on Goal');
  pushSum('Shots off Goal');
  pushSum('Blocked Shots');

  if (homeT.hasPasses || awayT.hasPasses) {
    homeRows.push({ type: 'Total passes', value: homeT.passesAttempted });
    awayRows.push({ type: 'Total passes', value: awayT.passesAttempted });
    homeRows.push({ type: 'Passes accurate', value: homeT.passesCompleted });
    awayRows.push({ type: 'Passes accurate', value: awayT.passesCompleted });
    const pct = (c: number, att: number) => (att > 0 ? `${Math.round((c / att) * 100)}%` : '0%');
    homeRows.push({ type: 'Passes %', value: pct(homeT.passesCompleted, homeT.passesAttempted) });
    awayRows.push({ type: 'Passes %', value: pct(awayT.passesCompleted, awayT.passesAttempted) });
  }

  pushSum('Fouls');
  pushSum('Offsides');
  pushSum('Goalkeeper Saves');

  if (homeT.hasXg || awayT.hasXg) {
    homeRows.push({ type: 'expected_goals', value: Number(homeT.xg.toFixed(2)) });
    awayRows.push({ type: 'expected_goals', value: Number(awayT.xg.toFixed(2)) });
  }

  if (homeRows.length === 0) return [];

  return [
    { team: teams.home, statistics: homeRows },
    { team: teams.away, statistics: awayRows },
  ];
}
