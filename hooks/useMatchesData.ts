/**
 * Custom hook for Match Listing Screen data management
 * Single API request, caching, and data grouping by league
 * 365Scores style implementation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Match } from '../components/league-center/matchCardUtils';
import { fetchMatchesByDate, fetchLiveMatches } from '../components/league-center/leagueApiUtils';
import { cacheService } from '../services/cacheService';
import { logger } from '../utils/logger';

export interface GroupedMatches {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
}

export interface UseMatchesDataResult {
  matches: Match[];
  groupedMatches: GroupedMatches[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  matchesCount: number;
  leaguesCount: number;
}

// Cache key generator
const getMatchesCacheKey = (dateString: string): string => {
  return `matches_${dateString}`;
};

// Memory cache for instant access
const memoryCache = new Map<string, { data: Match[]; timestamp: number }>();

// ✅ Throttle background refresh - track last background fetch per date
const lastBackgroundFetch = new Map<string, number>();
const BACKGROUND_REFRESH_THROTTLE = 2 * 60 * 1000; // 2 minutes minimum between background refreshes

/**
 * Groups matches by league
 */
const groupMatchesByLeague = (matches: Match[]): GroupedMatches[] => {
  const groupsMap = new Map<number, GroupedMatches>();

  matches.forEach((match) => {
    const leagueId = match.league?.id || 0;
    const leagueName = match.league?.name || 'Unknown League';
    const leagueLogo = match.league?.logo;

    if (!groupsMap.has(leagueId)) {
      groupsMap.set(leagueId, {
        leagueId,
        leagueName,
        leagueLogo,
        matches: [],
      });
    }

    groupsMap.get(leagueId)!.matches.push(match);
  });

  // Convert to array and sort matches within each league
  const groups = Array.from(groupsMap.values());
  
  // Sort matches: Live first, then by time
  groups.forEach((group) => {
    group.matches.sort((a, b) => {
      // Live matches first
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;
      
      // Then by time (upcoming/finished)
      if (a.fixtureDate && b.fixtureDate) {
        return new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime();
      }
      return 0;
    });
  });

  return groups;
};

/**
 * Custom hook for matches data with single API request and caching
 */
export const useMatchesData = (selectedDate: Date): UseMatchesDataResult => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const initialLoadRef = useRef(true);

  const dateString = useMemo(() => selectedDate.toISOString().split('T')[0], [selectedDate]);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isToday = dateString === today;
  const isPastDate = dateString < today;
  
  // Try to load from memory cache immediately on mount
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      const memoryCached = memoryCache.get(dateString);
      if (memoryCached) {
        const age = Date.now() - memoryCached.timestamp;
        const ttl = isPastDate ? 30 * 24 * 60 * 60 * 1000 : isToday ? 2 * 60 * 1000 : 60 * 60 * 1000;
        if (age < ttl) {
          setMatches(memoryCached.data);
          setLoading(false);
        }
      }
    }
  }, [dateString, isToday, isPastDate]);

  // Group matches by league
  const groupedMatches = useMemo(() => groupMatchesByLeague(matches), [matches]);

  // Calculate counts
  const matchesCount = useMemo(() => matches.length, [matches.length]);
  const leaguesCount = useMemo(() => groupedMatches.length, [groupedMatches.length]);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (isFetchingRef.current && !forceRefresh) return;
      isFetchingRef.current = true;

      setError(null);

      try {
        const cacheKey = getMatchesCacheKey(dateString);

        // Try memory cache first (instant)
        if (!forceRefresh) {
          const memoryCached = memoryCache.get(dateString);
          if (memoryCached) {
            const age = Date.now() - memoryCached.timestamp;
            const ttl = isPastDate ? 30 * 24 * 60 * 60 * 1000 : isToday ? 2 * 60 * 1000 : 60 * 60 * 1000;
            if (age < ttl) {
              logger.debug(`📦 Memory cache hit for ${dateString}`);
              setMatches(memoryCached.data);
              setLoading(false);
              
              // For past dates, don't refresh
              if (isPastDate) {
                isFetchingRef.current = false;
                return;
              }
              
              // For today/future, refresh in background
              fetchDataInBackground(dateString, isToday, isPastDate);
              isFetchingRef.current = false;
              return;
            }
          }
        }

        // Try AsyncStorage cache
        if (!forceRefresh) {
          const cached = await cacheService.get<Match[]>(cacheKey);
          if (cached && cached.length > 0) {
            logger.debug(`📦 AsyncStorage cache hit for ${dateString}`, {
              cachedCount: cached.length,
            });
            // Update memory cache first
            memoryCache.set(dateString, { data: cached, timestamp: Date.now() });
            setMatches(cached);
            setLoading(false);
            
            // For past dates, don't refresh
            if (isPastDate) {
              isFetchingRef.current = false;
              return;
            }
            
            // For today/future, refresh in background (non-blocking)
            fetchDataInBackground(dateString, isToday, isPastDate);
            isFetchingRef.current = false;
            return;
          }
        }

        // Only set loading if no cache found
        setLoading(true);

        let fetchedMatches: Match[];

        if (isToday) {
          // For today, fetch both live matches and scheduled matches
          const [liveMatches, scheduledMatches] = await Promise.all([
            fetchLiveMatches(),
            fetchMatchesByDate(selectedDate),
          ]);

          // Merge and deduplicate (live matches take priority)
          const liveMatchIds = new Set(liveMatches.map((m) => m.id));
          const uniqueScheduledMatches = scheduledMatches.filter((m) => !liveMatchIds.has(m.id));
          fetchedMatches = [...liveMatches, ...uniqueScheduledMatches];
          
          // Pre-fetch and cache upcoming 3 days in background
          preloadUpcomingDays(3);
        } else if (!isPastDate) {
          // For future dates, just fetch scheduled matches
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        } else {
          // For past dates, fetch from cache only (permanent storage)
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        }

        setMatches(fetchedMatches);

        // Update caches
        const cacheTTL = isPastDate
          ? Number.MAX_SAFE_INTEGER // Permanent cache for past matches (never expires)
          : isToday
          ? 2 * 60 * 1000 // 2 minutes for today
          : 3 * 24 * 60 * 60 * 1000; // 3 days for future

        memoryCache.set(dateString, { data: fetchedMatches, timestamp: Date.now() });
        await cacheService.set(cacheKey, fetchedMatches, cacheTTL);

        logger.debug('[useMatchesData] Fetched and set matches', {
          count: fetchedMatches.length,
          date: dateString,
          isToday,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load matches';
        setError(errorMessage);
        logger.error('Error fetching matches data:', err);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [dateString, selectedDate, isToday, isPastDate]
  );

  // Preload upcoming days in background
  const preloadUpcomingDays = useCallback(async (days: number) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const preloadPromises: Promise<void>[] = [];
      for (let i = 1; i <= days; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i);
        const futureDateStr = futureDate.toISOString().split('T')[0];
        
        // Check if already cached
        const cached = memoryCache.get(futureDateStr);
        if (!cached) {
          preloadPromises.push(
            fetchMatchesByDate(futureDate).then(matches => {
              if (matches.length > 0) {
                memoryCache.set(futureDateStr, { data: matches, timestamp: Date.now() });
                const cacheKey = getMatchesCacheKey(futureDateStr);
                cacheService.set(cacheKey, matches, 3 * 24 * 60 * 60 * 1000); // 3 days cache
              }
            }).catch(err => {
              logger.warn(`Failed to preload matches for ${futureDateStr}:`, err);
            })
          );
        }
      }
      
      // Execute in background (don't await)
      Promise.all(preloadPromises).catch(() => {});
    } catch (err) {
      logger.warn('Preload upcoming days failed:', err);
    }
  }, []);

  // Background refresh function (non-blocking)
  const fetchDataInBackground = useCallback(async (
    dateStr: string,
    isTodayFlag: boolean,
    isPastFlag: boolean
  ) => {
    if (isPastFlag) return;

    // ✅ Throttle: skip if refreshed recently
    const lastFetch = lastBackgroundFetch.get(dateStr) || 0;
    if (Date.now() - lastFetch < BACKGROUND_REFRESH_THROTTLE) {
      logger.debug(`[useMatchesData] Background refresh throttled for ${dateStr}`);
      return;
    }
    lastBackgroundFetch.set(dateStr, Date.now());

    try {
      const date = new Date(dateStr);
      let fetchedMatches: Match[];

      if (isTodayFlag) {
        const [liveMatches, scheduledMatches] = await Promise.all([
          fetchLiveMatches(),
          fetchMatchesByDate(date),
        ]);
        const liveMatchIds = new Set(liveMatches.map((m) => m.id));
        const uniqueScheduledMatches = scheduledMatches.filter((m) => !liveMatchIds.has(m.id));
        fetchedMatches = [...liveMatches, ...uniqueScheduledMatches];
      } else {
        fetchedMatches = await fetchMatchesByDate(date);
      }

      setMatches(fetchedMatches);

      const cacheTTL = isTodayFlag ? 2 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000; // 3 days for future
      const cacheKey = getMatchesCacheKey(dateStr);
      memoryCache.set(dateStr, { data: fetchedMatches, timestamp: Date.now() });
      await cacheService.set(cacheKey, fetchedMatches, cacheTTL);
    } catch (err) {
      // Silent fail for background refresh
      logger.warn('Background refresh failed:', err);
    }
  }, []);

  // ✅ FIXED: Use ref to prevent infinite loop
  // fetchData is memoized with useCallback, but we use ref for extra safety
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchDataRef.current();
  }, [dateString]); // Only re-fetch when date changes

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    matches,
    groupedMatches,
    loading,
    error,
    refetch,
    matchesCount,
    leaguesCount,
  };
};

export default useMatchesData;

