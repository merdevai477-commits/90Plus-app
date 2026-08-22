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
  formatLocalDateKey,
} from '../components/Matches/leagueApiUtils';
import { cacheService } from '../services/cacheService';
import { logger } from '../utils/logger';
import { useLanguageStore } from '../src/i18n/store';
import { prefetchFootballTranslations } from '../src/stores/footballTranslationStore';
import { collectNamesFromMatches } from '../utils/footballNamePrefetch';
import { getCountryFlagUri } from '../utils/countryFlagUri';
import { prefetchMatchAssets } from '../utils/prefetchMatchAssets';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import type { LiveFixtureSnapshot } from '../src/store/liveFixtureStore.types';
import {
  LIVE_FIXTURE_CALENDAR_POLL_MS,
  MATCHES_LIST_INTEREST_CAP,
  MATCHES_LIST_KICKOFF_INTEREST_MS,
} from '../src/store/liveFixtureStore.types';
import { useRegisterLiveFixtures } from './useLiveFixture';
import { snapshotToMatchRow } from '../src/utils/snapshotToMatchRow';
import { dateFromLocalKey } from '../utils/safeDate';

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

// TTL configuration based on match date
const getCacheTTL = (dateString: string): number => {
  const today = getLocalTodayKey();
  const isPast = dateString < today;
  const isToday = dateString === today;

  if (isPast) {
    return 60 * 60 * 1000; // 60 minutes for past matches
  } else if (isToday) {
    // Live scores arrive via WebSocket + live feed merge; keep calendar memory
    // aligned with LIVE_FIXTURE_CALENDAR_POLL_MS (~45s).
    return LIVE_FIXTURE_CALENDAR_POLL_MS;
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
// Align with calendar poll so we don't re-download ~200KB when switching dates rapidly.
const BACKGROUND_REFRESH_THROTTLE = LIVE_FIXTURE_CALENDAR_POLL_MS;

/** Throttle logo/name prefetch so live-feed merges don't stampede the network. */
const PREFETCH_THROTTLE_MS = 30_000;
let lastPrefetchAt = 0;

function maybePrefetchMatchAssets(rows: Match[]): void {
  const now = Date.now();
  if (now - lastPrefetchAt < PREFETCH_THROTTLE_MS) return;
  lastPrefetchAt = now;
  prefetchMatchAssets(rows);
}

/**
 * Merge today's date-indexed calendar with the global live feed.
 * Calendar cache can lag behind kickoff; live endpoint is authoritative for status/score.
 */
function mergeTodayCalendarWithLiveFeed(calendar: Match[], liveFeed: Match[]): Match[] {
  const map = new Map<string, Match>();
  for (const row of calendar) {
    map.set(row.id, row);
  }
  for (const liveRow of liveFeed) {
    if (liveRow.status !== 'live') continue;
    const existing = map.get(liveRow.id);
    map.set(
      liveRow.id,
      existing
        ? {
            ...existing,
            ...liveRow,
            status: 'live',
            score: liveRow.score,
            minute: liveRow.minute ?? existing.minute,
            elapsed: liveRow.elapsed ?? existing.elapsed,
            extra: liveRow.extra ?? existing.extra,
            statusShort: liveRow.statusShort ?? existing.statusShort,
          }
        : liveRow,
    );
  }
  return Array.from(map.values());
}

async function fetchTodayMatchesWithLiveFeed(
  date: Date,
  onLiveEarly?: (liveFeed: Match[]) => void,
): Promise<Match[]> {
  const byDatePromise = fetchMatchesByDate(date);
  const livePromise = fetchLiveMatches();

  // Paint live rows as soon as the live endpoint returns — don't wait for the
  // full day calendar (often slower) so the Live tab feels instant.
  void livePromise
    .then((liveFeed) => {
      if (liveFeed.length > 0) onLiveEarly?.(liveFeed);
    })
    .catch(() => {});

  const [byDate, liveFeed] = await Promise.all([
    byDatePromise,
    livePromise.catch(() => [] as Match[]),
  ]);
  return mergeTodayCalendarWithLiveFeed(byDate, liveFeed);
}

/**
 * Poll fixtures that are live or about to kick off (10m window).
 * Overdue NS discovery is owned by backend probe + live feed — not the list.
 */
function shouldPollFixtureOnMatchesList(match: Match, now = Date.now()): boolean {
  if (match.status === 'live') return true;
  if (match.status === 'finished') return false;
  if (!match.fixtureDate) return false;
  const kickoff = new Date(match.fixtureDate).getTime();
  if (Number.isNaN(kickoff)) return false;
  const delta = kickoff - now;
  return delta <= MATCHES_LIST_KICKOFF_INTEREST_MS && delta >= 0;
}

/** Live first, then nearest kickoffs — hard-capped for list interest. */
function pickMatchesListInterestIds(matches: Match[], cap = MATCHES_LIST_INTEREST_CAP): number[] {
  const now = Date.now();
  const live: { id: number; kickoff: number }[] = [];
  const near: { id: number; kickoff: number }[] = [];

  for (const m of matches) {
    if (!shouldPollFixtureOnMatchesList(m, now)) continue;
    const id = parseInt(m.id, 10);
    if (!Number.isFinite(id) || id <= 0) continue;
    const kickoff = m.fixtureDate ? Date.parse(m.fixtureDate) : 0;
    const row = { id, kickoff: Number.isFinite(kickoff) ? kickoff : 0 };
    if (m.status === 'live') live.push(row);
    else near.push(row);
  }

  live.sort((a, b) => a.kickoff - b.kickoff);
  near.sort((a, b) => a.kickoff - b.kickoff);

  const out: number[] = [];
  const seen = new Set<number>();
  for (const row of [...live, ...near]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row.id);
    if (out.length >= cap) break;
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

/** Overlay Zustand live snapshots onto calendar rows for live/finished fixtures. */
function overlaySnapshotsOnCalendar(
  calendarRows: Match[],
  snapshots: Record<number, LiveFixtureSnapshot>,
): Match[] {
  if (Object.keys(snapshots).length === 0) return calendarRows;
  return calendarRows.map((row) => {
    const id = parseInt(row.id, 10);
    if (Number.isNaN(id)) return row;
    const snap = snapshots[id];
    if (!snap) return row;
    // Promote NS→live/finished from per-fixture polls even when calendar is still stale.
    if (
      row.status === 'live' ||
      snap.phase === 'live' ||
      snap.phase === 'finished' ||
      (row.status === 'upcoming' && snap.phase !== 'upcoming' && snap.phase !== 'unknown')
    ) {
      return snapshotToMatchRow(snap);
    }
    return row;
  });
}

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
 * Pass pre-built league groups to avoid re-grouping the same match list.
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

  return Array.from(countryMap.entries())
    .map(([country, data]) => ({
      country,
      countryFlag: getCountryFlagUri(country, data.flag),
      leagues: data.leagues,
    }))
    .sort((a, b) => getCountrySortKey(a.country).localeCompare(getCountrySortKey(b.country)));
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
  const [calendarMatches, setCalendarMatches] = useState<Match[]>([]);
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

  // Interest from calendar only (before overlay) so WS updates don't widen the set.
  const pollFixtureIds = useMemo(
    () => pickMatchesListInterestIds(calendarMatches),
    [calendarMatches],
  );
  const pollIdsKey = pollFixtureIds.join(',');

  // Subscribe only to interested snapshots — avoids remapping England→Chile on every WS tick.
  const overlaySnapshots = useLiveFixtureStore(
    useCallback(
      (s) => {
        const out: Record<number, LiveFixtureSnapshot> = {};
        for (const id of pollFixtureIds) {
          const snap = s.snapshots[id];
          if (snap) out[id] = snap;
        }
        return out;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- pollIdsKey tracks pollFixtureIds
      [pollIdsKey],
    ),
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
    if (memoryCached) {
      setCalendarMatches(memoryCached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const cacheKey = getMatchesCacheKey(dateString);
    cacheService.get<Match[]>(cacheKey).then((cached) => {
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
          cacheService.set(getMatchesCacheKey(key), data, key === todayKey ? 2 * 60 * 1000 : Number.MAX_SAFE_INTEGER).catch(() => {});
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

        // Try memory cache first (instant)
        if (!forceRefresh) {
          const memoryCached = memoryCache.get(dateString);
          if (memoryCached && isCacheValid(memoryCached, dateString)) {
            logger.debug(`📦 Memory cache hit for ${dateString}`);
            setCalendarMatches(memoryCached.data);
            setLoading(false);
            maybePrefetchMatchAssets(memoryCached.data);
            
            // For past dates, don't refresh
            if (isPastDate) {
              isFetchingRef.current = false;
              return;
            }
            
            // For today, always merge live feed immediately (calendar cache can lag).
            if (isToday) {
              void fetchTodayMatchesWithLiveFeed(selectedDate, (liveFeed) => {
                setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
                setLoading(false);
                setIsDataStale(false);
              })
                .then((merged) => {
                  setCalendarMatches(merged);
                  setIsDataStale(false);
                  maybePrefetchMatchAssets(merged);
                  evictOldestIfNeeded(memoryCache);
                  memoryCache.set(dateString, { data: merged, timestamp: Date.now() });
                  return cacheService.set(cacheKey, merged, LIVE_FIXTURE_CALENDAR_POLL_MS);
                })
                .catch(() => setIsDataStale(true));
            } else {
              fetchDataInBackground(dateString, isToday, isPastDate);
            }
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
            setCalendarMatches(cached);
            setLoading(false);
            maybePrefetchMatchAssets(cached);
            
            // For past dates, don't refresh
            if (isPastDate) {
              isFetchingRef.current = false;
              return;
            }
            
            // For today, always merge live feed immediately (calendar cache can lag).
            if (isToday) {
              void fetchTodayMatchesWithLiveFeed(selectedDate, (liveFeed) => {
                setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
                setLoading(false);
                setIsDataStale(false);
              })
                .then((merged) => {
                  setCalendarMatches(merged);
                  setIsDataStale(false);
                  maybePrefetchMatchAssets(merged);
                  evictOldestIfNeeded(memoryCache);
                  memoryCache.set(dateString, { data: merged, timestamp: Date.now() });
                  return cacheService.set(cacheKey, merged, LIVE_FIXTURE_CALENDAR_POLL_MS);
                })
                .catch(() => setIsDataStale(true));
            } else {
              fetchDataInBackground(dateString, isToday, isPastDate);
            }
            isFetchingRef.current = false;
            return;
          }
        }

        // Only set loading if no cache found
        setLoading(true);

        let fetchedMatches: Match[];

        if (isToday) {
          fetchedMatches = await fetchTodayMatchesWithLiveFeed(selectedDate, (liveFeed) => {
            setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
            setLoading(false);
            setIsDataStale(false);
          });
        } else if (!isPastDate) {
          // For future dates, just fetch scheduled matches
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        } else {
          // For past dates, fetch from cache only (permanent storage)
          fetchedMatches = await fetchMatchesByDate(selectedDate);
        }

        setCalendarMatches(fetchedMatches);
        setIsDataStale(false); // fresh data loaded successfully
        maybePrefetchMatchAssets(fetchedMatches);

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
        ? await fetchTodayMatchesWithLiveFeed(date, (liveFeed) => {
            setCalendarMatches((prev) => mergeTodayCalendarWithLiveFeed(prev, liveFeed));
            setIsDataStale(false);
          })
        : await fetchMatchesByDate(date);

      setCalendarMatches(fetchedMatches);
      setIsDataStale(false); // background refresh succeeded

      // Today: short TTL so the disk cache doesn't override fresh polls.
      // Future: 3 days. Past dates handled by the foreground fetch.
      const cacheTTL = isTodayFlag ? LIVE_FIXTURE_CALENDAR_POLL_MS : 3 * 24 * 60 * 60 * 1000;
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
  }, [dateString, isToday, isPastDate]);

  // Calendar refresh only — live scores via useLiveFixtureSync + Zustand store.
  useEffect(() => {
    if (pauseBackgroundRefresh || isPastDate) return;
    const intervalMs = isToday ? LIVE_FIXTURE_CALENDAR_POLL_MS : 5 * 60_000;
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

