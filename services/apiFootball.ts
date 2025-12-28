/**
 * API-Football v3 Service
 * Proxies requests through the backend to keep API key secure
 * Documentation: https://www.api-football.com/documentation-v3
 * 
 * Features:
 * - Backend permanent caching in PostgreSQL
 * - Finished matches stored permanently on server
 * - Players, teams, leagues cached permanently
 * - Local caching as secondary layer for offline access
 * - All data flows through /cached/* endpoints for optimal performance
 */

import { getApiUrl } from '../utils/getApiUrl';
import { footballCacheService } from './footballCacheService';
import { cacheService, CACHE_TTL } from './cacheService';
import { logger } from './logger';

const DEFAULT_TIMEOUT = 30000; // 30 seconds timeout

// Cache for failed rate limit requests to avoid repeated calls
const rateLimitCache = new Map<string, { timestamp: number; retryAfter: number }>();
const RATE_LIMIT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to check if request should be skipped due to recent rate limit
const shouldSkipDueToRateLimit = (endpoint: string): boolean => {
  const cached = rateLimitCache.get(endpoint);
  if (cached) {
    const timeSinceError = Date.now() - cached.timestamp;
    if (timeSinceError < cached.retryAfter) {
      return true; // Still in rate limit window
    }
    // Cache expired, remove it
    rateLimitCache.delete(endpoint);
  }
  return false;
};

// Helper to cache rate limit error
const cacheRateLimitError = (endpoint: string, retryAfter: number): void => {
  rateLimitCache.set(endpoint, {
    timestamp: Date.now(),
    retryAfter: Math.min(retryAfter, RATE_LIMIT_CACHE_TTL),
  });
  
  // Clean up old entries if cache gets too large
  if (rateLimitCache.size > 100) {
    const firstKey = rateLimitCache.keys().next().value;
    if (firstKey) rateLimitCache.delete(firstKey);
  }
};

// Major league IDs for prioritization
export const MAJOR_LEAGUES = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  BUNDESLIGA: 78,
  SERIE_A: 135,
  LIGUE_1: 61,
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 3,
  WORLD_CUP: 1,
  // Added for user region
  SAUDI_PRO_LEAGUE: 307,
  EGYPTIAN_PREMIER_LEAGUE: 233,
  MOROCCAN_BOTOLA: 200,
  CAF_CHAMPIONS_LEAGUE: 12,
  CAF_CONFED_CUP: 13,
  AFCON: 6,
  ISRAEL_PREMIER_LEAGUE: 383,
};

class ApiFootballError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiFootballError';
  }
}

const withTimeout = async <T>(promise: Promise<T>, timeout = DEFAULT_TIMEOUT): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new ApiFootballError('Request timed out - please check your connection'));
        });
      }),
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export interface League {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string;
  };
  country: {
    name: string;
    code: string;
    flag: string;
  };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
  }>;
}


export interface Fixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  homeLogo: string;
  awayLogo: string;
  date: string;
  time: string;
  status: 'finished' | 'live' | 'upcoming';
  league: string;
  leagueLogo?: string;
  venue?: string;
  minute?: string;
  prediction?: {
    type: 'win' | 'draw' | 'lose';
    homeScore: number;
    awayScore: number;
    points?: number;
    isCorrect?: boolean;
  };
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
}

export interface Lineup {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  coach: {
    id: number | null;
    name: string | null;
    photo: string | null;
  };
  formation: string | null;
  startXI: Array<{
    player: {
      id: number;
      name: string;
      number: number;
      pos: string | null;
      grid: string | null;
      photo: string | null;
    };
  }>;
  substitutes: Array<{
    player: {
      id: number;
      name: string;
      number: number;
      pos: string | null;
      photo: string | null;
    };
  }>;
}

export interface TeamStatistics {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  statistics: Array<{
    type: string;
    value: number | string | null;
  }>;
}

export interface TeamFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
    };
  };
  league: {
    id: number;
    name: string;
    logo: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface FixtureEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number;
    name: string;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

export interface Standing {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  update: string;
}


interface ProxyResponse<T> {
  status: 'SUCCESS' | 'ERROR';
  results?: number;
  response?: T;
  message?: string;
}

/**
 * Fetch data from the backend Football API proxy
 * The backend handles API key management and rate limiting
 * Includes automatic retry on timeout
 */
const fetchFromProxy = async <T>(
  endpoint: string,
  params: Record<string, any> = {},
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: any; headers?: Record<string, string>; retries?: number } = {}
): Promise<T> => {
  const baseUrl = getApiUrl();
  const { method = 'GET', body, headers = {}, retries = 2 } = options;

  // Some endpoints are handled at the root /api level (like /matches), while others 
  // are under the /football proxy prefix.
  const pathPrefix = endpoint.startsWith('/matches') ? '' : '/football';
  const url = new URL(`${baseUrl}${pathPrefix}${endpoint}`);

  if (method === 'GET') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  if (__DEV__) {
    console.log(`🔍 Football API Proxy Request [${method}]:`, url.toString());
  }

  // Check if we should skip this request due to recent rate limit
  if (shouldSkipDueToRateLimit(endpoint)) {
    const cached = rateLimitCache.get(endpoint);
    const remainingTime = cached ? Math.ceil((cached.retryAfter - (Date.now() - cached.timestamp)) / 1000) : 0;
    throw new ApiFootballError(
      `تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة مرة أخرى بعد ${remainingTime} ثانية.`,
      429
    );
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        if (__DEV__) {
          console.log(`🔄 Retry attempt ${attempt}/${retries} for ${endpoint}`);
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      const response = await withTimeout(
        fetch(url.toString(), {
          method,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        })
      );

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Not JSON
        }
        
        // Special handling for rate limit errors (429)
        if (response.status === 429) {
          // Calculate retry delay from Retry-After header if available
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : Math.min(60 * Math.pow(2, attempt), 300); // Max 5 minutes
          const retryDelay = retryAfterSeconds * 1000;
          
          // Cache this rate limit error
          cacheRateLimitError(endpoint, retryDelay);
          
          // If we have retries left, wait and retry
          if (attempt < retries) {
            logger.warn(`⏳ Rate limit hit (429). Waiting ${retryAfterSeconds}s before retry ${attempt + 1}/${retries}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue; // Retry the request
          } else {
            // All retries exhausted - throw user-friendly error
            throw new ApiFootballError(
              `تم تجاوز الحد الأقصى للطلبات. يرجى المحاولة مرة أخرى بعد ${retryAfterSeconds} ثانية.`,
              response.status
            );
          }
        }
        
        throw new ApiFootballError(
          `API request failed: ${response.status} ${errorMessage}`,
          response.status
        );
      }

      const data: ProxyResponse<T> = await response.json();

      if (data.status === 'ERROR') {
        throw new ApiFootballError(data.message || 'API returned errors');
      }

      if (__DEV__) {
        console.log(`✅ Football API Proxy Response: ${data.results} results`);
      }

      return data.response as T;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on non-timeout/rate-limit errors (like 4xx responses except 429)
      if (error instanceof ApiFootballError && error.statusCode && error.statusCode < 500 && error.statusCode !== 429) {
        throw error;
      }
      
      // Only retry on timeout, network errors, or rate limit errors (429)
      if (attempt === retries) {
        logger.error('❌ Football API Proxy Error (all retries failed):', error);
        throw error;
      }
    }
  }
  
  throw lastError || new ApiFootballError('Unknown error occurred');
};

export const ApiFootballService = {
  /**
   * Get all available leagues
   */
  async getLeagues(params: {
    country?: string;
    season?: number;
    current?: boolean;
  } = {}): Promise<League[]> {
    return fetchFromProxy<League[]>('/leagues', params);
  },

  /**
   * Get fixtures with filters
   * Uses backend permanent cache for optimal performance
   */
  async getFixtures(params: {
    live?: 'all' | string;
    date?: string;
    league?: number;
    season?: number;
    team?: number;
    last?: number;
    next?: number;
    from?: string;
    to?: string;
    status?: string;
    id?: number;
    ids?: string;
  } = {}): Promise<Fixture[]> {
    // For date-based queries, use the cached endpoint
    if (params.date && !params.live) {
      try {
        const fixtures = await fetchFromProxy<Fixture[]>(`/cached/matches/${params.date}`);
        // Local cache as backup
        if (fixtures?.length) {
          footballCacheService.cacheMatches(fixtures as any).catch(console.error);
        }
        return fixtures;
      } catch (error) {
        if (__DEV__) {
          console.warn('Cached endpoint failed, falling back to regular endpoint');
        }
      }
    }
    
    const fixtures = await fetchFromProxy<Fixture[]>('/fixtures', params);
    
    // Cache all fixtures and their related data
    if (fixtures?.length) {
      footballCacheService.cacheMatches(fixtures as any).catch(console.error);
    }
    
    return fixtures;
  },

  /**
   * Get specific fixtures by their IDs (DEPRECATED: Not supported on Free Plan)
   */
  async getFixturesByIds(ids: number[]): Promise<Fixture[]> {
    if (__DEV__) {
      console.warn('getFixturesByIds is not supported on the free plan. Returning empty array.');
    }
    return [];
  },

  /**
   * Get live fixtures
   */
  async getLiveFixtures(): Promise<Fixture[]> {
    return fetchFromProxy<Fixture[]>('/fixtures/live');
  },

  /**
   * Get fixtures by date
   */
  async getFixturesByDate(date: string): Promise<Fixture[]> {
    return this.getFixtures({ date });
  },

  /**
   * Get fixtures by league
   */
  async getFixturesByLeague(leagueId: number, season?: number): Promise<Fixture[]> {
    const currentSeason = 2024;
    return this.getFixtures({
      league: leagueId,
      season: season || currentSeason
    });
  },

  /**
   * Get major leagues fixtures (prioritized)
   */
  async getMajorLeaguesFixtures(date?: string): Promise<Fixture[]> {
    const majorLeagueIds = Object.values(MAJOR_LEAGUES);
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const fixtures = await this.getFixturesByDate(targetDate);
      return fixtures.filter(f => majorLeagueIds.includes(f.league.id));
    } catch (error) {
      if (__DEV__) {
        console.error('Error fetching major leagues fixtures:', error);
      }
      return [];
    }
  },


  /**
   * Get fixtures for the top 5 European leagues
   */
  async getTop5LeaguesFixtures(params: {
    date?: string;
    from?: string;
    to?: string;
    status?: string;
    season?: number;
  } = {}): Promise<Fixture[]> {
    const top5Leagues = [
      MAJOR_LEAGUES.PREMIER_LEAGUE,
      MAJOR_LEAGUES.LA_LIGA,
      MAJOR_LEAGUES.BUNDESLIGA,
      MAJOR_LEAGUES.SERIE_A,
      MAJOR_LEAGUES.LIGUE_1,
    ];

    const currentSeason = 2024;
    const season = params.season || currentSeason;
    const allFixtures: Fixture[] = [];

    try {
      for (const leagueId of top5Leagues) {
        try {
          const fixtures = await this.getFixtures({
            league: leagueId,
            season,
            ...params,
          });
          allFixtures.push(...fixtures);
        } catch (error) {
          if (__DEV__) {
            console.error(`Error fetching fixtures for league ${leagueId}:`, error);
          }
        }
      }

      allFixtures.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    } catch (error) {
      console.error('Error fetching top 5 leagues fixtures:', error);
    }

    return allFixtures;
  },

  /**
   * Get live fixtures from top 5 leagues
   */
  async getTop5LeaguesLive(): Promise<Fixture[]> {
    try {
      const liveFixtures = await this.getLiveFixtures();
      const top5Leagues = [
        MAJOR_LEAGUES.PREMIER_LEAGUE,
        MAJOR_LEAGUES.LA_LIGA,
        MAJOR_LEAGUES.BUNDESLIGA,
        MAJOR_LEAGUES.SERIE_A,
        MAJOR_LEAGUES.LIGUE_1,
      ];

      return liveFixtures.filter(f => top5Leagues.includes(f.league.id));
    } catch (error) {
      console.error('Error fetching live top 5 leagues fixtures:', error);
      return [];
    }
  },

  /**
   * Get upcoming fixtures
   */
  async getUpcomingFixtures(days: number = 7): Promise<Fixture[]> {
    // API-Football v3 requires a league or team for from/to ranges.
    // To get "ALL" fixtures, we must fetch day-by-day using the 'date' parameter.
    const today = new Date();
    const results: Fixture[] = [];

    // For better performance and to avoid multiple calls, we'll fetch day by day.
    // However, for the initial load, just bringing "today" and maybe "tomorrow" is ideal.
    const fetchDays = Math.min(days, 3); // Limit to 3 days for performance initially

    for (let i = 0; i < fetchDays; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      try {
        const fixtures = await this.getFixtures({
          date: dateStr,
        });
        results.push(...fixtures);
      } catch (error) {
        console.error(`Error fetching fixtures for ${dateStr}:`, error);
      }
    }

    return results;
  },

  /**
   * Search fixtures by team name (supports Arabic and English)
   */
  async searchFixtures(query: string, fixtures: Fixture[]): Promise<Fixture[]> {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return fixtures;

    return fixtures.filter(f =>
      f.teams.home.name.toLowerCase().includes(lowerQuery) ||
      f.teams.away.name.toLowerCase().includes(lowerQuery) ||
      f.league.name.toLowerCase().includes(lowerQuery) ||
      f.league.country.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Sort fixtures by priority (live > major leagues > upcoming > finished)
   */
  sortFixturesByPriority(fixtures: Fixture[]): Fixture[] {
    return fixtures.sort((a, b) => {
      const aIsLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(a.fixture.status.short);
      const bIsLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(b.fixture.status.short);

      if (aIsLive && !bIsLive) return -1;
      if (bIsLive && !aIsLive) return 1;

      const topLeagues = Object.values(MAJOR_LEAGUES);
      const aIsMajor = topLeagues.includes(a.league.id);
      const bIsMajor = topLeagues.includes(b.league.id);

      if (aIsMajor && !bIsMajor) return -1;
      if (bIsMajor && !aIsMajor) return 1;

      const aIsEuropean = [MAJOR_LEAGUES.CHAMPIONS_LEAGUE, MAJOR_LEAGUES.EUROPA_LEAGUE].includes(a.league.id);
      const bIsEuropean = [MAJOR_LEAGUES.CHAMPIONS_LEAGUE, MAJOR_LEAGUES.EUROPA_LEAGUE].includes(b.league.id);

      if (aIsEuropean && !bIsEuropean) return -1;
      if (bIsEuropean && !aIsEuropean) return 1;

      const aIsFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(a.fixture.status.short);
      const bIsFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(b.fixture.status.short);

      if (!aIsFinished && bIsFinished) return -1;
      if (!bIsFinished && aIsFinished) return 1;

      return a.fixture.timestamp - b.fixture.timestamp;
    });
  },

  /**
   * Get match minute for live matches
   */
  getMatchMinute(fixture: Fixture): string | null {
    const status = fixture.fixture.status.short;
    const elapsed = fixture.fixture.status.elapsed;

    if (!elapsed) return null;

    if (status === '1H') return `${elapsed}'`;
    if (status === 'HT') return 'استراحة';
    if (status === '2H') return `${elapsed}'`;
    if (status === 'ET') return `${elapsed}' (و.إ)`;
    if (status === 'BT') return 'استراحة (و.إ)';
    if (status === 'P') return 'ركلات ترجيح';

    return null;
  },


  /**
   * Get lineups for a specific fixture
   * ✅ Uses offline storage first (no token needed)
   * ✅ Falls back to backend cache
   */
  async getFixtureLineups(fixtureId: number): Promise<Lineup[]> {
    // ✅ 1. Check offline storage first (permanent, no token needed)
    const { offlineDataService } = await import('./offlineDataService');
    const offlineMatch = await offlineDataService.getFinishedMatch(fixtureId);
    if (offlineMatch?.lineups) {
      console.log(`📦 Lineups ${fixtureId} from offline storage`);
      return offlineMatch.lineups;
    }

    try {
      // ✅ 2. Use cached endpoint (permanent for finished matches)
      const lineups = await fetchFromProxy<Lineup[]>(`/cached/fixture/${fixtureId}/lineups`);
      
      // ✅ Store in offline storage if match is finished
      const fixture = await this.getFixtureById(fixtureId).catch(() => null);
      if (fixture && ['FT', 'AET', 'PEN'].includes(fixture.fixture.status.short)) {
        const stats = await this.getFixtureStatistics(fixtureId).catch(() => []);
        const events = await this.getFixtureEvents(fixtureId).catch(() => []);
        await offlineDataService.storeFinishedMatch(fixtureId, {
          fixture: fixture.fixture,
          lineups,
          statistics: stats,
          events,
          teams: fixture.teams,
          league: fixture.league,
          goals: fixture.goals,
          score: fixture.score,
        });
      }
      
      return lineups;
    } catch (error) {
      // Fallback to regular endpoint
      return fetchFromProxy<Lineup[]>(`/fixtures/${fixtureId}/lineups`);
    }
  },

  /**
   * Get team statistics for a specific fixture
   * Uses backend permanent cache for finished matches
   */
  async getFixtureStatistics(fixtureId: number): Promise<TeamStatistics[]> {
    try {
      // Use cached endpoint (permanent for finished matches)
      return await fetchFromProxy<TeamStatistics[]>(`/cached/fixture/${fixtureId}/statistics`);
    } catch (error) {
      // Fallback to regular endpoint
      return fetchFromProxy<TeamStatistics[]>(`/fixtures/${fixtureId}/statistics`);
    }
  },

  /**
   * Get last fixtures for a team
   */
  async getTeamLastFixtures(teamId: number, count: number = 5): Promise<TeamFixture[]> {
    try {
      const fixtures = await fetchFromProxy<TeamFixture[]>('/fixtures', {
        team: teamId,
        season: 2023,
        status: 'FT'
      });

      return fixtures
        .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
        .slice(0, count);
    } catch (error) {
      console.error('Error fetching team last fixtures:', error);
      return [];
    }
  },

  /**
   * Get a single fixture by ID
   * ✅ Uses offline storage first (no token needed)
   * ✅ Cached based on match status
   */
  async getFixtureById(fixtureId: number): Promise<Fixture | null> {
    // ✅ 1. Check offline storage first (permanent, no token needed)
    const { offlineDataService } = await import('./offlineDataService');
    const offlineMatch = await offlineDataService.getFinishedMatch(fixtureId);
    if (offlineMatch) {
      console.log(`📦 Match ${fixtureId} from offline storage`);
      // Convert to Fixture format
      return {
        fixture: offlineMatch.fixture,
        teams: offlineMatch.teams,
        league: offlineMatch.league,
        goals: offlineMatch.goals,
        score: offlineMatch.score,
      } as Fixture;
    }

    // ✅ 2. Try cache first
    const cached = await footballCacheService.getMatch(fixtureId);
    if (cached) {
      console.log(`📦 Match cache hit for ID ${fixtureId}`);
      return cached as Fixture;
    }
    
    try {
      const fixtures = await fetchFromProxy<Fixture[]>(`/fixtures/${fixtureId}`);
      const fixture = fixtures && fixtures.length > 0 ? fixtures[0] : null;
      
      // Cache the fixture
      if (fixture) {
        footballCacheService.cacheMatch(fixture as any).catch(console.error);
      }
      
      return fixture;
    } catch (error) {
      console.error('Error fetching fixture by ID:', error);
      return null;
    }
  },

  /**
   * Get match events (goals, cards, substitutions)
   * Uses backend permanent cache for finished matches
   */
  async getFixtureEvents(fixtureId: number): Promise<FixtureEvent[]> {
    try {
      // Use cached endpoint (permanent for finished matches)
      return await fetchFromProxy<FixtureEvent[]>(`/cached/fixture/${fixtureId}/events`);
    } catch (error) {
      // Fallback to regular endpoint
      return fetchFromProxy<FixtureEvent[]>(`/fixtures/${fixtureId}/events`);
    }
  },

  /**
   * Get head to head matches between two teams
   * Uses backend permanent cache
   */
  async getHeadToHead(team1Id: number, team2Id: number, count: number = 5): Promise<Fixture[]> {
    // Try local cache first
    const cached = await footballCacheService.getH2H(team1Id, team2Id);
    if (cached?.matches) {
      console.log(`📦 H2H local cache hit for teams ${team1Id} vs ${team2Id}`);
      return cached.matches;
    }
    
    try {
      // Use cached endpoint (permanent storage on backend)
      const result = await fetchFromProxy<any>('/cached/h2h', {
        team1: team1Id,
        team2: team2Id,
        count,
      });
      
      const fixtures = result?.response || result || [];
      
      // Local cache as backup
      if (fixtures?.length) {
        footballCacheService.cacheH2H(team1Id, team2Id, { matches: fixtures }).catch(console.error);
      }
      
      return fixtures;
    } catch (error) {
      console.error('Error fetching head to head:', error);
      return [];
    }
  },

  /**
   * Get standings for a specific league and season
   * Uses backend cache (1 hour TTL)
   */
  async getStandings(leagueId: number, season?: number): Promise<Standing[]> {
    const currentSeason = season || 2024;
    
    // Try local cache first
    const cached = await footballCacheService.getStandings(leagueId, currentSeason);
    if (cached) {
      console.log(`📦 Standings local cache hit for league ${leagueId}`);
      return cached;
    }
    
    try {
      // Use cached endpoint
      const standings = await fetchFromProxy<Standing[]>(`/cached/standings/${leagueId}`, {
        season: currentSeason,
      });
      
      // Local cache as backup
      if (standings?.length) {
        footballCacheService.cacheStandings(leagueId, currentSeason, standings).catch(console.error);
      }
      
      return standings;
    } catch (error) {
      console.error('Error fetching standings:', error);
      return [];
    }
  },

  // ============================================
  // PLAYER ENDPOINTS (Using Backend Permanent Cache)
  // ============================================

  /**
   * Get player by ID with statistics
   * ✅ Uses offline storage first (no token needed)
   * ✅ Falls back to backend cache
   * ✅ Stores permanently for future use
   * ✅ Always fetches with current season for real-time data
   */
  async getPlayerById(playerId: number, season?: number): Promise<any[]> {
    // ✅ Get current season if not provided
    const currentSeason = season || (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      return month >= 6 ? year : year - 1; // July+ = current year, before July = previous year
    })();

    // ✅ 1. Always fetch fresh from API for real-time data (skip cache for team info)
    // Cache is only used for player basic info, not team info
    try {
      // ✅ Use cached endpoint with current season (backend handles caching)
      const players = await fetchFromProxy<any[]>(`/cached/player/${playerId}`, { season: currentSeason });
      
      if (players?.length) {
        const playerData = players[0];
        
        // ✅ Validate player data has statistics
        if (!playerData.statistics || playerData.statistics.length === 0) {
          logger.warn(`⚠️ Player ${playerId} has no statistics for season ${currentSeason}`);
          // Try previous season as fallback
          const previousSeasonPlayers = await fetchFromProxy<any[]>(`/cached/player/${playerId}`, { season: currentSeason - 1 });
          if (previousSeasonPlayers?.length && previousSeasonPlayers[0].statistics?.length > 0) {
            logger.debug(`✅ Using previous season (${currentSeason - 1}) data for player ${playerId}`);
            return previousSeasonPlayers;
          }
        }
        
        // ✅ Store in both local cache and offline storage (permanent)
        const { offlineDataService } = await import('./offlineDataService');
        await Promise.all([
          footballCacheService.cachePlayer(playerData).catch(err => logger.warn('Cache error:', err)),
          offlineDataService.storePlayerData(playerId, playerData).catch(err => logger.warn('Offline storage error:', err)),
        ]);
        
        logger.debug(`💾 Stored player ${playerId} (season ${currentSeason}) permanently`);
        return players;
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching player:', error);
      
      // ✅ Fallback to offline storage if API fails
      const { offlineDataService } = await import('./offlineDataService');
      const offlinePlayer = await offlineDataService.getPlayerData(playerId);
      if (offlinePlayer) {
        logger.debug(`📦 Player ${playerId} from offline storage (API failed)`);
        return [offlinePlayer];
      }
      
      return [];
    }
  },

  /**
   * Search players by name
   */
  async searchPlayers(name: string): Promise<any[]> {
    try {
      return fetchFromProxy<any[]>('/players/search', { search: name });
    } catch (error) {
      console.error('Error searching players:', error);
      return [];
    }
  },

  // ============================================
  // TEAM ENDPOINTS (Using Backend Permanent Cache)
  // ============================================

  /**
   * Get team by ID
   * Uses backend permanent cache
   */
  async getTeamById(teamId: number): Promise<any[]> {
    // Try local cache first
    const cached = await footballCacheService.getTeam(teamId, undefined);
    if (cached) {
      console.log(`📦 Team local cache hit for ID ${teamId}`);
      return [cached];
    }
    
    try {
      // Use cached endpoint (permanent storage on backend)
      const teams = await fetchFromProxy<any[]>(`/cached/team/${teamId}`);
      
      // Local cache as backup
      if (teams?.length) {
        footballCacheService.cacheTeam(teams[0]).catch(console.error);
      }
      
      return teams;
    } catch (error) {
      console.error('Error fetching team:', error);
      return [];
    }
  },

  /**
   * Get team squad
   */
  async getTeamSquad(teamId: number): Promise<any[]> {
    try {
      return fetchFromProxy<any[]>(`/teams/${teamId}/squad`);
    } catch (error) {
      console.error('Error fetching team squad:', error);
      return [];
    }
  },

  /**
   * Get H2H with caching (uses optimized backend endpoint)
   * Uses backend permanent cache
   */
  async getH2HCached(team1Id: number, team2Id: number, count: number = 10): Promise<{
    summary: { totalMatches: number; team1Wins: number; team2Wins: number; draws: number };
    matches: Fixture[];
  }> {
    // Try local cache first
    const cached = await footballCacheService.getH2H(team1Id, team2Id);
    if (cached) {
      console.log(`📦 H2H local cache hit for teams ${team1Id} vs ${team2Id}`);
      return {
        summary: cached.summary || { totalMatches: 0, team1Wins: 0, team2Wins: 0, draws: 0 },
        matches: cached.matches || [],
      };
    }
    
    try {
      // Use cached endpoint (permanent storage on backend)
      const result = await fetchFromProxy<any>('/cached/h2h', {
        team1: team1Id,
        team2: team2Id,
        count,
      });
      
      const h2hData = {
        summary: result.summary || { totalMatches: 0, team1Wins: 0, team2Wins: 0, draws: 0 },
        matches: result.response || result.matches || [],
      };
      
      // Local cache as backup
      footballCacheService.cacheH2H(team1Id, team2Id, h2hData).catch(console.error);
      
      return h2hData;
    } catch (error) {
      console.error('Error fetching H2H cached:', error);
      return { summary: { totalMatches: 0, team1Wins: 0, team2Wins: 0, draws: 0 }, matches: [] };
    }
  },

  /**
   * Unified search across players, teams, leagues, and matches
   * Uses backend cache with local backup
   * Returns team matches when searching for a team
   * Matches are returned as { live: [], upcoming: [], finished: [] }
   */
  async unifiedSearch(query: string): Promise<{
    players: any[];
    teams: any[];
    leagues: any[];
    matches: {
      live: any[];
      upcoming: any[];
      finished: any[];
    };
  }> {
    const emptyResult = { 
      players: [], 
      teams: [], 
      leagues: [], 
      matches: { live: [], upcoming: [], finished: [] } 
    };

    if (!query || query.length < 2) {
      return emptyResult;
    }

    // Try local cache first
    const cached = await footballCacheService.getSearchResults(query);
    if (cached) {
      console.log(`📦 Search local cache hit for "${query}"`);
      // Handle both old format (flat array) and new format (object with live/upcoming/finished)
      let matches: { live: any[]; upcoming: any[]; finished: any[] };
      
      if (!cached.matches) {
        matches = { live: [], upcoming: [], finished: [] };
      } else if (Array.isArray(cached.matches)) {
        matches = { live: [], upcoming: [], finished: cached.matches };
      } else {
        matches = {
          live: Array.isArray(cached.matches.live) ? cached.matches.live : [],
          upcoming: Array.isArray(cached.matches.upcoming) ? cached.matches.upcoming : [],
          finished: Array.isArray(cached.matches.finished) ? cached.matches.finished : [],
        };
      }
      
      return {
        players: cached.players || [],
        teams: cached.teams || [],
        leagues: cached.leagues || [],
        matches,
      };
    }

    try {
      // Use cached endpoint - returns matches as { live, upcoming, finished }
      const result = await fetchFromProxy<any>('/cached/search', { q: query });
      
      // Safely extract and normalize matches format
      let rawMatches = result?.matches;
      let matches: { live: any[]; upcoming: any[]; finished: any[] };
      
      if (!rawMatches) {
        matches = { live: [], upcoming: [], finished: [] };
      } else if (Array.isArray(rawMatches)) {
        // Old format - convert to new format
        matches = { live: [], upcoming: [], finished: rawMatches };
      } else {
        // New format - ensure all arrays exist
        matches = {
          live: Array.isArray(rawMatches.live) ? rawMatches.live : [],
          upcoming: Array.isArray(rawMatches.upcoming) ? rawMatches.upcoming : [],
          finished: Array.isArray(rawMatches.finished) ? rawMatches.finished : [],
        };
      }
      
      const searchResults = {
        players: result?.players || [],
        teams: result?.teams || [],
        leagues: result?.leagues || [],
        matches,
      };

      // Local cache as backup
      footballCacheService.cacheSearchResults(query, searchResults).catch(console.error);

      return searchResults;
    } catch (error) {
      console.error('Error in unified search:', error);
      return emptyResult;
    }
  },

  /**
   * Get team matches (live, upcoming, finished)
   * Uses backend permanent cache
   */
  async getTeamMatches(teamId: number, count: number = 10): Promise<{
    live: Fixture[];
    upcoming: Fixture[];
    finished: Fixture[];
    team: any;
  }> {
    try {
      const result = await fetchFromProxy<any>(`/cached/team/${teamId}/matches`, { count });
      return result || { live: [], upcoming: [], finished: [], team: null };
    } catch (error) {
      console.error('Error fetching team matches:', error);
      return { live: [], upcoming: [], finished: [], team: null };
    }
  },

  /**
   * Get all leagues with caching
   * Uses backend permanent cache
   */
  async getAllLeagues(): Promise<any[]> {
    // Try local cache first
    const cacheKey = 'all_leagues';
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      console.log('📦 All leagues local cache hit');
      return cached;
    }
    
    try {
      const leagues = await fetchFromProxy<any[]>('/leagues/all');
      
      // Local cache for 7 days
      if (leagues?.length) {
        await cacheService.set(cacheKey, leagues, CACHE_TTL.LEAGUES);
        
        // Also cache individual leagues locally
        for (const league of leagues) {
          if (league?.id) {
            footballCacheService.cacheLeague(league).catch(console.error);
          }
        }
      }
      
      return leagues;
    } catch (error) {
      console.error('Error fetching all leagues:', error);
      return [];
    }
  },

  /**
   * Get backend cache statistics
   * Shows how much data is permanently stored on the server
   */
  async getCacheStats(): Promise<{
    fixtures: number;
    players: number;
    teams: number;
    leagues: number;
    h2h: number;
    memoryCache: {
      standings: number;
      lineups: number;
      statistics: number;
      events: number;
    };
  } | null> {
    try {
      const result = await fetchFromProxy<any>('/cached/stats');
      return result;
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      return null;
    }
  },

  /**
   * Favorite a match for push notifications
   */
  async favoriteMatch(matchId: number, matchData: any, token: string): Promise<boolean> {
    try {
      await fetchFromProxy(
        `/matches/favorite/${matchId}`,
        {},
        {
          method: 'POST',
          body: matchData,
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      return true;
    } catch (error) {
      console.error(`Error favoriting match ${matchId}:`, error);
      return false;
    }
  },

  /**
   * Unfavorite a match
   */
  async unfavoriteMatch(matchId: number, token: string): Promise<boolean> {
    try {
      await fetchFromProxy(
        `/matches/favorite/${matchId}`,
        {},
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      return true;
    } catch (error) {
      console.error(`Error unfavoriting match ${matchId}:`, error);
      return false;
    }
  },
};

export default ApiFootballService;


// Re-export cache service for external use
export { footballCacheService } from './footballCacheService';
