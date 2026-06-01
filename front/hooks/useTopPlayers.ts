/**
 * useTopPlayers
 *
 * React Query hook that loads the top-N players from the backend
 * `/api/reels/rankings/top-players` endpoint and exposes a stable
 * `{ players, isLoading, isError, refetch }` shape consumed by the
 * Rank screen (top 3 podium, lower leaderboard, full Top-11 modal).
 *
 * Caching is aligned with the backend response cache (5 minutes).
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';
import { logger } from '../services/logger';

export interface TopPlayer {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  isVerified: boolean;
  level: number;
  xp: number;
  /** Total lifetime XP (period XP is in `xp` for leaderboard sorting). */
  lifetimeXp?: number;
  position: string;
  /** Emoji flag from the backend (e.g. "🇪🇬"). */
  countryFlag: string;
  age: number | null;
  height: number | null;
  weight: number | null;
  preferredFoot: string | null;
  favoriteTeam: string | null;
  clubLogo: string | null;
  followersCount: number;
  stats: {
    totalViews: number;
    totalLikes: number;
    profileViews: number;
  };
  score: number;
  rank: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
}

export type TopPlayersPeriod = 'weekly' | 'monthly';

export interface UseTopPlayersOptions {
  limit?: number;
  period?: TopPlayersPeriod;
  /** Disable the query (e.g. screen not focused). */
  enabled?: boolean;
}

export interface UseTopPlayersResult {
  players: TopPlayer[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

interface TopPlayersResponse {
  status: 'SUCCESS' | 'ERROR';
  data?: {
    players: TopPlayer[];
    totalCount: number;
    period: TopPlayersPeriod;
  };
  message?: string;
}

async function fetchTopPlayers(
  limit: number,
  period: TopPlayersPeriod,
  token: string | null,
  offset = 0,
): Promise<TopPlayer[]> {
  const url = `${getApiUrl()}/reels/rankings/top-players?limit=${limit}&period=${period}&offset=${offset}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    throw new Error(`Top players request failed: ${res.status}`);
  }
  const json: TopPlayersResponse = await res.json();
  if (json.status !== 'SUCCESS' || !json.data) {
    throw new Error(json.message ?? 'Failed to load top players');
  }
  return json.data.players ?? [];
}

export function useTopPlayers(options: UseTopPlayersOptions = {}): UseTopPlayersResult {
  const { limit = 11, period = 'weekly', enabled = true } = options;
  const { getToken } = useAuth();

  const query = useQuery<TopPlayer[], Error>({
    queryKey: ['rank', 'top-players', period, limit],
    queryFn: async () => {
      try {
        const token = await getToken().catch(() => null);
        return await fetchTopPlayers(limit, period, token);
      } catch (err) {
        logger.warn('[useTopPlayers] failed to load players', err);
        throw err instanceof Error ? err : new Error('Failed to load top players');
      }
    },
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS * 2,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled,
  });

  return {
    players: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export default useTopPlayers;
