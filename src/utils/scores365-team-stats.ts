/**
 * Map 365Scores team-level match stats (`/web/game/stats/?games=…`) into the
 * API-Football team-statistics shape used by the match-details Statistics tab.
 *
 * Corners, attacks, cards, and possession live here — they are NOT available as
 * player-level lineup stats (see scores365-player-stats.ts).
 */

export type Scores365TeamStatRow = {
  id?: number;
  name?: string;
  competitorId?: number;
  value?: string | number;
};

export type Scores365TeamStatsPayload = {
  statistics?: Scores365TeamStatRow[];
  competitors?: Array<{ id?: number; name?: string }>;
};

type TeamRef = { id: number; name: string; logo: string };

type StatRow = { type: string; value: number | string };

/** 365 team-stat `id` → API-Football statistic type label. */
const TEAM_STAT_TYPE_MAP: Record<number, string> = {
  1: 'Yellow Cards',
  2: 'Red Cards',
  3: 'Total Shots',
  4: 'Shots on Goal',
  5: 'Shots off Goal',
  6: 'Blocked Shots',
  8: 'Corner Kicks',
  9: 'Offsides',
  10: 'Ball Possession',
  11: 'Attacks',
  12: 'Fouls',
  19: 'Passes accurate',
  21: 'Total passes',
  23: 'Goalkeeper Saves',
  29: 'Substitutions',
  76: 'expected_goals',
};

/** Fallback by English name when id is missing / unknown. */
const TEAM_STAT_NAME_MAP: Record<string, string> = {
  corners: 'Corner Kicks',
  corner: 'Corner Kicks',
  possession: 'Ball Possession',
  attacks: 'Attacks',
  'shots on target': 'Shots on Goal',
  'shots off target': 'Shots off Goal',
  'shots blocked': 'Blocked Shots',
  'total shots': 'Total Shots',
  fouls: 'Fouls',
  'yellow cards': 'Yellow Cards',
  'red cards': 'Red Cards',
  offsides: 'Offsides',
  'goalkeeper saves': 'Goalkeeper Saves',
  'expected goals': 'expected_goals',
  'passes completed': 'Passes accurate',
  'total passes': 'Total passes',
  substitutions: 'Substitutions',
};

function resolveApiType(row: Scores365TeamStatRow): string | null {
  if (typeof row.id === 'number' && TEAM_STAT_TYPE_MAP[row.id]) {
    return TEAM_STAT_TYPE_MAP[row.id];
  }
  const name = (row.name ?? '').trim().toLowerCase();
  if (!name) return null;
  if (TEAM_STAT_NAME_MAP[name]) return TEAM_STAT_NAME_MAP[name];
  // Keep a useful label rather than dropping unknown major stats.
  return row.name?.trim() || null;
}

function parseValue(raw: unknown, apiType: string): number | string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return apiType === 'Ball Possession' ? `${Math.round(raw)}%` : raw;
  }
  const s = raw == null ? '' : String(raw).trim();
  if (!s) return 0;
  if (apiType === 'Ball Possession') {
    if (s.includes('%')) return s;
    const n = parseFloat(s);
    return Number.isFinite(n) ? `${Math.round(n)}%` : '0%';
  }
  if (apiType === 'expected_goals') {
    const n = parseFloat(s);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  }
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convert `/web/game/stats` JSON into API-Football-style team statistics.
 * `homeCompetitorId` / `awayCompetitorId` must already be oriented to the
 * fixture's home/away (after any 365↔API side swap).
 */
export function buildTeamStatisticsFrom365GameStats(
  payload: Scores365TeamStatsPayload | null | undefined,
  teams: { home: TeamRef; away: TeamRef },
  competitorIds: { home: number; away: number },
): unknown[] {
  const rows = Array.isArray(payload?.statistics) ? payload!.statistics! : [];
  if (!rows.length || !competitorIds.home || !competitorIds.away) return [];

  const homeMap = new Map<string, number | string>();
  const awayMap = new Map<string, number | string>();
  let matched = false;

  for (const row of rows) {
    const competitorId = row.competitorId;
    if (typeof competitorId !== 'number') continue;
    const side =
      competitorId === competitorIds.home
        ? 'home'
        : competitorId === competitorIds.away
          ? 'away'
          : null;
    if (!side) continue;
    const apiType = resolveApiType(row);
    if (!apiType) continue;
    const value = parseValue(row.value, apiType);
    const target = side === 'home' ? homeMap : awayMap;
    target.set(apiType, value);
    matched = true;
  }

  if (!matched) return [];

  const order = [
    'Ball Possession',
    'expected_goals',
    'Total Shots',
    'Shots on Goal',
    'Shots off Goal',
    'Blocked Shots',
    'Attacks',
    'Corner Kicks',
    'Fouls',
    'Offsides',
    'Total passes',
    'Passes accurate',
    'Goalkeeper Saves',
    'Yellow Cards',
    'Red Cards',
    'Substitutions',
  ];

  const homeRows: StatRow[] = [];
  const awayRows: StatRow[] = [];
  const seen = new Set<string>();

  const push = (type: string) => {
    if (seen.has(type)) return;
    if (!homeMap.has(type) && !awayMap.has(type)) return;
    seen.add(type);
    homeRows.push({ type, value: homeMap.get(type) ?? 0 });
    awayRows.push({ type, value: awayMap.get(type) ?? 0 });
  };

  for (const type of order) push(type);
  for (const type of homeMap.keys()) push(type);
  for (const type of awayMap.keys()) push(type);

  if (homeRows.length === 0) return [];

  return [
    { team: teams.home, statistics: homeRows },
    { team: teams.away, statistics: awayRows },
  ];
}
