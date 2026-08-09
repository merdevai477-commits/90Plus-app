/**
 * Full Share & Win leaderboard, paged.
 *
 * Built on React Query's `useInfiniteQuery` (already the app's data layer) so
 * request de-duplication, in-flight guarding, retry and cache lifetime come
 * from one place instead of hand-rolled flags. That covers, by construction:
 *
 *   • only one request per page key, no matter how often onEndReached fires
 *   • no concurrent pagination — `isFetchingNextPage` gates the next call
 *   • a real end-of-list, from the server's `hasMore`
 *   • pull-to-refresh that resets to page 1 without tearing the list
 *
 * Pages are offset-based because the ranking is a stable, indexed ORDER BY;
 * rows only move when the underlying standing changes, which a refresh picks
 * up wholesale.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  LEADERBOARD_PAGE_SIZE,
  fetchShareWinLeaderboard,
  type ShareWinLeaderboardEntry,
  type ShareWinLeaderboardPage,
} from '../services/shareWin.service';
import { getClerkBearerToken } from '../utils/clerkAuthToken';

export function useShareWinLeaderboard(weekKey?: string) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const query = useInfiniteQuery<ShareWinLeaderboardPage>({
    queryKey: ['share-win', 'leaderboard', weekKey ?? 'current'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) throw new Error('AUTH_REQUIRED');
      return fetchShareWinLeaderboard(token, {
        weekKey,
        limit: LEADERBOARD_PAGE_SIZE,
        offset: pageParam as number,
      });
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.entries.length : undefined,
    enabled: isLoaded === true && isSignedIn === true,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return false;
      return failureCount < 2;
    },
  });

  /**
   * Flattened rows. A Map keyed by userId guards against a row appearing twice
   * if a standing shifts between page fetches — duplicate keys in a FlatList
   * are both a warning and a rendering bug.
   */
  const entries = useMemo<ShareWinLeaderboardEntry[]>(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Map<string, ShareWinLeaderboardEntry>();
    for (const page of pages) {
      for (const entry of page.entries) {
        if (!seen.has(entry.userId)) seen.set(entry.userId, entry);
      }
    }
    return Array.from(seen.values());
  }, [query.data]);

  const firstPage = query.data?.pages?.[0];

  /**
   * Ask for the next page. Cheap to call from onEndReached — every guard that
   * matters is checked here, so the list doesn't need its own flags.
   */
  const loadMore = useCallback(() => {
    if (!query.hasNextPage) return;
    if (query.isFetchingNextPage) return;
    if (query.isRefetching) return;
    void query.fetchNextPage();
  }, [query]);

  return {
    entries,
    /** The signed-in user's own row, for pinning and highlighting. */
    me: firstPage?.me ?? null,
    cycle: firstPage?.cycle ?? null,
    total: firstPage?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    loadMore,
    refetch: query.refetch,
  };
}
