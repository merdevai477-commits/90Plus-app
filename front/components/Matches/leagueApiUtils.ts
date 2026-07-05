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
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'];
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

const LIVE_STATUS_SHORTS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);

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

/**
 * Live minute label shared by list cards and match-details header.
 */
export const formatLiveMinuteDisplay = (
  statusShort: string,
  elapsed: number | null | undefined,
): string | undefined => {
  const status = statusShort;
  if (status === 'FT' || status === 'AET') return undefined;
  if (status === 'PEN' || status === 'P') return undefined;
  if (status === 'HT') return 'HT';
  if (status === 'BT') return 'BT';

  if (status === 'ET' && elapsed != null) {
    if (elapsed > 90) return `90+${elapsed - 90}' (ET)`;
    return `${elapsed}' (ET)`;
  }

  if ((status === '1H' || status === '2H') && elapsed != null) {
    if (status === '1H' && elapsed > 45) return `45+${Math.min(elapsed - 45, 15)}'`;
    if (status === '2H' && elapsed > 90) return `90+${Math.min(elapsed - 90, 15)}'`;
    return `${elapsed}'`;
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
  options?: { startTimestamp?: number },
): string | undefined => {
  const short = (statusShort ?? '').trim();
  if (!short || !LIVE_STATUS_SHORTS.has(short)) return undefined;

  const fromApi = formatLiveMinuteDisplay(short, elapsed);
  if (fromApi) return fromApi;

  if (elapsed == null && options?.startTimestamp) {
    const estimated = estimateElapsedFromPeriodStart(short, options.startTimestamp);
    if (estimated != null) {
      return formatLiveMinuteDisplay(short, estimated);
    }
  }

  if (short === '1H') return "1'";
  if (short === '2H') return "46'";
  return undefined;
};

/**
 * Live "MM:SS" clock for in-play periods, computed locally from the period
 * start timestamp so the seconds tick smoothly between API updates.
 *
 * Returns undefined (caller falls back to the minute-only label) when:
 *  - the status is not normal in-play (HT/BT/P/stoppage), or
 *  - we have no reliable period start, or
 *  - the locally computed minute drifts more than 2' from the API elapsed
 *    (avoids showing a clock that disagrees with the authoritative minute).
 */
export const resolveLiveSecondsLabel = (
  statusShort: string | undefined | null,
  elapsed: number | null | undefined,
  options?: { startTimestamp?: number },
): string | undefined => {
  const short = (statusShort ?? '').trim();
  if (short !== '1H' && short !== '2H' && short !== 'ET') return undefined;

  const start = options?.startTimestamp;
  if (!start) return undefined;
  const startSec = start > 1_000_000_000_000 ? Math.floor(start / 1000) : start;
  const now = Math.floor(Date.now() / 1000);
  const intoPeriod = now - startSec;
  if (intoPeriod < 0) return undefined;

  const offsetMin = short === '2H' ? 45 : short === 'ET' ? 90 : 0;
  const totalSeconds = intoPeriod + offsetMin * 60;
  const minute = Math.floor(totalSeconds / 60);

  // Let the minute-only label handle stoppage overflow (45+X / 90+X / 120+X).
  if (short === '1H' && minute >= 45) return undefined;
  if (short === '2H' && minute >= 90) return undefined;
  if (short === 'ET' && minute >= 120) return undefined;

  // Guard against clock drift vs. the authoritative API minute.
  if (elapsed != null && Math.abs(minute - elapsed) > 2) return undefined;

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

  return formatLiveMinuteDisplay(status, elapsed);
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
    minute: formatMatchMinute(fixture),
    startTimestamp: fixture.fixture.status.short === '2H'
      ? fixture.fixture.periods.second || undefined
      : fixture.fixture.periods.first || undefined,
    time: formatMatchTime(fixture.fixture.date),
    league,
    fixtureDate: fixture.fixture.date, // Full ISO kickoff — used for bell reminders + timezone-safe display
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

