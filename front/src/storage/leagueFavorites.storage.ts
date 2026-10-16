import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../services/logger';
import { SCORES365_LEAGUE_ID_OFFSET } from '../../constants/worldCup';

const FAVORITES_META_KEY = '@league_favorites_meta_v1';

/** Offline-first followed competition / league row (365 competitionId). */
export interface StoredFollowedLeague {
  competitionId: number;
  name: string;
  logo?: string | null;
  country?: string | null;
}

/** Normalize any stored / fixture league id to a 365 competitionId. */
export function toCompetitionId(leagueOrCompetitionId: number): number {
  if (!Number.isFinite(leagueOrCompetitionId) || leagueOrCompetitionId <= 0) return 0;
  return leagueOrCompetitionId >= SCORES365_LEAGUE_ID_OFFSET
    ? leagueOrCompetitionId - SCORES365_LEAGUE_ID_OFFSET
    : leagueOrCompetitionId;
}

export function isFollowedCompetitionId(
  leagueOrCompetitionId: number,
  favoriteCompetitionIds: number[] | null | undefined,
): boolean {
  const cid = toCompetitionId(leagueOrCompetitionId);
  if (cid <= 0) return false;
  const list = favoriteCompetitionIds ?? [];
  return list.some((id) => toCompetitionId(id) === cid);
}

export function followedLeaguesEqual(
  a: StoredFollowedLeague[] | null | undefined,
  b: StoredFollowedLeague[] | null | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const x = left[i];
    const y = right[i];
    if (
      x.competitionId !== y.competitionId ||
      x.name !== y.name ||
      (x.logo ?? null) !== (y.logo ?? null) ||
      (x.country ?? null) !== (y.country ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function normalizeLeague(raw: unknown): StoredFollowedLeague | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = toCompetitionId(Number(row.competitionId ?? row.leagueId ?? row.id));
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    competitionId: id,
    name: String(row.name ?? row.leagueName ?? `Competition ${id}`),
    logo: (row.logo as string | null | undefined) ?? null,
    country: (row.country as string | null | undefined) ?? null,
  };
}

/**
 * Local store for followed competitions. IDs also live in Settings.favoriteLeagues
 * for backend sync; this file keeps display metadata for Favorites / search.
 */
export const LeagueFavoritesStorage = {
  async getLeagues(): Promise<StoredFollowedLeague[]> {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_META_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeLeague).filter(Boolean) as StoredFollowedLeague[];
    } catch (error) {
      logger.error('Error getting followed leagues:', error);
      return [];
    }
  },

  async setLeagues(leagues: StoredFollowedLeague[]): Promise<void> {
    try {
      const cleaned = leagues.map(normalizeLeague).filter(Boolean) as StoredFollowedLeague[];
      const byId = new Map<number, StoredFollowedLeague>();
      for (const row of cleaned) byId.set(row.competitionId, row);
      await AsyncStorage.setItem(FAVORITES_META_KEY, JSON.stringify([...byId.values()]));
    } catch (error) {
      logger.error('Error setting followed leagues:', error);
      throw error;
    }
  },

  async upsertLeague(league: StoredFollowedLeague): Promise<void> {
    const leagues = await this.getLeagues();
    const next = normalizeLeague(league);
    if (!next) return;
    const idx = leagues.findIndex((l) => l.competitionId === next.competitionId);
    if (idx >= 0) {
      leagues[idx] = {
        ...leagues[idx],
        name: next.name || leagues[idx].name,
        logo: next.logo ?? leagues[idx].logo,
        country: next.country ?? leagues[idx].country,
      };
    } else {
      leagues.push(next);
    }
    await this.setLeagues(leagues);
  },

  async removeLeague(competitionId: number): Promise<void> {
    const cid = toCompetitionId(competitionId);
    const leagues = await this.getLeagues();
    await this.setLeagues(leagues.filter((l) => l.competitionId !== cid));
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(FAVORITES_META_KEY);
    } catch (error) {
      logger.error('Error clearing followed leagues:', error);
      throw error;
    }
  },
};
