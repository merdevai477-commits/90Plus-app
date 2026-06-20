/**
 * Aggregate 365Scores player-level stats into API-Football team-statistics shape.
 *
 * 365Scores has no team-level statistics endpoint; instead each lineup member
 * carries a `stats` array (player-level). We sum the countable player stats into
 * per-team totals so the statistics tab can render shots/passes/fouls/etc. when
 * API-Football has no data for the fixture (e.g. World Cup on a restricted plan).
 *
 * The exact per-stat field names vary by locale, so matching is done against a
 * broad EN/AR label table with normalisation. Unmatched labels are reported once
 * via `collectUnmatched` so they can be added later.
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

/** Normalised stat label -> API-Football statistic `type`. */
const STAT_LABEL_TO_TYPE: Record<string, string> = {
  // Shots
  'total shots': 'Total Shots',
  shots: 'Total Shots',
  'اجمالي التسديدات': 'Total Shots',
  تسديدات: 'Total Shots',
  'shots on target': 'Shots on Goal',
  'shots on goal': 'Shots on Goal',
  'تسديدات على المرمى': 'Shots on Goal',
  'التسديدات على المرمى': 'Shots on Goal',
  // Passes
  passes: 'Total passes',
  'total passes': 'Total passes',
  التمريرات: 'Total passes',
  'اجمالي التمريرات': 'Total passes',
  'accurate passes': 'Passes accurate',
  'passes accurate': 'Passes accurate',
  'تمريرات صحيحة': 'Passes accurate',
  'التمريرات الصحيحة': 'Passes accurate',
  // Discipline
  fouls: 'Fouls',
  'fouls committed': 'Fouls',
  الاخطاء: 'Fouls',
  اخطاء: 'Fouls',
  'yellow cards': 'Yellow Cards',
  'بطاقات صفراء': 'Yellow Cards',
  'red cards': 'Red Cards',
  'بطاقات حمراء': 'Red Cards',
  // Set pieces / misc
  corners: 'Corner Kicks',
  'corner kicks': 'Corner Kicks',
  الركنيات: 'Corner Kicks',
  offsides: 'Offsides',
  تسلل: 'Offsides',
  saves: 'Goalkeeper Saves',
  'goalkeeper saves': 'Goalkeeper Saves',
  تصديات: 'Goalkeeper Saves',
};

function normaliseLabel(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Parse the leading numeric portion of a 365 stat value ("2", "85%", "10 (3)", "3/5"). */
function parseStatValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

function extractLabelAndValue(entry: unknown): { label: string; value: number | null } | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  const rawLabel = e.name ?? e.shortName ?? e.title ?? e.statName;
  const rawValue = e.value ?? e.val ?? e.statValue ?? e.amount;
  const label = normaliseLabel(rawLabel);
  if (!label) return null;
  return { label, value: parseStatValue(rawValue) };
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
  const totals: Record<'home' | 'away', Map<string, number>> = {
    home: new Map(),
    away: new Map(),
  };
  const unmatched = new Set<string>();
  let matchedAny = false;

  for (const player of players) {
    const side = player.side;
    if (side !== 'home' && side !== 'away') continue;
    if (!Array.isArray(player.stats)) continue;

    for (const entry of player.stats) {
      const parsed = extractLabelAndValue(entry);
      if (!parsed || parsed.value == null) continue;

      const type = STAT_LABEL_TO_TYPE[parsed.label];
      if (!type) {
        unmatched.add(parsed.label);
        continue;
      }
      matchedAny = true;
      totals[side].set(type, (totals[side].get(type) ?? 0) + parsed.value);
    }
  }

  if (!unmatchedLogged && unmatched.size > 0) {
    unmatchedLogged = true;
    logger.info(
      `[Stats365Agg] unmatched player-stat labels (add to mapping if relevant): ${[...unmatched].slice(0, 40).join(' | ')}`,
    );
  }

  if (!matchedAny) return [];

  const toRows = (side: 'home' | 'away', team: TeamRef) => ({
    team,
    statistics: [...totals[side].entries()].map(([type, value]) => ({ type, value })),
  });

  return [toRows('home', teams.home), toRows('away', teams.away)];
}
