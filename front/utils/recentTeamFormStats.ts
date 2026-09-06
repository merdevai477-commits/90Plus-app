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

const EMPTY: RecentTeamFormSummary = {
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  form: '',
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
