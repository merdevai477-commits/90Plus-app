/**
 * Utility functions for mapping API-Football responses to League Center component models
 * ✅ INTEGRATED: Direct backend API integration
 */

import { Fixture, ApiFootballService, MAJOR_LEAGUES } from '../../services/apiFootball';
import { Match, LeagueInfo, TeamInfo } from './matchCardUtils';
import { cacheService } from '../../services/cacheService';
import { logger } from '../../utils/logger';
import { getApiUrl } from '../../config/api.config';
import { getAppLanguageCode, acceptLanguageHeader } from '../../utils/appLanguage';
import { safeFormatMatchTime } from '../../utils/safeDate';

function getAppLanguageParam(): string {
  return getAppLanguageCode();
}

/**
 * Maps API fixture status to component match status
 */
export const mapFixtureStatus = (
  statusShort: string,
  elapsed?: number | null,
): 'live' | 'upcoming' | 'finished' => {
  // Keep aligned with backend LIVE_STATUSES / is365Live (INT + SUSP stay "live"
  // so the client keeps polling until play resumes or the match ends).
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'];
  const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

  // Stale 365 rows: impossible stoppage → treat as finished.
  if (
    elapsed != null &&
    elapsed > 105 &&
    (statusShort === '2H' || statusShort === '1H')
  ) {
    return 'finished';
  }

  if (liveStatuses.includes(statusShort)) {
    return 'live';
  }
  if (finishedStatuses.includes(statusShort)) {
    return 'finished';
  }
  return 'upcoming';
};

/** Local calendar date key (YYYY-MM-DD) — avoids UTC drift near midnight. */
export const formatLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getLocalTodayKey = (): string => formatLocalDateKey(new Date());

const LIVE_STATUS_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);

/** Estimate elapsed minute from period start when API minute is missing. */
export const estimateElapsedFromPeriodStart = (
  statusShort: string,
  startTimestamp: number | undefined,
): number | undefined => {
  if (!startTimestamp) return undefined;
  const now = Math.floor(Date.now() / 1000);
  const start =
    startTimestamp > 1_000_000_000_000
      ? Math.floor(startTimestamp / 1000)
      : startTimestamp;
  let diffMin = Math.max(0, Math.floor((now - start) / 60));
  if (statusShort === '2H') diffMin += 45;
  if (statusShort === 'ET') diffMin += 90;
  return diffMin;
};

/** Cap announced / running stoppage minutes for display. */
const clampStoppage = (n: number): number => Math.min(Math.max(Math.floor(n), 1), 15);

/**
 * Build `45+2'` / `90+4'` / `120+3'` from period base, elapsed, and optional API `extra`.
 * Prefer elapsed overflow when the clock already advanced past the period end;
 * otherwise use `extra` when the feed keeps elapsed pinned at 45/90/120.
 */
export const formatStoppageMinute = (
  base: number,
  elapsed: number,
  extra?: number | null,
): string => {
  if (elapsed > base) return `${base}+${clampStoppage(elapsed - base)}'`;
  if (extra != null && extra > 0 && elapsed >= base) {
    return `${base}+${clampStoppage(extra)}'`;
  }
  return `${elapsed}'`;
};

/** True when the match clock is in injury/stoppage time. */
export const isLiveStoppage = (
  statusShort: string | undefined | null,
  elapsed?: number | null,
  extra?: number | null,
): boolean => {
  const short = (statusShort ?? '').trim();
  const hasExtra = extra != null && extra > 0;
  if (short === '1H') return hasExtra || (elapsed != null && elapsed > 45);
  if (short === '2H' || short === 'LIVE') {
    return hasExtra || (elapsed != null && elapsed > 90);
  }
  if (short === 'ET') {
    return hasExtra || (elapsed != null && elapsed > 120);
  }
  return false;
};

/**
 * Live minute label shared by list cards and match-details header.
 * Always prefers clear stoppage form: `90+4'` / `45+2'` (not bare `90'`).
 */
export const formatLiveMinuteDisplay = (
  statusShort: string,
  elapsed: number | null | undefined,
  extra?: number | null,
): string | undefined => {
  const status = statusShort;
  if (status === 'FT' || status === 'AET') return undefined;
  if (status === 'PEN' || status === 'P') return undefined;
  if (status === 'HT') return 'HT';
  if (status === 'BT') return 'BT';

  if (status === 'ET' && elapsed != null) {
    if (elapsed > 120 || (elapsed >= 120 && extra != null && extra > 0)) {
      return `${formatStoppageMinute(120, elapsed, extra)} (ET)`;
    }
    if (elapsed > 90) return `${formatStoppageMinute(90, elapsed, extra)} (ET)`;
    return `${elapsed}' (ET)`;
  }

  if ((status === '1H' || status === '2H' || status === 'LIVE') && elapsed != null) {
    if (status === '1H' || (status === 'LIVE' && elapsed <= 45)) {
      return formatStoppageMinute(45, elapsed, status === '1H' || elapsed >= 45 ? extra : null);
    }
    return formatStoppageMinute(90, elapsed, extra);
  }

  return undefined;
};

/**
 * Single source for live minute labels — matches list and match-details must match.
 * Prefers API elapsed; only estimates from period start when elapsed is absent.
 */
export const resolveLiveMinuteLabel = (
  statusShort: string | undefined | null,
  elapsed: number | null | undefined,
  options?: { startTimestamp?: number; extra?: number | null },
): string | undefined => {
  const short = (statusShort ?? '').trim();
  if (!short || !LIVE_STATUS_SHORTS.has(short)) return undefined;

  const fromApi = formatLiveMinuteDisplay(short, elapsed, options?.extra);
  if (fromApi) return fromApi;

  if (elapsed == null && options?.startTimestamp) {
    const estimated = estimateElapsedFromPeriodStart(short, options.startTimestamp);
    if (estimated != null) {
      return formatLiveMinuteDisplay(short, estimated, options?.extra);
    }
  }

  if (short === '1H') return "1'";
  if (short === '2H') return "46'";
  return undefined;
};

/**
 * Map provider status (+ elapsed) to the half the ticking clock should use.
 * Scores365 often emits `LIVE` instead of `1H`/`2H` — treat it as a half
 * so MM:SS keeps running instead of freezing on a static `35'` label.
 */
export const normalizeClockPeriod = (
  statusShort: string | undefined | null,
  elapsed?: number | null,
): '1H' | '2H' | 'ET' | null => {
  const short = (statusShort ?? '').trim();
  if (short === '1H' || short === '2H' || short === 'ET') return short;
  if (short !== 'LIVE' && short !== 'INT') return null;
  if (elapsed == null || elapsed < 0) return '1H';
  if (elapsed > 90) return 'ET';
  if (elapsed > 45) return '2H';
  return '1H';
};

/**
 * Wall-clock period start (unix seconds) implied by API elapsed for status.
 * Used when provider periods are missing (e.g. Scores365) so MM:SS can tick.
 */
export const synthesizePeriodStartSec = (
  statusShort: string,
  elapsed: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): number => {
  const period = normalizeClockPeriod(statusShort, elapsed) ?? (statusShort ?? '').trim();
  let intoPeriodMin = Math.max(0, Math.floor(elapsed));
  if (period === '2H') intoPeriodMin = Math.max(0, Math.floor(elapsed) - 45);
  else if (period === 'ET') intoPeriodMin = Math.max(0, Math.floor(elapsed) - 90);
  return nowSec - intoPeriodMin * 60;
};

function normalizeUnixSec(ts: number): number {
  return ts > 1_000_000_000_000 ? Math.floor(ts / 1000) : ts;
}

/**
 * Live "MM:SS" clock for in-play periods, computed locally from a **stable**
 * period start (from `useAnchoredPeriodStart` or real API `periods.*`).
 *
 * Does not synthesize from `elapsed` here — that would freeze at MM:00 on
 * every render. Callers must pass an anchored `startTimestamp`.
 *
 * Important: do NOT drop MM:SS when the local minute crosses 45/90 while the
 * API elapsed is still behind — that used to snap the UI back to a frozen
 * `35'` minute-only label mid first half.
 *
 * Also: never invent the *next* half. Providers often leave status as `LIVE`
 * with elapsed stuck at 45 through half-time; a free-running 1H anchor would
 * keep ticking into 60+ and look like a jump to the 65th minute.
 */
export const resolveLiveSecondsLabel = (
  statusShort: string | undefined | null,
  elapsed: number | null | undefined,
  options?: { startTimestamp?: number; extra?: number | null },
): string | undefined => {
  const period = normalizeClockPeriod(statusShort, elapsed);
  if (!period) return undefined;

  // Injury / stoppage time uses the minute-only `90+4'` label, not MM:SS.
  if (isLiveStoppage(statusShort, elapsed, options?.extra)) return undefined;
  // Also treat stoppage using the normalized period (LIVE → 1H/2H).
  if (isLiveStoppage(period, elapsed, options?.extra)) return undefined;

  if (options?.startTimestamp == null || !Number.isFinite(options.startTimestamp)) {
    return undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  const startSec = normalizeUnixSec(options.startTimestamp);
  const offsetMin = period === '2H' ? 45 : period === 'ET' ? 90 : 0;
  const intoPeriod = Math.max(0, now - startSec);
  let totalSeconds = intoPeriod + offsetMin * 60;

  // Allow a small lead over stale API elapsed so the clock still feels live,
  // but do not runaway minutes ahead while the provider is frozen (HT).
  const MAX_LEAD_SEC = 90;
  if (elapsed != null && elapsed >= 0 && Number.isFinite(elapsed)) {
    const elapsedFloorSec = Math.floor(elapsed) * 60;
    totalSeconds = Math.min(totalSeconds, elapsedFloorSec + MAX_LEAD_SEC);
    totalSeconds = Math.max(totalSeconds, elapsedFloorSec);
  }

  // Hard stop at the end of this half until status/elapsed moves us on.
  const periodEndMin = period === '1H' ? 45 : period === '2H' ? 90 : 120;
  const periodEndSec = periodEndMin * 60;
  if (totalSeconds >= periodEndSec) {
    return `${periodEndMin}:00`;
  }

  const minute = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minute}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Formats match minute for display
 * Uses unified status engine with correct 90+X format
 */
export const formatMatchMinute = (fixture: Fixture): string | undefined => {
  const status = fixture.fixture.status.short;
  const elapsed = fixture.fixture.status.elapsed;
  const extra = fixture.fixture.status.extra ?? null;

  return formatLiveMinuteDisplay(status, elapsed, extra);
};

/**
 * Formats fixture time for display (e.g., "20:00")
 */
export const formatMatchTime = (fixtureDate: string): string =>
  safeFormatMatchTime(fixtureDate);

/**
 * Maps a single API Fixture to component Match model
 */
export const mapFixtureToMatch = (fixture: Fixture): Match => {
  const homeTeam: TeamInfo = {
    name: fixture.teams.home.name,
    logo: fixture.teams.home.logo,
  };

  const awayTeam: TeamInfo = {
    name: fixture.teams.away.name,
    logo: fixture.teams.away.logo,
  };

  const league: LeagueInfo = {
    id: fixture.league.id,
    name: fixture.league.name,
    logo: fixture.league.logo,
    country: fixture.league.country,
    countryFlag: fixture.league.flag,
    round: fixture.league.round || undefined,
  };

  return {
    id: String(fixture.fixture.id),
    homeTeam,
    awayTeam,
    score: {
      home: fixture.goals.home ?? 0,
      away: fixture.goals.away ?? 0,
    },
    status: mapFixtureStatus(fixture.fixture.status.short, fixture.fixture.status.elapsed),
    statusShort: fixture.fixture.status.short,
    elapsed: fixture.fixture.status.elapsed ?? null,
    extra: fixture.fixture.status.extra ?? null,
    minute: formatMatchMinute(fixture),
    startTimestamp: fixture.fixture.status.short === '2H'
      ? fixture.fixture.periods.second || undefined
      : fixture.fixture.periods.first || undefined,
    time: formatMatchTime(fixture.fixture.date),
    league,
    fixtureDate: fixture.fixture.date, // Full ISO kickoff — used for bell reminders + timezone-safe display
    crowdPrediction:
      (fixture as { _crowdPrediction?: Match['crowdPrediction']; crowdPrediction?: Match['crowdPrediction'] })
        ._crowdPrediction ??
      (fixture as { crowdPrediction?: Match['crowdPrediction'] }).crowdPrediction,
  };
};

/**
 * Maps an array of API Fixtures to component Match models
 */
export const mapFixturesToMatches = (fixtures: Fixture[]): Match[] => {
  const matches: Match[] = [];
  for (const fixture of fixtures) {
    try {
      matches.push(mapFixtureToMatch(fixture));
    } catch (err) {
      logger.warn(
        `Skipping fixture ${fixture?.fixture?.id ?? '?'} — map failed:`,
        err,
      );
    }
  }
  return matches;
};

// ─── In-flight request deduplication ──────────────────────────────────────────
// Collapse multiple concurrent fetchMatchesByDate(date) / fetchLiveMatches()
// calls for the same key into ONE network request. Without this, mounting two
// components at once (Home + matches tab) fires duplicate requests that all
// count against the quota.
const inFlightMatchesByDate = new Map<string, Promise<Match[]>>();
const inFlightWorldCupByDate = new Map<string, Promise<Match[]>>();
let inFlightLiveMatches: Promise<Match[]> | null = null;

/**
 * Fetches matches for a specific date directly from backend API.
 * Uses caching: past dates cached for 30 days (permanent), today for 5 min, future for 2 hours.
 * ✅ FIX: Always return cached data for past dates without re-fetching
 * ✅ OPTIMIZED: Backend has permanent cache for finished matches
 * ✅ INTEGRATED: Direct backend API integration
 */
export const fetchMatchesByDate = async (date: Date): Promise<Match[]> => {
  const dateString = formatLocalDateKey(date);

  // Collapse concurrent calls for the same date.
  const existing = inFlightMatchesByDate.get(dateString);
  if (existing) return existing;

  const promise = fetchMatchesByDateImpl(date, dateString).finally(() => {
    inFlightMatchesByDate.delete(dateString);
  });
  inFlightMatchesByDate.set(dateString, promise);
  return promise;
};

const fetchMatchesByDateImpl = async (date: Date, dateString: string): Promise<Match[]> => {
  const today = getLocalTodayKey();
  const isPastDate = dateString < today;
  
  // For past dates, check local cache first (instant response)
  if (isPastDate) {
    const cached = await cacheService.getMatchesByDate(dateString);
    if (cached && cached.length > 0) {
      logger.debug(`📦 [FAST] Matches from local cache for past date ${dateString}`);
      return cached;
    }
  }
  
  try {
    // Try direct backend API call first (optimized endpoint)
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/football/cached/matches/${dateString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      // Backend wraps the fixtures array in { status, results, response: [...] }.
      // Accept both shapes for safety (raw array OR wrapped object).
      const raw = await response.json();
      const fixtures: Fixture[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.response)
          ? raw.response
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
      const matches = mapFixturesToMatches(fixtures);
      
      // Cache the results locally - permanent for past dates
      if (matches.length > 0) {
        const cacheTTL = isPastDate 
          ? Number.MAX_SAFE_INTEGER // Permanent cache for past matches
          : undefined; // Use default TTL for future matches
        await cacheService.cacheMatchesByDate(dateString, matches, cacheTTL);
        logger.debug(`💾 Cached ${matches.length} matches for ${dateString} from backend (permanent: ${isPastDate})`);
      }
      
      return matches;
    }
  } catch (error) {
    logger.warn(`Direct backend call failed, falling back to ApiFootballService:`, error);
  }
  
  // Fallback to ApiFootballService
  logger.debug(`🔍 Fetching matches for date ${dateString} from backend via ApiFootballService...`);
  const fixtures = await ApiFootballService.getFixturesByDate(dateString);
  const matches = mapFixturesToMatches(fixtures);
  
  // Cache the results locally - permanent for past dates
  if (matches.length > 0) {
    const cacheTTL = isPastDate 
      ? Number.MAX_SAFE_INTEGER // Permanent cache for past matches
      : undefined; // Use default TTL for future matches
    await cacheService.cacheMatchesByDate(dateString, matches, cacheTTL);
    logger.debug(`💾 Cached ${matches.length} matches for ${dateString} (permanent: ${isPastDate})`);
  }
  
  return matches;
};

/** Fetch fixtures for one league on a specific date (lower-tier leagues). */
export const fetchLeagueMatchesByDate = async (
  leagueId: number,
  date: Date,
): Promise<Match[]> => {
  const dateString = formatLocalDateKey(date);
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(
      `${apiUrl}/football/cached/league/${leagueId}/matches/${dateString}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    if (!response.ok) return [];
    const raw = await response.json();
    const fixtures: Fixture[] = Array.isArray(raw?.response) ? raw.response : [];
    return mapFixturesToMatches(fixtures);
  } catch (error) {
    logger.warn(`fetchLeagueMatchesByDate(${leagueId}, ${dateString}) failed:`, error);
    return [];
  }
};

/** World Cup fixtures for a date — backend filters by league/season env. */
export const fetchWorldCupMatchesByDate = async (
  date: Date,
  options?: { skipDiskCache?: boolean },
): Promise<Match[]> => {
  const dateString = formatLocalDateKey(date);
  const inflightKey = `${dateString}:${getAppLanguageParam()}:${options?.skipDiskCache ? 'fresh' : 'cache'}`;
  const existing = inFlightWorldCupByDate.get(inflightKey);
  if (existing) return existing;

  const promise = fetchWorldCupMatchesByDateImpl(date, dateString, options).finally(() => {
    inFlightWorldCupByDate.delete(inflightKey);
  });
  inFlightWorldCupByDate.set(inflightKey, promise);
  return promise;
};

const fetchWorldCupMatchesByDateImpl = async (
  date: Date,
  dateString: string,
  options?: { skipDiskCache?: boolean },
): Promise<Match[]> => {
  const cacheKey = `wc_matches_${dateString}_${getAppLanguageParam()}`;
  const isToday = dateString === getLocalTodayKey();

  if (!options?.skipDiskCache) {
    const cached = await cacheService.get<Match[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }
    // Purge poisoned empty entries from the old `length >= 0` disk-cache bug.
    if (cached && cached.length === 0) {
      await cacheService.invalidate(cacheKey);
    }
  }

  try {
    const apiUrl = getApiUrl();
    const lang = getAppLanguageParam();
    const response = await fetch(
      `${apiUrl}/football/cached/world-cup/${dateString}?language=${lang}`,
      {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': acceptLanguageHeader(lang as 'ar' | 'en'),
      },
    },
    );

    if (response.status === 403) {
      return [];
    }

    if (response.ok) {
      const raw = await response.json();
      const fixtures: Fixture[] = Array.isArray(raw?.response) ? raw.response : [];
      const matches = mapFixturesToMatches(fixtures);
      if (matches.length > 0) {
        const ttl = isToday ? 3_000 : 2 * 60 * 1000;
        await cacheService.set(cacheKey, matches, ttl);
      }
      return matches;
    }
  } catch (error) {
    logger.warn('World Cup matches fetch failed:', error);
  }

  return [];
};

/** World Cup fixtures by tournament phase (all upcoming knockout rounds, etc.). */
export const fetchWorldCupMatchesByPhase = async (
  phase: 'upcoming' | 'live' | 'finished' | 'all',
): Promise<Match[]> => {
  const cacheKey = `wc_phase_${phase}_${getAppLanguageParam()}`;
  try {
    const apiUrl = getApiUrl();
    const lang = getAppLanguageParam();
    const response = await fetch(
      `${apiUrl}/football/cached/world-cup/phase/${phase}?language=${lang}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': acceptLanguageHeader(lang as 'ar' | 'en'),
        },
      },
    );
    if (response.status === 403) return [];
    if (!response.ok) return [];
    const raw = await response.json();
    const fixtures: Fixture[] = Array.isArray(raw?.response) ? raw.response : [];
    const matches = mapFixturesToMatches(fixtures);
    if (matches.length > 0) {
      const ttl = phase === 'live' ? 3_000 : 60_000;
      await cacheService.set(cacheKey, matches, ttl);
    }
    return matches;
  } catch (error) {
    logger.warn(`fetchWorldCupMatchesByPhase(${phase}) failed:`, error);
    const cached = await cacheService.get<Match[]>(cacheKey);
    return cached ?? [];
  }
};

/**
 * Fetches live matches directly from backend API
 * ✅ INTEGRATED: Direct backend API integration
 */
export const fetchLiveMatches = async (): Promise<Match[]> => {
  // Collapse concurrent calls — live matches are shared across screens.
  if (inFlightLiveMatches) return inFlightLiveMatches;

  inFlightLiveMatches = fetchLiveMatchesImpl().finally(() => {
    inFlightLiveMatches = null;
  });
  return inFlightLiveMatches;
};

const fetchLiveMatchesImpl = async (): Promise<Match[]> => {
  try {
    // Try direct backend API call first
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/football/fixtures/live`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      // Backend wraps the fixtures array in { status, results, response: [...] }.
      // Accept both shapes for safety (raw array OR wrapped object).
      const raw = await response.json();
      const fixtures: Fixture[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.response)
          ? raw.response
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
      return mapFixturesToMatches(fixtures);
    }
  } catch (error) {
    logger.warn(`Direct backend call failed, falling back to ApiFootballService:`, error);
  }
  
  // Fallback to ApiFootballService
  const fixtures = await ApiFootballService.getLiveFixtures();
  return mapFixturesToMatches(fixtures);
};

/**
 * Fetches matches for top 5 leagues on a specific date
 */
export const fetchTop5LeaguesMatches = async (date?: Date): Promise<Match[]> => {
  const params = date ? { date: date.toISOString().split('T')[0] } : {};
  const fixtures = await ApiFootballService.getTop5LeaguesFixtures(params);
  return mapFixturesToMatches(fixtures);
};

/**
 * Fetches live matches from top 5 leagues
 */
export const fetchTop5LeaguesLiveMatches = async (): Promise<Match[]> => {
  const fixtures = await ApiFootballService.getTop5LeaguesLive();
  return mapFixturesToMatches(fixtures);
};

/**
 * League IDs for filtering - exported for use in components
 */
export const LEAGUE_IDS = MAJOR_LEAGUES;

