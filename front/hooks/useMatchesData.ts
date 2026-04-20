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
import { Image } from 'expo-image';

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
  isDataStale: boolean;
  refetch: () => Promise<void>;
  matchesCount: number;
  leaguesCount: number;
}

// Cache key generator
const getMatchesCacheKey = (dateString: string): string => {
  return `matches_${dateString}`;
};

// Memory cache for instant access with TTL check
interface MemoryCacheEntry {
  data: Match[];
  timestamp: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();
const lastBackgroundFetch = new Map<string, number>();

// Fix MEM-1: Evict oldest entry when cache exceeds this size
const MAX_CACHE_ENTRIES = 10;

const evictOldestIfNeeded = (map: Map<string, any>) => {
  if (map.size >= MAX_CACHE_ENTRIES) {
    // Map preserves insertion order — first key is oldest
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
};

// TTL configuration based on match date
const getCacheTTL = (dateString: string): number => {
  const today = new Date().toISOString().split('T')[0];
  const isPast = dateString < today;
  const isToday = dateString === today;
  
  if (isPast) {
    return 60 * 60 * 1000; // 60 minutes for past matches
  } else if (isToday) {
    return 2 * 60 * 1000; // 2 minutes for today's matches
  } else {
    return 30 * 60 * 1000; // 30 minutes for future matches
  }
};

// Check if cache entry is still valid
const isCacheValid = (entry: MemoryCacheEntry, dateString: string): boolean => {
  const ttl = getCacheTTL(dateString);
  const age = Date.now() - entry.timestamp;
  return age < ttl;
};

// ✅ Throttle background refresh - track last background fetch per date
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
  // Fix ERR-3: track when background refresh fails so UI can show a stale indicator
  const [isDataStale, setIsDataStale] = useState<boolean>(false);
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
      if (memoryCached && isCacheValid(memoryCached, dateString)) {
        setMatches(memoryCached.data);
        setLoading(false);
      }
    }
  }, [dateString]);

  // Group matches by league
  const groupedMatches = useMemo(() => groupMatchesByLeague(matches), [matches]);

  // Fix PERF-7: .length is O(1) — no useMemo needed
  const matchesCount = matches.length;
  const leaguesCount = groupedMatches.length;

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
          if (memoryCached && isCacheValid(memoryCached, dateString)) {
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

        // Try AsyncStorage cache
        if (!forceRefresh) {
          const cached = await cacheService.get<Match[]>(cacheKey);
          if (cached && cached.length > 0) {
            logger.debug(`📦 AsyncStorage cache hit for ${dateString}`, {
              cachedCount: cached.length,
            });
            // Update memory cache first
            evictOldestIfNeeded(memoryCache);
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

          // Fix 9: Deduplicate using Map keyed by match ID.
          // Scheduled matches inserted first, then live matches overwrite them
          // so the live version (more up-to-date status) always wins.
          const mergeMap = new Map<string, Match>();
          scheduledMatches.forEach(m => mergeMap.set(m.id, m));
          liveMatches.forEach(m => mergeMap.set(m.id, m)); // live overwrites scheduled
          fetchedMatches = Array.from(mergeMap.values());
          
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
        setIsDataStale(false); // fresh data loaded successfully

        // 🚀 Aggressive Prefetching for logos (Instant Performance Phase 1)
        try {
          const logosToPrefetch = new Set<string>();
          fetchedMatches.forEach(m => {
            if (m.homeTeam?.logo) logosToPrefetch.add(m.homeTeam.logo);
            if (m.awayTeam?.logo) logosToPrefetch.add(m.awayTeam.logo);
            if (m.league?.logo) logosToPrefetch.add(m.league.logo);
          });
          const urls = Array.from(logosToPrefetch).slice(0, 100);
          if (urls.length > 0) {
            Image.prefetch(urls, 'memory-disk').catch(() => {});
          }
        } catch (e) {
          logger.warn('Failed to prefetch logos', e);
        }

        // Update caches
        const cacheTTL = isPastDate
          ? Number.MAX_SAFE_INTEGER // Permanent cache for past matches (never expires)
          : isToday
          ? 2 * 60 * 1000 // 2 minutes for today
          : 3 * 24 * 60 * 60 * 1000; // 3 days for future

        evictOldestIfNeeded(memoryCache);
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
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      
      const preloadPromises: Promise<void>[] = [];
      for (let i = 1; i <= days; i++) {
        const futureDate = new Date(startDate);
        futureDate.setDate(startDate.getDate() + i);
        const futureDateStr = futureDate.toISOString().split('T')[0];
        
        // Check if already cached
        const cached = memoryCache.get(futureDateStr);
        if (!cached) {
          preloadPromises.push(
            fetchMatchesByDate(futureDate).then(matches => {
              if (matches.length > 0) {
                evictOldestIfNeeded(memoryCache);
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
        // Fix 9: Map-based dedup — live version overwrites scheduled
        const mergeMap = new Map<string, Match>();
        scheduledMatches.forEach(m => mergeMap.set(m.id, m));
        liveMatches.forEach(m => mergeMap.set(m.id, m));
        fetchedMatches = Array.from(mergeMap.values());
      } else {
        fetchedMatches = await fetchMatchesByDate(date);
      }

      setMatches(fetchedMatches);
      setIsDataStale(false); // background refresh succeeded

      const cacheTTL = isTodayFlag ? 2 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000; // 3 days for future
      const cacheKey = getMatchesCacheKey(dateStr);
      evictOldestIfNeeded(memoryCache);
      memoryCache.set(dateStr, { data: fetchedMatches, timestamp: Date.now() });
      evictOldestIfNeeded(lastBackgroundFetch);
      await cacheService.set(cacheKey, fetchedMatches, cacheTTL);
    } catch (err) {
      // Fix ERR-3: mark data as stale so UI can show a subtle indicator
      setIsDataStale(true);
      logger.warn('Background refresh failed:', err);
    }
  }, []);

  // ✅ FIXED: Use ref to prevent infinite loop
  // fetchData is memoized with useCallback, but we use ref for extra safety
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchDataRef.current();
  }, [dateString, isToday, isPastDate]); // Re-fetch when date changes or when isToday/isPastDate change (e.g. at midnight)

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    matches,
    groupedMatches,
    loading,
    error,
    isDataStale,
    refetch,
    matchesCount,
    leaguesCount,
  };
};

export default useMatchesData;

