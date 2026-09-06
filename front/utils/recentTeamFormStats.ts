import type { TeamFixture } from '../services/apiFootball';

export type RecentTeamFormSummary = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Oldest → newest, e.g. `WDLWW`. */
  form: string;
};

export type RecentTrend = {
  count: number;
  pct: number;
};

export type RecentTeamAverages = RecentTeamFormSummary & {
  avgGoalsFor: number | null;
  avgGoalsAgainst: number | null;
  btts: RecentTrend;
  over25: RecentTrend;
  winOrDraw: RecentTrend;
  cleanSheets: RecentTrend;
};

export type RecentFormAveragesNumbers = {
  goalsFor: number | null;
  goalsAgainst: number | null;
  xg: number | null;
  xga: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  cards: number | null;
  penaltiesScored: number | null;
  penaltiesWon: number | null;
};

export type RecentFormAveragesSide = {
  teamId: number | null;
  teamName: string;
  games: number;
  averages: RecentFormAveragesNumbers;
  trends: {
    wins: RecentTrend;
    btts: RecentTrend;
    over25: RecentTrend;
    winOrDraw: RecentTrend;
    cleanSheets: RecentTrend;
  };
};

export type RecentFormAveragesPayload = {
  last: number;
  home: RecentFormAveragesSide;
  away: RecentFormAveragesSide;
  statsGames?: number;
  statsComplete?: boolean;
};

const EMPTY_TREND: RecentTrend = { count: 0, pct: 0 };

const EMPTY: RecentTeamFormSummary = {
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  form: '',
};

const EMPTY_AVERAGES: RecentTeamAverages = {
  ...EMPTY,
  avgGoalsFor: null,
  avgGoalsAgainst: null,
  btts: EMPTY_TREND,
  over25: EMPTY_TREND,
  winOrDraw: EMPTY_TREND,
  cleanSheets: EMPTY_TREND,
};

export function teamIsHomeInFixture(
  row: TeamFixture,
  team: { id?: number | null; name?: string | null },
): boolean | null {
  const refId = team.id;
  if (refId != null) {
    if (row.teams.home.id === refId) return true;
    if (row.teams.away.id === refId) return false;
  }
  const n = (team.name ?? '').trim().toLowerCase();
  if (!n) return null;
  const homeN = row.teams.home.name.toLowerCase();
  const awayN = row.teams.away.name.toLowerCase();
  if (homeN.includes(n) || n.includes(homeN)) return true;
  if (awayN.includes(n) || n.includes(awayN)) return false;
  return null;
}

/**
 * Aggregate W/D/L and goals from recent finished fixtures.
 * Uses scores already on the form payload — no extra provider calls.
 */
export function summarizeRecentTeamForm(
  fixtures: TeamFixture[] | null | undefined,
  team: { id?: number | null; name?: string | null },
  limit = 5,
): RecentTeamFormSummary {
  const rows = (fixtures ?? []).slice(0, Math.max(1, limit));
  if (rows.length === 0) return EMPTY;

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let form = '';

  for (const row of rows) {
    const isHome = teamIsHomeInFixture(row, team);
    if (isHome == null) continue;
    const gf = isHome ? row.goals.home : row.goals.away;
    const ga = isHome ? row.goals.away : row.goals.home;
    if (gf == null || ga == null) continue;
    goalsFor += gf;
    goalsAgainst += ga;
    if (gf > ga) {
      wins += 1;
      form += 'W';
    } else if (gf < ga) {
      losses += 1;
      form += 'L';
    } else {
      draws += 1;
      form += 'D';
    }
  }

  const played = wins + draws + losses;
  if (played === 0) return EMPTY;
  return { played, wins, draws, losses, goalsFor, goalsAgainst, form };
}

export function summarizeRecentTeamAverages(
  fixtures: TeamFixture[] | null | undefined,
  team: { id?: number | null; name?: string | null },
  limit = 4,
): RecentTeamAverages {
  const base = summarizeRecentTeamForm(fixtures, team, limit);
  if (base.played === 0) return EMPTY_AVERAGES;

  let btts = 0;
  let over25 = 0;
  let winOrDraw = 0;
  let cleanSheets = 0;
  const rows = (fixtures ?? []).slice(0, Math.max(1, limit));

  for (const row of rows) {
    const isHome = teamIsHomeInFixture(row, team);
    if (isHome == null) continue;
    const gf = isHome ? row.goals.home : row.goals.away;
    const ga = isHome ? row.goals.away : row.goals.home;
    if (gf == null || ga == null) continue;
    if (gf > 0 && ga > 0) btts += 1;
    if (gf + ga > 2.5) over25 += 1;
    if (gf >= ga) winOrDraw += 1;
    if (ga === 0) cleanSheets += 1;
  }

  const played = base.played;
  const pct = (count: number): RecentTrend => ({
    count,
    pct: played > 0 ? Math.round((count / played) * 100) : 0,
  });

  return {
    ...base,
    avgGoalsFor: base.goalsFor / played,
    avgGoalsAgainst: base.goalsAgainst / played,
    btts: pct(btts),
    over25: pct(over25),
    winOrDraw: pct(winOrDraw),
    cleanSheets: pct(cleanSheets),
  };
}

export function formatStatAverage(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function formatTrendValue(trend: RecentTrend | null | undefined): string {
  if (!trend) return '—';
  return `${trend.count} (${trend.pct}%)`;
}

export function formatPenaltyPair(
  scored: number | null | undefined,
  won: number | null | undefined,
): string | null {
  if (scored == null && won == null) return null;
  return `${formatStatAverage(scored ?? 0)}/${formatStatAverage(won ?? 0)}`;
}

export function pickHighlightSide(
  home: number | null | undefined,
  away: number | null | undefined,
  mode: 'higher' | 'lower',
): 'home' | 'away' | null {
  if (home == null || away == null || !Number.isFinite(home) || !Number.isFinite(away)) {
    return null;
  }
  if (home === away) return null;
  if (mode === 'higher') return home > away ? 'home' : 'away';
  return home < away ? 'home' : 'away';
}
