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
  getLocalTodayKey,
  formatLocalDateKey,
} from '../components/Matches/leagueApiUtils';
import { cacheService, MATCHES_CALENDAR_DISK_TTL_MS, MATCHES_PAST_DISK_TTL_MS } from '../services/cacheService';
import { logger } from '../utils/logger';
import { isAbortError } from '../utils/isAbortError';
import { useLanguageStore } from '../src/i18n/store';
import { prefetchFootballTranslations } from '../src/stores/footballTranslationStore';
import { collectNamesFromMatches } from '../utils/footballNamePrefetch';
import { prefetchMatchAssets } from '../utils/prefetchMatchAssets';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import {
  LIVE_FIXTURE_CALENDAR_POLL_MS,
  MATCHES_LIST_BACKGROUND_LIVE_CAP,
} from '../src/store/liveFixtureStore.types';
import { useRegisterLiveFixtures } from './useLiveFixture';
import { overlaySnapshotsOnCalendarDetailed } from '../utils/overlaySnapshotsOnCalendar';
import {
  isStaleUpcomingOnCalendar,
  pickMatchesListInterestIds,
} from '../utils/matchesListInterest';
import {
  groupMatchesByCountryIncremental,
} from '../utils/matchesGrouping';
import { matchCardToApiFixture } from '../utils/matchCardToApiFixture';
import { mergeTodayCalendarWithLiveFeed } from '../utils/mergeTodayCalendarWithLiveFeed';
import { dateFromLocalKey } from '../utils/safeDate';
import { ensureLiveFeed, subscribeLiveFeed, isLiveFeedWsTrusted } from '../services/liveFeedOwner';
import { shouldApplyCalendarGeneration } from '../utils/calendarGeneration';
import { shouldForceLiveFeedFetch } from '../utils/liveFeedForceGate';

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
  refreshSoft: () => void;
  matchesCount: number;
  leaguesCount: number;
}

export interface UseMatchesDataOptions {
  /** Pause calendar refresh when another hook owns the matches tab (e.g. WC filter). */
  pauseBackgroundRefresh?: boolean;
  /** Fixture IDs currently mounted in visible list rows. */
  visibleFixtureIds?: number[];
  /** Bumps when visible set changes — re-syncs registerInterest. */
  interestRevision?: number;
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

const evictOldestIfNeeded = (map: Map<string, any>, incomingKey?: string) => {
  if (incomingKey !== undefined && map.has(incomingKey)) {
    // Re-insert so Map order tracks recency instead of first insertion.
    map.delete(incomingKey);
    return;
  }
  if (map.size >= MAX_CACHE_ENTRIES) {
    // Map preserves insertion order — first key is oldest
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
};

const rememberCalendar = (dateKey: string, data: Match[]) => {
  evictOldestIfNeeded(memoryCache, dateKey);
  memoryCache.set(dateKey, { data, timestamp: Date.now() });
};

// ✅ Throttle background refresh - track last background fetch per date.
// Align with calendar poll so we don't re-download ~200KB when switching dates rapidly.
const BACKGROUND_REFRESH_THROTTLE = LIVE_FIXTURE_CALENDAR_POLL_MS;

/** Throttle logo/name prefetch so live-feed merges don't stampede the network. */
const PREFETCH_THROTTLE_MS = 30_000;
/** When calendar rows are overdue NS, force a fresh day fetch (throttled). */
const STALE_CALENDAR_REFRESH_MS = 20_000;
const STALE_CALENDAR_MAX_REPEATS = 2;
let lastPrefetchAt = 0;
let lastStaleCalendarRefreshAt = 0;
let lastStaleCalendarKey = '';
let staleCalendarRepeats = 0;

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
  options?: { fresh?: boolean; pull?: boolean },
): Promise<Match[]> {
  const byDatePromise = fetchMatchesByDate(
    date,
    options?.pull ? { pull: true } : options?.fresh ? { fresh: true } : undefined,
  );
  // A7: when WS owns live scores, honor the 12s live-feed TTL instead of force-busting.
  const forceLive = shouldForceLiveFeedFetch(
    options?.fresh === true,
    isLiveFeedWsTrusted(),
  );
  const livePromise = options?.pull
    ? ensureLiveFeed({ pull: true })
    : ensureLiveFeed({ force: forceLive });

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

/** All live + overdue stale + near-kickoff NS (capped). */
function buildRegisterInterestIds(
  pollIds: number[],
  visibleIds: number[],
  matches: Match[],
): number[] {
  const visibleSet = new Set(visibleIds);
  const matchById = new Map(
    matches
      .map((m) => {
        const id = parseInt(m.id, 10);
        return Number.isFinite(id) && id > 0 ? ([id, m] as const) : null;
      })
      .filter((row): row is readonly [number, Match] => row != null),
  );

  const viewportInterest = pollIds.filter((id) => visibleSet.has(id));

  const backgroundLive: number[] = [];
  for (const id of pollIds) {
    if (visibleSet.has(id)) continue;
    if (matchById.get(id)?.status !== 'live') continue;
    backgroundLive.push(id);
    if (backgroundLive.length >= MATCHES_LIST_BACKGROUND_LIVE_CAP) break;
  }

  const out: number[] = [];
  const seen = new Set<number>();
  for (const id of [...viewportInterest, ...backgroundLive]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
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
 * Custom hook for matches data with single API request and caching
 */
export const useMatchesData = (
  selectedDate: Date,
  options: UseMatchesDataOptions = {},
): UseMatchesDataResult => {
  const { pauseBackgroundRefresh = false, visibleFixtureIds = [], interestRevision = 0 } = options;
  const dateString = formatLocalDateKey(selectedDate);
  const memoryBoot = memoryCache.get(dateString);
  const [calendarMatches, setCalendarMatches] = useState<Match[]>(() => memoryBoot?.data ?? []);
  const [loading, setLoading] = useState<boolean>(() => !memoryBoot);
  const [error, setError] = useState<string | null>(null);
  // Fix ERR-3: track when background refresh fails so UI can show a stale indicator
  const [isDataStale, setIsDataStale] = useState<boolean>(false);
  /** Date currently being fetched — a different date must never be skipped. */
  const inFlightDateRef = useRef<string | null>(null);
  const calendarLenRef = useRef(0);
  /** Bumps on date change so stale async writers cannot overwrite the active calendar (C2). */
  const calendarGenRef = useRef(0);
  const language = useLanguageStore((s) => s.language);
  calendarLenRef.current = calendarMatches.length;

  const today = getLocalTodayKey();
  const isToday = dateString === today;
  const isPastDate = dateString < today;

  useEffect(() => {
    calendarGenRef.current += 1;
  }, [dateString]);

  const applyCalendarMatches = useCallback(
    (
      generation: number,
      next: Match[] | ((prev: Match[]) => Match[]),
    ) => {
      if (!shouldApplyCalendarGeneration(generation, calendarGenRef.current)) return;
      setCalendarMatches(next);
    },
    [],
  );

  // Interest from calendar only (before overlay) so WS updates don't widen the set.
  const pollFixtureIds = useMemo(
    () => pickMatchesListInterestIds(calendarMatches),
    [calendarMatches],
  );
  const registerInterestIds = useMemo(
    () => buildRegisterInterestIds(pollFixtureIds, visibleFixtureIds, calendarMatches),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- interestRevision tracks visible ref updates
    [pollFixtureIds, visibleFixtureIds, calendarMatches, interestRevision],
  );
  const pollIdsKey = pollFixtureIds.join(',');
  const registerIdsKey = registerInterestIds.join(',');

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

  const overlayResult = useMemo(
    () => overlaySnapshotsOnCalendarDetailed(calendarMatches, overlaySnapshots),
    [calendarMatches, overlaySnapshots],
  );
  const matches = overlayResult.rows;
  useRegisterLiveFixtures(
    pauseBackgroundRefresh || !isToday ? [] : registerInterestIds,
  );

  // Paint live rows from calendar data instantly — no per-fixture HTTP stampede.
  useEffect(() => {
    if (pauseBackgroundRefresh || !isToday || pollFixtureIds.length === 0) return;
    const store = useLiveFixtureStore.getState();
    for (const id of pollFixtureIds) {
      const match = calendarMatches.find((m) => parseInt(m.id, 10) === id);
      if (!match) continue;
      const preview = matchCardToApiFixture(match, id);
      if (preview) store.ingestPreviewIfEmpty(id, preview);
    }
  }, [pollIdsKey, calendarMatches, pauseBackgroundRefresh, isToday]);
  
  // On date change paint from memory, otherwise drop the previous day's rows so
  // they never show under the new date. fetchData handles disk + network.
  useEffect(() => {
    const generation = calendarGenRef.current;
    const memoryCached = memoryCache.get(dateString);
    if (memoryCached?.data?.length) {
      applyCalendarMatches(generation, memoryCached.data);
      setLoading(false);
    } else {
      applyCalendarMatches(generation, []);
      setLoading(true);
    }
  }, [dateString, applyCalendarMatches]);

  // Prefetch today + yesterday in background for instant tab switches
  useEffect(() => {
    if (pauseBackgroundRefresh) return;
    const todayKey = getLocalTodayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = formatLocalDateKey(yesterday);

    [todayKey, yesterdayKey].forEach((key) => {
      if (memoryCache.has(key)) return;
      // fetchData already loads today — avoid a duplicate calendar+live round-trip.
      if (key === todayKey && dateString === todayKey) return;
      if (key === yesterdayKey && dateString === yesterdayKey) return;
      const isTodayKey = key === todayKey;
      const date = isTodayKey ? new Date() : yesterday;
      const load = isTodayKey ? fetchTodayMatchesWithLiveFeed(date) : fetchMatchesByDate(date);
      load.then((data) => {
        if (data.length > 0) {
          rememberCalendar(key, data);
          // fetchMatchesByDate already persisted non-today calendars.
          if (isTodayKey) {
            cacheService.set(getMatchesCacheKey(key), data, MATCHES_CALENDAR_DISK_TTL_MS).catch(() => {});
          }
        }
      }).catch(() => {});
    });
  }, [pauseBackgroundRefresh, dateString]);

  // Group matches by league, then country — incremental when few rows changed (P1-5).
  const countryGroupsPrevRef = useRef<CountryGroup[] | null>(null);
  // Reset incremental cache when the calendar date identity set changes.
  useEffect(() => {
    countryGroupsPrevRef.current = null;
  }, [dateString]);
  const countryGroups = useMemo(() => {
    const next = groupMatchesByCountryIncremental(
      matches,
      overlayResult.changedIds,
      countryGroupsPrevRef.current,
    );
    countryGroupsPrevRef.current = next;
    return next;
  }, [matches, overlayResult.changedIds]);
  const groupedMatches = useMemo(
    () => countryGroups.flatMap((cg) => cg.leagues),
    [countryGroups],
  );

  useEffect(() => {
    if (matches.length === 0 || language !== 'ar') return;
    prefetchFootballTranslations(collectNamesFromMatches(matches), language);
  }, [matches, language]);

  // Fix PERF-7: .length is O(1) — no useMemo needed
  const matchesCount = matches.length;
  const leaguesCount = groupedMatches.length;

  const fetchData = useCallback(
    async (forceRefresh = false, options?: { pull?: boolean }) => {
      if (inFlightDateRef.current === dateString && !forceRefresh) return;
      inFlightDateRef.current = dateString;
      const release = () => {
        if (inFlightDateRef.current === dateString) inFlightDateRef.current = null;
      };
      const generation = calendarGenRef.current;
      const isCurrent = () => shouldApplyCalendarGeneration(generation, calendarGenRef.current);
      const pull = options?.pull === true;

      setError(null);

      try {
        const cacheKey = getMatchesCacheKey(dateString);

        // fetchMatchesByDate already persists non-today calendars to disk; only
        // today's merged (calendar + live feed) rows need a second write.
        const persistCalendar = async (data: Match[]) => {
          rememberCalendar(dateString, data);
          if (isToday) await cacheService.set(cacheKey, data, MATCHES_CALENDAR_DISK_TTL_MS);
        };

        const onLiveEarly = (liveFeed: Match[]) => {
          if (!isCurrent()) return;
          applyCalendarMatches(generation, (prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
          setLoading(false);
          setIsDataStale(false);
        };

        const refreshTodayInBackground = () => {
          void fetchTodayMatchesWithLiveFeed(selectedDate, onLiveEarly, { fresh: true })
            .then((merged) => {
              if (!isCurrent()) return;
              applyCalendarMatches(generation, merged);
              setIsDataStale(false);
              maybePrefetchMatchAssets(merged);
              return persistCalendar(merged);
            })
            .catch(() => {
              if (isCurrent()) setIsDataStale(true);
            });
        };

        // Try memory cache first (instant) — even if TTL elapsed, paint then refresh.
        if (!forceRefresh) {
          const memoryCached = memoryCache.get(dateString);
          if (memoryCached?.data?.length) {
            logger.debug(`📦 Memory cache hit for ${dateString}`);
            applyCalendarMatches(generation, memoryCached.data);
            setLoading(false);
            maybePrefetchMatchAssets(memoryCached.data);

            if (isPastDate) {
              release();
              return;
            }

            if (isToday) {
              refreshTodayInBackground();
            } else {
              fetchDataInBackground(dateString, isToday, isPastDate);
            }
            release();
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
            if (!shouldApplyCalendarGeneration(generation, calendarGenRef.current)) {
              release();
              return;
            }
            rememberCalendar(dateString, cached);
            applyCalendarMatches(generation, cached);
            setLoading(false);
            maybePrefetchMatchAssets(cached);

            if (isPastDate) {
              release();
              return;
            }

            if (isToday) {
              refreshTodayInBackground();
            } else {
              fetchDataInBackground(dateString, isToday, isPastDate);
            }
            release();
            return;
          }
        }

        // Only block the list on loading when we have nothing to show.
        if (calendarLenRef.current === 0) {
          setLoading(true);
        }

        let fetchedMatches: Match[];

        if (isToday) {
          fetchedMatches = await fetchTodayMatchesWithLiveFeed(
            selectedDate,
            onLiveEarly,
            pull ? { pull: true } : undefined,
          );
        } else {
          fetchedMatches = await fetchMatchesByDate(
            selectedDate,
            pull ? { pull: true } : undefined,
          );
        }

        if (!isCurrent()) return;
        applyCalendarMatches(generation, fetchedMatches);
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
        if (isAbortError(err)) {
          logger.debug('[useMatchesData] Fetch aborted (app background or timeout)');
          if (shouldApplyCalendarGeneration(generation, calendarGenRef.current)) {
            if (calendarLenRef.current > 0) {
              setIsDataStale(true);
              setError(null);
            } else {
              setError('load_failed');
            }
          }
        } else {
          const rawMessage = err instanceof Error ? err.message : 'Failed to load matches';
          const errorMessage =
            rawMessage.toLowerCase().includes('date value out of bounds')
              ? 'Failed to load matches'
              : rawMessage;
          if (shouldApplyCalendarGeneration(generation, calendarGenRef.current)) {
            setCalendarMatches((prev) => {
              if (prev.length > 0) {
                setIsDataStale(true);
                setError(null);
                return prev;
              }
              setError(errorMessage);
              return prev;
            });
          }
          logger.error('Error fetching matches data:', err);
        }
      } finally {
        // A superseded date must not clear the spinner of the date now loading.
        if (isCurrent()) setLoading(false);
        release();
      }
    },
    [dateString, selectedDate, isToday, isPastDate, applyCalendarMatches]
  );

  // Background refresh function (non-blocking)
  const fetchDataInBackground = useCallback(async (
    dateStr: string,
    isTodayFlag: boolean,
    isPastFlag: boolean
  ) => {
    if (isPastFlag) return;
    const generation = calendarGenRef.current;

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
              applyCalendarMatches(generation, (prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
              setIsDataStale(false);
            },
            { fresh: true },
          )
        : await fetchMatchesByDate(date, { fresh: true });

      if (!shouldApplyCalendarGeneration(generation, calendarGenRef.current)) return;
      applyCalendarMatches(generation, fetchedMatches);
      setIsDataStale(false); // background refresh succeeded

      rememberCalendar(dateStr, fetchedMatches);
      evictOldestIfNeeded(lastBackgroundFetch);
      // Non-today calendars were already persisted by fetchMatchesByDate.
      if (isTodayFlag) {
        await cacheService.set(getMatchesCacheKey(dateStr), fetchedMatches, MATCHES_CALENDAR_DISK_TTL_MS);
      }
    } catch (err) {
      if (isAbortError(err)) {
        logger.debug('[useMatchesData] Background refresh aborted');
        return;
      }
      // Fix ERR-3: mark data as stale so UI can show a subtle indicator
      if (shouldApplyCalendarGeneration(generation, calendarGenRef.current)) {
        setIsDataStale(true);
      }
      logger.warn('Background refresh failed:', err);
    }
  }, [applyCalendarMatches]);

  // ✅ FIXED: Use ref to prevent infinite loop
  // fetchData is memoized with useCallback, but we use ref for extra safety
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchDataRef.current();
  }, [dateString, isToday, isPastDate]);

  // Live scores for today are merged inside fetchTodayMatchesWithLiveFeed /
  // refreshTodayInBackground — no separate mount-time live fetch (avoids duplicate API calls).

  // Calendar refresh only — live scores via useLiveFixtureSync + Zustand store.
  // Pause while backgrounded; resume + silent refetch on foreground.
  // Coming back from a paused state (screen refocused / WC tab left): catch up
  // once instead of waiting a full poll period. Throttled inside.
  const wasPausedRef = useRef(pauseBackgroundRefresh);
  useEffect(() => {
    const wasPaused = wasPausedRef.current;
    wasPausedRef.current = pauseBackgroundRefresh;
    if (wasPaused && !pauseBackgroundRefresh && !isPastDate) {
      fetchDataInBackground(dateString, isToday, isPastDate).catch(() => {});
    }
  }, [pauseBackgroundRefresh, dateString, isToday, isPastDate, fetchDataInBackground]);

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

  // Live feed — subscribe to the canonical owner (single poll + TTL cache).
  useEffect(() => {
    if (pauseBackgroundRefresh || !isToday || isPastDate) return;
    const generation = calendarGenRef.current;

    const unsub = subscribeLiveFeed((liveFeed) => {
      if (liveFeed.length === 0) return;
      prefetchLiveMatchAssets(liveFeed);
      applyCalendarMatches(generation, (prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
      setLoading(false);
      setIsDataStale(false);
    });

    return () => {
      unsub();
    };
  }, [pauseBackgroundRefresh, isToday, isPastDate, applyCalendarMatches, dateString]);

  // Calendar still shows UPCOMING after kickoff+FT window — bypass day cache.
  useEffect(() => {
    if (pauseBackgroundRefresh || !isToday || isPastDate) return;
    const staleKey = calendarMatches
      .filter((m) => isStaleUpcomingOnCalendar(m))
      .map((m) => m.id)
      .join(',');
    if (!staleKey) return;
    const now = Date.now();
    if (now - lastStaleCalendarRefreshAt < STALE_CALENDAR_REFRESH_MS) return;
    // Same overdue rows after repeated refreshes → the provider has nothing new;
    // per-fixture polling still covers them, so stop re-downloading the day.
    if (staleKey === lastStaleCalendarKey) {
      if (staleCalendarRepeats >= STALE_CALENDAR_MAX_REPEATS) return;
      staleCalendarRepeats += 1;
    } else {
      lastStaleCalendarKey = staleKey;
      staleCalendarRepeats = 1;
    }
    lastStaleCalendarRefreshAt = now;
    const generation = calendarGenRef.current;
    void fetchTodayMatchesWithLiveFeed(selectedDate, (liveFeed) => {
      applyCalendarMatches(generation, (prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
      setLoading(false);
    }, { fresh: true })
      .then((merged) => {
        applyCalendarMatches(generation, merged);
        setIsDataStale(false);
        rememberCalendar(dateString, merged);
      })
      .catch(() => undefined);
  }, [calendarMatches, pauseBackgroundRefresh, isToday, isPastDate, selectedDate, dateString, applyCalendarMatches]);

  const refetch = useCallback(async () => {
    await fetchData(true, { pull: true });
  }, [fetchData]);

  /** Throttled cache-friendly refresh (no server pull) — for tab switches. */
  const refreshSoft = useCallback(() => {
    void fetchDataInBackground(dateString, isToday, isPastDate).catch(() => {});
  }, [fetchDataInBackground, dateString, isToday, isPastDate]);

  return {
    matches,
    groupedMatches,
    countryGroups,
    loading,
    error,
    isDataStale,
    refetch,
    refreshSoft,
    matchesCount,
    leaguesCount,
  };
};

export default useMatchesData;

