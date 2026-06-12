/**
 * Custom hook for Match Listing Screen data management
 * Single API request, caching, and data grouping by league
 * 365Scores style implementation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Match } from '../components/Matches/matchCardUtils';
import {
  fetchMatchesByDate,
  fetchLiveMatches,
  getLocalTodayKey,
  formatLiveMinuteDisplay,
  formatLocalDateKey,
} from '../components/Matches/leagueApiUtils';
import { cacheService } from '../services/cacheService';
import { logger } from '../utils/logger';
import { websocketClient, MatchUpdatePayload } from '../services/websocketClient';
import { useLanguageStore } from '../src/i18n/store';
import { prefetchFootballTranslations } from '../src/stores/footballTranslationStore';
import { collectNamesFromMatches } from '../utils/footballNamePrefetch';
import { getCountryFlagUri } from '../utils/countryFlagUri';
import { prefetchMatchAssets } from '../utils/prefetchMatchAssets';

export interface GroupedMatches {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
}

/** Country → Leagues → Matches hierarchy */
export interface CountryGroup {
  country: string;
  countryFlag: string | null;
  leagues: GroupedMatches[];
}

export interface UseMatchesDataResult {
  matches: Match[];
  groupedMatches: GroupedMatches[];
  countryGroups: CountryGroup[];
  loading: boolean;
  error: string | null;
  isDataStale: boolean;
  refetch: () => Promise<void>;
  matchesCount: number;
  leaguesCount: number;
}

export interface UseMatchesDataOptions {
  /** Pause background polling + WS when another hook owns live updates (e.g. WC tab). */
  pauseBackgroundRefresh?: boolean;
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
  const today = getLocalTodayKey();
  const isPast = dateString < today;
  const isToday = dateString === today;

  if (isPast) {
    return 60 * 60 * 1000; // 60 minutes for past matches
  } else if (isToday) {
    // Live scores also arrive via WebSocket; 3s memory TTL keeps polling fallback fresh.
    return 3 * 1000;
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

// ✅ Throttle background refresh - track last background fetch per date.
// 6s aligns with the 8s UI poll while preventing duplicate concurrent fetches
// when the user switches dates rapidly. Backend `/fixtures` for today is
// shared-cached for 8s, so this won't multiply API quota usage.
const BACKGROUND_REFRESH_THROTTLE = 4 * 1000; // 4 seconds

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

/** Apply a WebSocket score/minute patch to a list match row. */
const patchMatchFromWsUpdate = (match: Match, update: MatchUpdatePayload): Match => {
  let status: Match['status'] = match.status;
  if (FINISHED_STATUSES.has(update.status)) status = 'finished';
  else if (LIVE_STATUSES.has(update.status)) status = 'live';

  const elapsed = update.minute ?? match.elapsed ?? null;
  const minute =
    elapsed != null
      ? formatLiveMinuteDisplay(update.status, elapsed)
      : match.minute;

  if (
    match.score.home === update.homeScore &&
    match.score.away === update.awayScore &&
    match.status === status &&
    match.statusShort === update.status &&
    match.minute === minute &&
    match.elapsed === elapsed
  ) {
    return match;
  }

  return {
    ...match,
    score: { home: update.homeScore, away: update.awayScore },
    status,
    statusShort: update.status,
    elapsed,
    minute,
  };
};

/**
 * Country sort priority:
 * 1. England, Spain, Italy, France, Germany (top 5 leagues)
 * 2. Middle East countries (alphabetical)
 * 3. Everything else (alphabetical)
 */
const COUNTRY_PRIORITY: Record<string, number> = {
  'England': 1,
  'Spain': 2,
  'Italy': 3,
  'France': 4,
  'Germany': 5,
};

const MIDDLE_EAST_COUNTRIES = new Set([
  'Saudi-Arabia', 'Egypt', 'UAE', 'Qatar', 'Kuwait', 'Bahrain',
  'Oman', 'Jordan', 'Iraq', 'Syria', 'Lebanon', 'Palestine',
  'Yemen', 'Libya', 'Tunisia', 'Algeria', 'Morocco', 'Sudan',
  'Turkey',
]);

function getCountrySortKey(country: string): string {
  const priority = COUNTRY_PRIORITY[country];
  if (priority) return `0${priority}`; // Top 5: "01" to "05"
  if (MIDDLE_EAST_COUNTRIES.has(country)) return `1${country}`; // Middle East: "1Egypt"
  return `2${country}`; // Rest: "2Argentina"
}

/**
 * Groups matches by country, then by league within each country.
 */
const groupMatchesByCountry = (matches: Match[]): CountryGroup[] => {
  // First group by league (existing logic)
  const leagueGroups = groupMatchesByLeague(matches);

  // Then group leagues by country
  const countryMap = new Map<string, { flag: string | null; leagues: GroupedMatches[] }>();

  for (const group of leagueGroups) {
    // Get country from the first match in the group
    const firstMatch = group.matches[0];
    const country = firstMatch?.league?.country || 'World';
    const flag = firstMatch?.league?.countryFlag || null;

    if (!countryMap.has(country)) {
      countryMap.set(country, { flag, leagues: [] });
    }
    countryMap.get(country)!.leagues.push(group);
  }

  // Convert to array and sort by priority
  const result: CountryGroup[] = Array.from(countryMap.entries())
    .map(([country, data]) => ({
      country,
      countryFlag: getCountryFlagUri(country, data.flag),
      leagues: data.leagues,
    }))
    .sort((a, b) => getCountrySortKey(a.country).localeCompare(getCountrySortKey(b.country)));

  return result;
};

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
export const useMatchesData = (
  selectedDate: Date,
  options: UseMatchesDataOptions = {},
): UseMatchesDataResult => {
  const { pauseBackgroundRefresh = false } = options;
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Fix ERR-3: track when background refresh fails so UI can show a stale indicator
  const [isDataStale, setIsDataStale] = useState<boolean>(false);
  const isFetchingRef = useRef(false);
  const language = useLanguageStore((s) => s.language);

  // Use LOCAL date string (not UTC) so a user in UTC+3 at 00:30 local
  // doesn't accidentally fetch yesterday's matches.
  const dateString = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);
  const today = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);
  const isToday = dateString === today;
  const isPastDate = dateString < today;
  
  // Stale-while-revalidate: show disk cache immediately when date changes
  useEffect(() => {
    let cancelled = false;
    const memoryCached = memoryCache.get(dateString);
    if (memoryCached) {
      setMatches(memoryCached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const cacheKey = getMatchesCacheKey(dateString);
    cacheService.get<Match[]>(cacheKey).then((cached) => {
      if (cancelled || !cached?.length) return;
      evictOldestIfNeeded(memoryCache);
      memoryCache.set(dateString, { data: cached, timestamp: Date.now() });
      setMatches(cached);
      setLoading(false);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [dateString]);

  // Prefetch today + yesterday in background for instant tab switches
  useEffect(() => {
    if (pauseBackgroundRefresh) return;
    const todayKey = getLocalTodayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = formatLocalDateKey(yesterday);

    [todayKey, yesterdayKey].forEach((key) => {
      if (memoryCache.has(key)) return;
      const date = key === todayKey ? new Date() : yesterday;
      fetchMatchesByDate(date).then((data) => {
        if (data.length > 0) {
          evictOldestIfNeeded(memoryCache);
          memoryCache.set(key, { data, timestamp: Date.now() });
          cacheService.set(getMatchesCacheKey(key), data, key === todayKey ? 2 * 60 * 1000 : Number.MAX_SAFE_INTEGER).catch(() => {});
        }
      }).catch(() => {});
    });
  }, [pauseBackgroundRefresh]);

  // Group matches by league
  const groupedMatches = useMemo(() => groupMatchesByLeague(matches), [matches]);

  // Group matches by country → league hierarchy
  const countryGroups = useMemo(() => groupMatchesByCountry(matches), [matches]);

  useEffect(() => {
    if (matches.length === 0 || language !== 'ar') return;
    prefetchFootballTranslations(collectNamesFromMatches(matches), language);
  }, [matches, language]);

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
            prefetchMatchAssets(memoryCached.data);
            
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
            prefetchMatchAssets(cached);
            
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
          
          // Pre-fetching upcoming days was burning 3 API calls per launch
          // against a 100/day quota. Disabled — users can swipe to the next
          // day and we'll fetch on-demand (and cache) then.
          // preloadUpcomingDays(3);
        } else if (!isPastDate) {
          // For future dates, just fetch scheduled matches
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        } else {
          // For past dates, fetch from cache only (permanent storage)
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        }

        setMatches(fetchedMatches);
        setIsDataStale(false); // fresh data loaded successfully
        prefetchMatchAssets(fetchedMatches);

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
          elapsedMs: typeof performance !== 'undefined' && performance.now ? Math.round(performance.now()) : undefined,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load matches';
        setMatches((prev) => {
          if (prev.length > 0) {
            setIsDataStale(true);
            setError(null);
            return prev;
          }
          setError(errorMessage);
          return prev;
        });
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
        const futureDateStr = formatLocalDateKey(futureDate);
        
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

      // Today: short TTL so the disk cache doesn't override fresh polls.
      // Future: 3 days. Past dates handled by the foreground fetch.
      const cacheTTL = isTodayFlag ? 3 * 1000 : 3 * 24 * 60 * 60 * 1000;
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

  // WebSocket: patch live scores instantly; polling remains fallback
  const liveMatchIdsKey = useMemo(
    () => matches.filter((m) => m.status === 'live').map((m) => m.id).join(','),
    [matches],
  );

  useEffect(() => {
    if (pauseBackgroundRefresh || !isToday || !liveMatchIdsKey) return;

    const liveIds = liveMatchIdsKey
      .split(',')
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));

    liveIds.forEach((id) => websocketClient.subscribeToRoom(`match:${id}`));

    const unsub = websocketClient.subscribeToAllMatchUpdates((update) => {
      setMatches((prev) => {
        const idx = prev.findIndex((m) => m.id === String(update.matchId));
        if (idx === -1) return prev;
        const patched = patchMatchFromWsUpdate(prev[idx], update);
        if (patched === prev[idx]) return prev;
        const next = [...prev];
        next[idx] = patched;
        const cached = memoryCache.get(dateString);
        if (cached) {
          memoryCache.set(dateString, { data: next, timestamp: Date.now() });
        }
        return next;
      });
    });

    return () => {
      unsub();
      liveIds.forEach((id) => websocketClient.unsubscribeFromRoom(`match:${id}`));
    };
  }, [pauseBackgroundRefresh, isToday, dateString, liveMatchIdsKey]);

  // ─── Silent auto-refresh ────────────────────────────────────────────────
  // Schedule a background tick based on how "live" the current day is:
  //   - today  → every 10 s (WS handles instant updates; this is fallback)
  //   - future → every 5 minutes (fixtures rarely change last-minute)
  //   - past   → no refresh at all (permanent cache)
  //
  // The call goes through `fetchDataInBackground` which is throttled at 4s
  useEffect(() => {
    if (pauseBackgroundRefresh || isPastDate) return;
    const intervalMs = isToday ? 10_000 : 5 * 60_000;
    const id = setInterval(() => {
      fetchDataInBackground(dateString, isToday, isPastDate).catch(() => {});
    }, intervalMs);
    return () => clearInterval(id);
  }, [pauseBackgroundRefresh, dateString, isToday, isPastDate, fetchDataInBackground]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    matches,
    groupedMatches,
    countryGroups,
    loading,
    error,
    isDataStale,
    refetch,
    matchesCount,
    leaguesCount,
  };
};

export default useMatchesData;

