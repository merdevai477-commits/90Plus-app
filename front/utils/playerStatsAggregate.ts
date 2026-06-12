import { WC_LEAGUE_ID } from '../constants/worldCup';

/**
 * API-Football returns one statistics row per league/competition.
 * Aggregate or pick the right row for player profile display.
 */

export interface PlayerStatRow {
  team: { id: number; name: string; logo: string };
  league: { id: number; name: string; country: string; logo: string; season: number };
  games: {
    appearences: number | null;
    lineups: number | null;
    minutes: number | null;
    position: string | null;
    rating: string | null;
    captain: boolean | null;
  };
  goals: {
    total: number | null;
    assists: number | null;
    saves: number | null;
    conceded: number | null;
  };
  cards: { yellow: number | null; red: number | null };
  passes?: { total: number | null; key: number | null; accuracy: number | null };
  shots?: { total: number | null; on: number | null };
  tackles?: { total: number | null; blocks: number | null; interceptions: number | null };
  dribbles?: { attempts: number | null; success: number | null };
  penalty?: Record<string, number | null>;
}

export function getFootballSeasonYear(date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 6 ? year : year - 1;
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

function sumField(rows: PlayerStatRow[], pick: (r: PlayerStatRow) => number | null | undefined): number {
  return rows.reduce((acc, r) => acc + num(pick(r)), 0);
}

function weightedRating(rows: PlayerStatRow[]): string | null {
  let totalMinutes = 0;
  let weighted = 0;
  for (const r of rows) {
    const minutes = num(r.games?.minutes);
    const rating = parseFloat(r.games?.rating || '');
    if (minutes > 0 && !Number.isNaN(rating)) {
      totalMinutes += minutes;
      weighted += rating * minutes;
    }
  }
  if (totalMinutes === 0) return null;
  return (weighted / totalMinutes).toFixed(2);
}

/** Pick league-specific row or aggregate all competitions for a season + team. */
export function resolvePlayerSeasonStats(
  statistics: PlayerStatRow[] | undefined,
  options?: {
    season?: number;
    leagueId?: number;
    teamId?: number;
  },
): PlayerStatRow | null {
  if (!statistics?.length) return null;

  const season = options?.season ?? getFootballSeasonYear();
  let rows = statistics.filter((s) => s.league?.season === season);

  const wcRowsResolve = statistics.filter((s) => s.league?.id === WC_LEAGUE_ID);
  for (const wc of wcRowsResolve) {
    if (!rows.some((r) => r.league?.id === WC_LEAGUE_ID)) {
      rows.push(wc);
    }
  }

  if (options?.teamId != null) {
    rows = rows.filter((s) => s.team?.id === options.teamId);
  }

  if (rows.length === 0) {
    rows = [...statistics].sort(
      (a, b) => (b.league?.season ?? 0) - (a.league?.season ?? 0),
    );
    if (options?.teamId != null) {
      rows = rows.filter((s) => s.team?.id === options.teamId);
    }
  }

  if (rows.length === 0) return statistics[0] ?? null;

  if (options?.leagueId != null) {
    const leagueRow = rows.find((s) => s.league?.id === options.leagueId);
    if (leagueRow) return leagueRow;
  }

  if (rows.length === 1) return rows[0];

  const primary = rows.reduce((best, row) =>
    num(row.games?.appearences) > num(best.games?.appearences) ? row : best,
  );

  const accuracyRows = rows.filter((r) => r.passes?.accuracy != null);
  const avgPassAccuracy =
    accuracyRows.length > 0
      ? Math.round(
          accuracyRows.reduce((s, r) => s + num(r.passes?.accuracy), 0) / accuracyRows.length,
        )
      : null;

  return {
    ...primary,
    league: {
      ...primary.league,
      name: options?.leagueId
        ? primary.league.name
        : `${primary.league.name} (+ other competitions)`,
    },
    games: {
      appearences: sumField(rows, (r) => r.games?.appearences),
      lineups: sumField(rows, (r) => r.games?.lineups),
      minutes: sumField(rows, (r) => r.games?.minutes),
      position: primary.games?.position ?? null,
      rating: weightedRating(rows),
      captain: rows.some((r) => r.games?.captain) || primary.games?.captain || null,
    },
    goals: {
      total: sumField(rows, (r) => r.goals?.total),
      assists: sumField(rows, (r) => r.goals?.assists),
      saves: sumField(rows, (r) => r.goals?.saves),
      conceded: sumField(rows, (r) => r.goals?.conceded),
    },
    cards: {
      yellow: sumField(rows, (r) => r.cards?.yellow),
      red: sumField(rows, (r) => r.cards?.red),
    },
    passes: primary.passes
      ? {
          total: sumField(rows, (r) => r.passes?.total),
          key: sumField(rows, (r) => r.passes?.key),
          accuracy: avgPassAccuracy,
        }
      : undefined,
    shots: primary.shots
      ? {
          total: sumField(rows, (r) => r.shots?.total),
          on: sumField(rows, (r) => r.shots?.on),
        }
      : undefined,
    tackles: primary.tackles
      ? {
          total: sumField(rows, (r) => r.tackles?.total),
          blocks: sumField(rows, (r) => r.tackles?.blocks),
          interceptions: sumField(rows, (r) => r.tackles?.interceptions),
        }
      : undefined,
    dribbles: primary.dribbles
      ? {
          attempts: sumField(rows, (r) => r.dribbles?.attempts),
          success: sumField(rows, (r) => r.dribbles?.success),
        }
      : undefined,
  };
}

/** Rows for one season (+ optional team), sorted by appearances. */
export function getPlayerLeagueStats(
  statistics: PlayerStatRow[] | undefined,
  options?: { season?: number; teamId?: number },
): PlayerStatRow[] {
  if (!statistics?.length) return [];

  const season = options?.season ?? getFootballSeasonYear();
  let rows = statistics.filter((s) => s.league?.season === season);

  const wcRowsList = statistics.filter((s) => s.league?.id === WC_LEAGUE_ID);
  for (const wc of wcRowsList) {
    if (!rows.some((r) => r.league?.id === WC_LEAGUE_ID)) {
      rows.push(wc);
    }
  }

  if (options?.teamId != null) {
    rows = rows.filter((s) => s.team?.id === options.teamId);
  }

  if (rows.length === 0) {
    rows = [...statistics].sort(
      (a, b) => (b.league?.season ?? 0) - (a.league?.season ?? 0),
    );
    if (options?.teamId != null) {
      rows = rows.filter((s) => s.team?.id === options.teamId);
    }
  }

  return [...rows].sort(
    (a, b) => num(b.games?.appearences) - num(a.games?.appearences),
  ).map(normalizeStatRow);
}

export function sumSeasonTotals(rows: PlayerStatRow[]) {
  return {
    appearences: sumField(rows, (r) => r.games?.appearences),
    goals: sumField(rows, (r) => r.goals?.total),
    assists: sumField(rows, (r) => r.goals?.assists),
    minutes: sumField(rows, (r) => r.games?.minutes),
    rating: weightedRating(rows),
  };
}

export function statNum(v: number | null | undefined): number {
  return num(v);
}

export function leagueLogoUrl(leagueId: number, logo?: string | null): string {
  if (logo && logo.trim() && !logo.includes('placeholder')) {
    return logo.trim();
  }
  if (leagueId > 0) {
    return `https://media.api-sports.io/football/leagues/${leagueId}.png`;
  }
  return '';
}

export function teamLogoUrl(teamId: number, logo?: string | null): string {
  if (logo && logo.trim() && !logo.includes('placeholder')) {
    return logo.trim();
  }
  if (teamId > 0) {
    return `https://media.api-sports.io/football/teams/${teamId}.png`;
  }
  return '';
}

/** Ordered photo candidates — API url first, then canonical png/jpg. */
export function playerPhotoCandidates(playerId: number, photo?: string | null): string[] {
  const urls: string[] = [];
  if (photo && photo.trim() && !photo.includes('placeholder')) {
    urls.push(photo.trim());
  }
  if (playerId > 0) {
    urls.push(`https://media.api-sports.io/football/players/${playerId}.png`);
    urls.push(`https://media.api-sports.io/football/players/${playerId}.jpg`);
  }
  return [...new Set(urls)];
}

export function playerPhotoUrl(playerId: number, photo?: string | null): string {
  return playerPhotoCandidates(playerId, photo)[0] ?? '';
}

export function normalizeStatRow(stat: PlayerStatRow): PlayerStatRow {
  return {
    ...stat,
    team: {
      ...stat.team,
      logo: teamLogoUrl(stat.team.id, stat.team.logo),
    },
    league: {
      ...stat.league,
      logo: leagueLogoUrl(stat.league.id, stat.league.logo),
    },
  };
}
