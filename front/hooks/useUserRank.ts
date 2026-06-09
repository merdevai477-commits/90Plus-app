/**
 * useUserRank
 *
 * Fetches the logged-in user's ranks across categories plus global XP rank.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';
import { canMakeAuthenticatedRequests, fetchWithClerkAuth } from '../utils/clerkAuthToken';

export interface UserRankData {
  views: number | null;
  shares: number | null;
  predictions: number | null;
  comments: number | null;
  globalXpRank: number | null;
  hasAnyRank: boolean;
}

interface UserRankResponse {
  status: 'SUCCESS' | 'ERROR';
  data?: UserRankData;
}

export function useUserRank(enabled = true) {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const query = useQuery({
    queryKey: ['rank', 'user-rank'],
    queryFn: async () => {
      const res = await fetchWithClerkAuth(getToken, `${getApiUrl()}/reels/rankings/user-rank`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res) throw new Error('Not authenticated');
      if (!res.ok) throw new Error(`User rank request failed: ${res.status}`);
      const json: UserRankResponse = await res.json();
      if (json.status !== 'SUCCESS' || !json.data) {
        throw new Error('Failed to load user rank');
      }
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: enabled && canMakeAuthenticatedRequests(isLoaded, !!isSignedIn),
  });

  return {
    rankData: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export default useUserRank;
