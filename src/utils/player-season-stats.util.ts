import { resolveFootballSeason } from './football-season.util';

export type SeasonStatus = 'current_in_progress' | 'latest_completed';

export interface SeasonStatsSelection {
  seasonYear: number;
  row: any;
  status: SeasonStatus;
}

const MIN_APPEARANCES = 3;
const MIN_MINUTES = 180;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function statsEntries(row: any, leagueId?: number): any[] {
  const all = Array.isArray(row?.statistics) ? row.statistics : [];
  if (leagueId == null) return all;
  return all.filter((s: any) => s?.league?.id === leagueId);
}

export function aggregateSeasonStats(row: any, leagueId?: number): {
  appearances: number;
  minutes: number;
} {
  const entries = statsEntries(row, leagueId);
  return entries.reduce(
    (acc, entry) => {
      const games = entry?.games ?? {};
      acc.appearances += num(games.appearences ?? games.appearances);
      acc.minutes += num(games.minutes);
      return acc;
    },
    { appearances: 0, minutes: 0 },
  );
}

export function isSeasonMeaningful(row: any): boolean {
  if (!row) return false;
  const agg = aggregateSeasonStats(row);
  return agg.appearances >= MIN_APPEARANCES || agg.minutes >= MIN_MINUTES;
}

export function isUclSeasonMeaningful(row: any, leagueId = 2): boolean {
  if (!row) return false;
  const agg = aggregateSeasonStats(row, leagueId);
  return agg.appearances >= MIN_APPEARANCES || agg.minutes >= MIN_MINUTES;
}

export function seasonStatusLabel(status: SeasonStatus): string {
  return status === 'current_in_progress'
    ? 'Current season (in progress)'
    : 'Latest completed season';
}

export async function selectBestSeasonStats(
  fetchExactSeason: (year: number) => Promise<any | null>,
  primarySeason?: number,
): Promise<SeasonStatsSelection | null> {
  const current = primarySeason ?? resolveFootballSeason();
  const currentRow = await fetchExactSeason(current);

  if (currentRow && isSeasonMeaningful(currentRow)) {
    return {
      seasonYear: current,
      row: currentRow,
      status: 'current_in_progress',
    };
  }

  const previous = current - 1;
  const previousRow = await fetchExactSeason(previous);
  if (previousRow) {
    return {
      seasonYear: previous,
      row: previousRow,
      status: 'latest_completed',
    };
  }

  if (currentRow) {
    return {
      seasonYear: current,
      row: currentRow,
      status: 'current_in_progress',
    };
  }

  return null;
}

export async function selectBestUclSeasonStats(
  fetchExactUclSeason: (year: number) => Promise<any | null>,
  primarySeason?: number,
): Promise<{ seasonYear: number; stats: any; status: SeasonStatus } | null> {
  const current = primarySeason ?? resolveFootballSeason();
  const currentStats = await fetchExactUclSeason(current);

  if (currentStats && isUclSeasonMeaningful({ statistics: [currentStats] })) {
    return {
      seasonYear: current,
      stats: currentStats,
      status: 'current_in_progress',
    };
  }

  const previous = current - 1;
  const previousStats = await fetchExactUclSeason(previous);
  if (previousStats) {
    return {
      seasonYear: previous,
      stats: previousStats,
      status: 'latest_completed',
    };
  }

  if (currentStats) {
    return {
      seasonYear: current,
      stats: currentStats,
      status: 'current_in_progress',
    };
  }

  return null;
}
