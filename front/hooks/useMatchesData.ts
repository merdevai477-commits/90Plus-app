/**
 * Custom hook for Match Listing Screen data management
 * Single API request, caching, and data grouping by league
 * 365Scores style implementation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Match } from '../components/Matches/matchCardUtils';
import {
  fetchMatchesByDate,
  fetchLiveMatches,
  getLocalTodayKey,
  formatLocalDateKey,
} from '../components/Matches/leagueApiUtils';
import { cacheService, MATCHES_CALENDAR_DISK_TTL_MS } from '../services/cacheService';
import { logger } from '../utils/logger';
import { websocketClient } from '../services/websocketClient';
import { useLanguageStore } from '../src/i18n/store';
import { prefetchFootballTranslations } from '../src/stores/footballTranslationStore';
import { collectNamesFromMatches } from '../utils/footballNamePrefetch';
import { getCountryFlagUri } from '../utils/countryFlagUri';
import { prefetchMatchAssets } from '../utils/prefetchMatchAssets';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import {
  LIVE_FIXTURE_CALENDAR_POLL_MS,
  MATCHES_LIST_INTEREST_CAP,
  MATCHES_LIST_KICKOFF_INTEREST_MS,
  MATCHES_LIST_OVERDUE_KICKOFF_MS,
  MATCHES_LIST_STALE_OVERDUE_CAP,
} from '../src/store/liveFixtureStore.types';
import { useRegisterLiveFixtures } from './useLiveFixture';
import { overlaySnapshotsOnCalendar } from '../utils/overlaySnapshotsOnCalendar';
import { mergeTodayCalendarWithLiveFeed } from '../utils/mergeTodayCalendarWithLiveFeed';
import { dateFromLocalKey } from '../utils/safeDate';
import { sortCountryGroupsForMatches } from '../utils/matchesCountrySort';

/** Wait after WS connect before suspending live HTTP poll (matches useLiveFixtureSync). */
const WS_TRUST_DEBOUNCE_MS = 2500;

import type { GroupedMatches, CountryGroup } from './matchesData.types';

export type { GroupedMatches, CountryGroup } from './matchesData.types';

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
  /** Pause calendar refresh when another hook owns the matches tab (e.g. WC filter). */
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

// ✅ Throttle background refresh - track last background fetch per date.
// Align with calendar poll so we don't re-download ~200KB when switching dates rapidly.
const BACKGROUND_REFRESH_THROTTLE = LIVE_FIXTURE_CALENDAR_POLL_MS;

/** Throttle logo/name prefetch so live-feed merges don't stampede the network. */
const PREFETCH_THROTTLE_MS = 30_000;
/** Live feed alone — faster than full-day calendar refresh. */
const LIVE_FEED_REFRESH_MS = 15_000;
/** When calendar rows are overdue NS, force a fresh day fetch (throttled). */
const STALE_CALENDAR_REFRESH_MS = 20_000;
let lastPrefetchAt = 0;
let lastStaleCalendarRefreshAt = 0;

function prefetchLiveMatchAssets(rows: Match[]): void {
  const live = rows.filter((m) => m.status === 'live');
  if (live.length === 0) return;
  prefetchMatchAssets(live);
}

function maybePrefetchMatchAssets(rows: Match[]): void {
  prefetchLiveMatchAssets(rows);
  const now = Date.now();
  if (now - lastPrefetchAt < PREFETCH_THROTTLE_MS) return;
  lastPrefetchAt = now;
  prefetchMatchAssets(rows);
}

async function fetchTodayMatchesWithLiveFeed(
  date: Date,
  onLiveEarly?: (liveFeed: Match[]) => void,
  options?: { fresh?: boolean },
): Promise<Match[]> {
  const byDatePromise = fetchMatchesByDate(date, options);
  const livePromise = fetchLiveMatches();

  // Paint live rows as soon as the live endpoint returns — don't wait for the
  // full day calendar (often slower) so the Live tab feels instant.
  void livePromise
    .then((liveFeed) => {
      if (liveFeed.length > 0) {
        prefetchLiveMatchAssets(liveFeed);
        onLiveEarly?.(liveFeed);
      }
    })
    .catch(() => {});

  const [byDate, liveFeed] = await Promise.all([
    byDatePromise,
    livePromise.catch(() => [] as Match[]),
  ]);
  return mergeTodayCalendarWithLiveFeed(byDate, liveFeed);
}

/**
 * Poll fixtures that are live, near kickoff, or overdue (calendar still NS after FT).
 */
function isStaleUpcomingOnCalendar(match: Match, now = Date.now()): boolean {
  if (match.status !== 'upcoming' && match.status !== 'NS' && match.status !== 'TBD') {
    return false;
  }
  if (!match.fixtureDate) return false;
  const kickoff = Date.parse(match.fixtureDate);
  if (!Number.isFinite(kickoff)) return false;
  return now - kickoff >= MATCHES_LIST_OVERDUE_KICKOFF_MS;
}

function shouldPollFixtureOnMatchesList(match: Match, now = Date.now()): boolean {
  if (match.status === 'live') return true;
  if (match.status === 'finished') return false;
  if (isStaleUpcomingOnCalendar(match, now)) return true;
  if (!match.fixtureDate) return false;
  const kickoff = new Date(match.fixtureDate).getTime();
  if (Number.isNaN(kickoff)) return false;
  const delta = kickoff - now;
  return delta <= MATCHES_LIST_KICKOFF_INTEREST_MS && delta >= 0;
}

/** All live + overdue stale + near-kickoff NS (capped). */
function pickMatchesListInterestIds(matches: Match[], cap = MATCHES_LIST_INTEREST_CAP): number[] {
  const now = Date.now();
  const live: { id: number; kickoff: number }[] = [];
  const stale: { id: number; kickoff: number }[] = [];
  const near: { id: number; kickoff: number }[] = [];

  for (const m of matches) {
    if (!shouldPollFixtureOnMatchesList(m, now)) continue;
    const id = parseInt(m.id, 10);
    if (!Number.isFinite(id) || id <= 0) continue;
    const kickoff = m.fixtureDate ? Date.parse(m.fixtureDate) : 0;
    const row = { id, kickoff: Number.isFinite(kickoff) ? kickoff : 0 };
    if (m.status === 'live') live.push(row);
    else if (isStaleUpcomingOnCalendar(m, now)) stale.push(row);
    else near.push(row);
  }

  live.sort((a, b) => a.kickoff - b.kickoff);
  stale.sort((a, b) => b.kickoff - a.kickoff);
  near.sort((a, b) => a.kickoff - b.kickoff);

  const out: number[] = [];
  const seen = new Set<number>();
  for (const row of live) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row.id);
  }
  let staleAdded = 0;
  for (const row of stale) {
    if (seen.has(row.id)) continue;
    if (staleAdded >= MATCHES_LIST_STALE_OVERDUE_CAP) break;
    seen.add(row.id);
    out.push(row.id);
    staleAdded += 1;
  }
  for (const row of near) {
    if (seen.has(row.id)) continue;
    if (out.length >= live.length + MATCHES_LIST_STALE_OVERDUE_CAP + cap) break;
    seen.add(row.id);
    out.push(row.id);
  }
  return out;
}

function listOverlaySnapshotsEqual(
  a: Record<number, LiveFixtureSnapshot>,
  b: Record<number, LiveFixtureSnapshot>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const id = Number(key);
    const sa = a[id];
    const sb = b[id];
    if (!sb || !sa) return false;
    if (sa === sb) continue;
    if (
      sa.phase !== sb.phase ||
      sa.fixture.goals.home !== sb.fixture.goals.home ||
      sa.fixture.goals.away !== sb.fixture.goals.away ||
      sa.fixture.fixture.status.elapsed !== sb.fixture.fixture.status.elapsed ||
      sa.fixture.fixture.status.extra !== sb.fixture.fixture.status.extra ||
      sa.fixture.fixture.status.short !== sb.fixture.fixture.status.short
    ) {
      return false;
    }
  }
  return true;
}

/** Stable empty map so getSnapshot never allocates a fresh {} when idle. */
const EMPTY_OVERLAY_SNAPSHOTS: Record<number, LiveFixtureSnapshot> = Object.freeze({});

/**
 * Groups matches by country, then by league within each country.
 * Pass pre-built league groups to avoid re-grouping the same match list.
 * Order: continental → top 5 → Arab (alpha) → rest (alpha).
 */
const groupMatchesByCountry = (
  matches: Match[],
  leagueGroups?: GroupedMatches[],
): CountryGroup[] => {
  const groups = leagueGroups ?? groupMatchesByLeague(matches);
  const countryMap = new Map<string, { flag: string | null; leagues: GroupedMatches[] }>();

  for (const group of groups) {
    const firstMatch = group.matches[0];
    const country = firstMatch?.league?.country || 'World';
    const flag = firstMatch?.league?.countryFlag || null;

    if (!countryMap.has(country)) {
      countryMap.set(country, { flag, leagues: [] });
    }
    countryMap.get(country)!.leagues.push(group);
  }

  const raw = Array.from(countryMap.entries()).map(([country, data]) => ({
    country,
    countryFlag: getCountryFlagUri(country, data.flag),
    leagues: data.leagues,
  }));

  return sortCountryGroupsForMatches(raw);
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
  const dateString = formatLocalDateKey(selectedDate);
  const memoryBoot = memoryCache.get(dateString);
  const [calendarMatches, setCalendarMatches] = useState<Match[]>(() => memoryBoot?.data ?? []);
  const [loading, setLoading] = useState<boolean>(() => !memoryBoot);
  const [error, setError] = useState<string | null>(null);
  // Fix ERR-3: track when background refresh fails so UI can show a stale indicator
  const [isDataStale, setIsDataStale] = useState<boolean>(false);
  const isFetchingRef = useRef(false);
  const calendarLenRef = useRef(0);
  const language = useLanguageStore((s) => s.language);
  calendarLenRef.current = calendarMatches.length;

  const today = getLocalTodayKey();
  const isToday = dateString === today;
  const isPastDate = dateString < today;

  // Interest from calendar only (before overlay) so WS updates don't widen the set.
  const pollFixtureIds = useMemo(
    () => pickMatchesListInterestIds(calendarMatches),
    [calendarMatches],
  );
  const pollIdsKey = pollFixtureIds.join(',');

  // Subscribe only to interested snapshots — avoids remapping England→Chile on every WS tick.
  // Zustand v5's useBoundStore ignores equalityFn; useStoreWithEqualityFn caches getSnapshot
  // so we don't return a fresh {} every call (React "getSnapshot should be cached" loop).
  const selectOverlaySnapshots = useCallback(
    (s: { snapshots: Record<number, LiveFixtureSnapshot> }) => {
      if (pollFixtureIds.length === 0) return EMPTY_OVERLAY_SNAPSHOTS;
      const out: Record<number, LiveFixtureSnapshot> = {};
      for (const id of pollFixtureIds) {
        const snap = s.snapshots[id];
        if (snap) out[id] = snap;
      }
      return Object.keys(out).length === 0 ? EMPTY_OVERLAY_SNAPSHOTS : out;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pollIdsKey tracks pollFixtureIds
    [pollIdsKey],
  );
  const overlaySnapshots = useStoreWithEqualityFn(
    useLiveFixtureStore,
    selectOverlaySnapshots,
    listOverlaySnapshotsEqual,
  );

  const matches = useMemo(
    () => overlaySnapshotsOnCalendar(calendarMatches, overlaySnapshots),
    [calendarMatches, overlaySnapshots],
  );
  useRegisterLiveFixtures(
    pauseBackgroundRefresh || !isToday ? [] : pollFixtureIds,
  );
  
  // Stale-while-revalidate: show disk cache immediately when date changes
  useEffect(() => {
    let cancelled = false;
    const memoryCached = memoryCache.get(dateString);
    if (memoryCached?.data?.length) {
      setCalendarMatches(memoryCached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const cacheKey = getMatchesCacheKey(dateString);
    cacheService.get<Match[]>(cacheKey, true).then((cached) => {
      if (cancelled || !cached?.length) return;
      evictOldestIfNeeded(memoryCache);
      memoryCache.set(dateString, { data: cached, timestamp: Date.now() });
      setCalendarMatches(cached);
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
      const load =
        key === todayKey
          ? fetchTodayMatchesWithLiveFeed(date)
          : fetchMatchesByDate(date);
      load.then((data) => {
        if (data.length > 0) {
          evictOldestIfNeeded(memoryCache);
          memoryCache.set(key, { data, timestamp: Date.now() });
          cacheService.set(getMatchesCacheKey(key), data, key === todayKey ? MATCHES_CALENDAR_DISK_TTL_MS : Number.MAX_SAFE_INTEGER).catch(() => {});
        }
      }).catch(() => {});
    });
  }, [pauseBackgroundRefresh]);

  // Group matches by league, then country (reuse league groups — no double group)
  const groupedMatches = useMemo(() => groupMatchesByLeague(matches), [matches]);
  const countryGroups = useMemo(
    () => groupMatchesByCountry(matches, groupedMatches),
    [matches, groupedMatches],
  );

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

        const persistCalendar = (data: Match[]) => {
          evictOldestIfNeeded(memoryCache);
          memoryCache.set(dateString, { data, timestamp: Date.now() });
          const ttl = isPastDate
            ? Number.MAX_SAFE_INTEGER
            : isToday
              ? MATCHES_CALENDAR_DISK_TTL_MS
              : 3 * 24 * 60 * 60 * 1000;
          return cacheService.set(cacheKey, data, ttl);
        };

        const refreshTodayInBackground = () => {
          void fetchTodayMatchesWithLiveFeed(
            selectedDate,
            (liveFeed) => {
              setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
              setLoading(false);
              setIsDataStale(false);
            },
            { fresh: true },
          )
            .then((merged) => {
              setCalendarMatches(merged);
              setIsDataStale(false);
              maybePrefetchMatchAssets(merged);
              return persistCalendar(merged);
            })
            .catch(() => setIsDataStale(true));
        };

        // Try memory cache first (instant) — even if TTL elapsed, paint then refresh.
        if (!forceRefresh) {
          const memoryCached = memoryCache.get(dateString);
          if (memoryCached?.data?.length) {
            logger.debug(`📦 Memory cache hit for ${dateString}`);
            setCalendarMatches(memoryCached.data);
            setLoading(false);
            maybePrefetchMatchAssets(memoryCached.data);

            if (isPastDate) {
              isFetchingRef.current = false;
              return;
            }

            if (isToday) {
              refreshTodayInBackground();
            } else {
              fetchDataInBackground(dateString, isToday, isPastDate);
            }
            isFetchingRef.current = false;
            return;
          }
        }

        // Try AsyncStorage cache (including expired snapshots)
        if (!forceRefresh) {
          const cached = await cacheService.get<Match[]>(cacheKey, true);
          if (cached && cached.length > 0) {
            logger.debug(`📦 AsyncStorage cache hit for ${dateString}`, {
              cachedCount: cached.length,
            });
            evictOldestIfNeeded(memoryCache);
            memoryCache.set(dateString, { data: cached, timestamp: Date.now() });
            setCalendarMatches(cached);
            setLoading(false);
            maybePrefetchMatchAssets(cached);

            if (isPastDate) {
              isFetchingRef.current = false;
              return;
            }

            if (isToday) {
              refreshTodayInBackground();
            } else {
              fetchDataInBackground(dateString, isToday, isPastDate);
            }
            isFetchingRef.current = false;
            return;
          }
        }

        // Only block the list on loading when we have nothing to show.
        if (calendarLenRef.current === 0) {
          setLoading(true);
        }

        let fetchedMatches: Match[];

        if (isToday) {
          fetchedMatches = await fetchTodayMatchesWithLiveFeed(selectedDate, (liveFeed) => {
            setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
            setLoading(false);
            setIsDataStale(false);
          });
        } else if (!isPastDate) {
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        } else {
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        }

        setCalendarMatches(fetchedMatches);
        setIsDataStale(false);
        maybePrefetchMatchAssets(fetchedMatches);
        await persistCalendar(fetchedMatches);

        logger.debug('[useMatchesData] Fetched and set matches', {
          count: fetchedMatches.length,
          date: dateString,
          isToday,
          elapsedMs: typeof performance !== 'undefined' && performance.now ? Math.round(performance.now()) : undefined,
        });
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : 'Failed to load matches';
        const errorMessage =
          rawMessage.toLowerCase().includes('date value out of bounds')
            ? 'Failed to load matches'
            : rawMessage;
        setCalendarMatches((prev) => {
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
      const date = dateFromLocalKey(dateStr);
      let fetchedMatches: Match[];
      fetchedMatches = isTodayFlag
        ? await fetchTodayMatchesWithLiveFeed(
            date,
            (liveFeed) => {
              setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
              setIsDataStale(false);
            },
            { fresh: true },
          )
        : await fetchMatchesByDate(date, { fresh: true });

      setCalendarMatches(fetchedMatches);
      setIsDataStale(false); // background refresh succeeded

      const cacheTTL = isTodayFlag ? MATCHES_CALENDAR_DISK_TTL_MS : 3 * 24 * 60 * 60 * 1000;
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

  /** Live-only refresh — lightweight vs full calendar (~200KB). */
  const refreshLiveFeedOnly = useCallback(async () => {
    try {
      const liveFeed = await fetchLiveMatches();
      if (liveFeed.length === 0) return;
      prefetchLiveMatchAssets(liveFeed);
      setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
      setLoading(false);
      setIsDataStale(false);
    } catch {
      /* best-effort */
    }
  }, []);

  // ✅ FIXED: Use ref to prevent infinite loop
  // fetchData is memoized with useCallback, but we use ref for extra safety
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchDataRef.current();
  }, [dateString, isToday, isPastDate]);

  // Paint live rows immediately on today — don't wait for the full-day calendar.
  useEffect(() => {
    if (pauseBackgroundRefresh || !isToday || isPastDate) return;
    let cancelled = false;
    void fetchLiveMatches().then((liveFeed) => {
      if (cancelled || liveFeed.length === 0) return;
      prefetchLiveMatchAssets(liveFeed);
      setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pauseBackgroundRefresh, isToday, isPastDate, dateString]);

  // Calendar refresh only — live scores via useLiveFixtureSync + Zustand store.
  // Pause while backgrounded; resume + silent refetch on foreground.
  useEffect(() => {
    if (pauseBackgroundRefresh || isPastDate) return;
    const intervalMs = isToday ? LIVE_FIXTURE_CALENDAR_POLL_MS : 5 * 60_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const appStateRef = { current: AppState.currentState };

    const clearPoll = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const startPoll = () => {
      if (intervalId || AppState.currentState !== 'active') return;
      intervalId = setInterval(() => {
        fetchDataInBackground(dateString, isToday, isPastDate).catch(() => {});
      }, intervalMs);
    };

    startPoll();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBg = /inactive|background/.test(appStateRef.current);
      appStateRef.current = next;
      if (next === 'active' && wasBg) {
        fetchDataInBackground(dateString, isToday, isPastDate).catch(() => {});
        startPoll();
      } else if (next !== 'active') {
        clearPoll();
      }
    });

    return () => {
      clearPoll();
      sub.remove();
    };
  }, [pauseBackgroundRefresh, dateString, isToday, isPastDate, fetchDataInBackground]);

  // Live feed poll — HTTP fallback only when WS is not stably connected.
  useEffect(() => {
    if (pauseBackgroundRefresh || !isToday || isPastDate) return;

    let wsTrusted = false;
    let trustTimer: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let wasConnected = websocketClient.isConnected();

    const clearTrustTimer = () => {
      if (trustTimer) {
        clearTimeout(trustTimer);
        trustTimer = null;
      }
    };
    const clearPoll = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const startPoll = () => {
      if (intervalId || wsTrusted) return;
      intervalId = setInterval(() => {
        if (!wsTrusted) void refreshLiveFeedOnly();
      }, LIVE_FEED_REFRESH_MS);
    };

    const unsub = websocketClient.subscribeConnectionState((connected) => {
      if (connected) {
        const isReconnect = !wasConnected;
        wasConnected = true;
        clearTrustTimer();
        if (isReconnect) {
          logger.debug('[useMatchesData] WS reconnect — silent live-feed reconcile');
          void refreshLiveFeedOnly();
        }
        trustTimer = setTimeout(() => {
          wsTrusted = true;
          clearPoll();
          logger.debug('[useMatchesData] WS trusted — suspending live-feed HTTP poll');
        }, WS_TRUST_DEBOUNCE_MS);
      } else {
        wasConnected = false;
        clearTrustTimer();
        wsTrusted = false;
        logger.debug('[useMatchesData] WS down — resuming live-feed HTTP poll');
        void refreshLiveFeedOnly();
        startPoll();
      }
    });

    // Poll until WS proves stable (including the trust-debounce window after connect).
    startPoll();

    return () => {
      unsub();
      clearTrustTimer();
      clearPoll();
    };
  }, [pauseBackgroundRefresh, isToday, isPastDate, refreshLiveFeedOnly]);

  // Calendar still shows UPCOMING after kickoff+FT window — bypass day cache.
  useEffect(() => {
    if (pauseBackgroundRefresh || !isToday || isPastDate) return;
    const hasStale = calendarMatches.some((m) => isStaleUpcomingOnCalendar(m));
    if (!hasStale) return;
    const now = Date.now();
    if (now - lastStaleCalendarRefreshAt < STALE_CALENDAR_REFRESH_MS) return;
    lastStaleCalendarRefreshAt = now;
    void fetchTodayMatchesWithLiveFeed(selectedDate, (liveFeed) => {
      setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
      setLoading(false);
    }, { fresh: true })
      .then((merged) => {
        setCalendarMatches(merged);
        setIsDataStale(false);
        evictOldestIfNeeded(memoryCache);
        memoryCache.set(dateString, { data: merged, timestamp: Date.now() });
      })
      .catch(() => undefined);
  }, [calendarMatches, pauseBackgroundRefresh, isToday, isPastDate, selectedDate, dateString]);

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

