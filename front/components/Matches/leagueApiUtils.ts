/**
 * Utility functions for mapping API-Football responses to League Center component models
 * ✅ INTEGRATED: Direct backend API integration
 */

import { Fixture, ApiFootballService, MAJOR_LEAGUES } from '../../services/apiFootball';
import { Match, LeagueInfo, TeamInfo } from './matchCardUtils';
import { cacheService } from '../../services/cacheService';
import { logger } from '../../utils/logger';
import { getApiUrl } from '../../config/api.config';

/**
 * Maps API fixture status to component match status
 */
export const mapFixtureStatus = (statusShort: string): 'live' | 'upcoming' | 'finished' => {
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];
  const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

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
    if (status === '1H' && elapsed > 45) return `45+${elapsed - 45}'`;
    if (status === '2H' && elapsed > 90) return `90+${elapsed - 90}'`;
    return `${elapsed}'`;
  }

  return undefined;
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
export const formatMatchTime = (fixtureDate: string): string => {
  const date = new Date(fixtureDate);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

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
  };

  return {
    id: String(fixture.fixture.id),
    homeTeam,
    awayTeam,
    score: {
      home: fixture.goals.home ?? 0,
      away: fixture.goals.away ?? 0,
    },
    status: mapFixtureStatus(fixture.fixture.status.short),
    statusShort: fixture.fixture.status.short, // Needed for LiveTimer logic
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
  return fixtures.map(mapFixtureToMatch);
};

// ─── In-flight request deduplication ──────────────────────────────────────────
// Collapse multiple concurrent fetchMatchesByDate(date) / fetchLiveMatches()
// calls for the same key into ONE network request. Without this, mounting two
// components at once (Home + matches tab) fires duplicate requests that all
// count against the quota.
const inFlightMatchesByDate = new Map<string, Promise<Match[]>>();
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

/** World Cup fixtures for a date — backend filters by league/season env. */
export const fetchWorldCupMatchesByDate = async (date: Date): Promise<Match[]> => {
  const dateString = formatLocalDateKey(date);
  const cacheKey = `wc_matches_${dateString}`;

  const cached = await cacheService.get<Match[]>(cacheKey);
  if (cached && cached.length >= 0) {
    return cached;
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/football/cached/world-cup/${dateString}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 403) {
      return [];
    }

    if (response.ok) {
      const raw = await response.json();
      const fixtures: Fixture[] = Array.isArray(raw?.response) ? raw.response : [];
      const matches = mapFixturesToMatches(fixtures);
      if (matches.length > 0) {
        await cacheService.set(cacheKey, matches, 2 * 60 * 1000);
      }
      return matches;
    }
  } catch (error) {
    logger.warn('World Cup matches fetch failed:', error);
  }

  return [];
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

