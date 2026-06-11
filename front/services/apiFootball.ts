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
 * - Circuit breaker pattern to prevent hammering server when down
 * - Request queue to limit concurrent requests (max 3)
 * - Exponential backoff retry strategy
 */

import { getApiUrl } from '../utils/getApiUrl';
import { footballCacheService } from './footballCacheService';
import { cacheService, CACHE_TTL } from './cacheService';
import { logger } from './logger';
import { circuitBreakerService } from './circuitBreaker.service';
import { requestQueueService } from './requestQueue.service';

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

// Singleton instance
export const apiFootballService = {
  /**
   * Search for teams
   */
  async searchTeams(query: string): Promise<any[]> {
    try {
      const response = await fetch(`${getApiUrl()}/football/teams?search=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.response || [];
    } catch (error) {
      logger.error('Failed to search teams:', error);
      return [];
    }
  },

  /**
   * Search for players
   */
  async searchPlayers(query: string): Promise<any[]> {
    try {
      const response = await fetch(`${getApiUrl()}/football/players?search=${encodeURIComponent(query)}`);
      const data = await response.json();
      return data.response || [];
    } catch (error) {
      logger.error('Failed to search players:', error);
      return [];
    }
  },

  // Add other existing methods here...
  async getAllLeagues() {
    try {
      const response = await fetch(`${getApiUrl()}/football/leagues/all`);
      const data = await response.json();
      return data.response || [];
    } catch (error) {
      logger.error('Failed to get all leagues:', error);
      return [];
    }
  },

  async unifiedSearch(query: string) {
    // Basic unified search implementation
    const [teams, players] = await Promise.all([
      this.searchTeams(query),
      this.searchPlayers(query)
    ]);
    return { teams, players, leagues: [], matches: { live: [], upcoming: [], finished: [] } };
  }
};

// Note: apiFootballService is exported as named export, not default
// The main ApiFootballService object is the default export at the end of the file

class ApiFootballError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiFootballError';
  }
}

/**
 * Helper function to check if an error is rate-limit related
 * This allows consistent detection of rate limit errors across the codebase
 */
export const isRateLimitError = (error: unknown): boolean => {
  if (error instanceof ApiFootballError) {
    return error.statusCode === 429;
  }
  if (error instanceof Error) {
    // Check for rate limit indicators in error message
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('rate_limit') ||
      message.includes('429') ||
      message.includes('تم تجاوز الحد الأقصى')
    );
  }
  return false;
};

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

export interface TopScorer {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    games: {
      appearances: number;
      lineups: number;
      minutes: number;
      position: string;
      rating: string;
      captain: boolean;
    };
    substitutes: {
      in: number;
      out: number;
      bench: number;
    };
    shots: {
      total: number;
      on: number;
    };
    goals: {
      total: number;
      conceded: number;
      assists: number;
      saves: number;
    };
    passes: {
      total: number;
      key: number;
      accuracy: number;
    };
    tackles: {
      total: number;
      blocks: number;
      interceptions: number;
    };
    duels: {
      total: number;
      won: number;
    };
    dribbles: {
      attempts: number;
      success: number;
      past: number;
    };
    fouls: {
      drawn: number;
      committed: number;
    };
    cards: {
      yellow: number;
      red: number;
    };
    penalty: {
      won: number;
      commited: number;
      scored: number;
      missed: number;
      saved: number;
    };
  }>;
}

export interface TopAssist {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    games: {
      appearances: number;
      lineups: number;
      minutes: number;
      position: string;
      rating: string;
      captain: boolean;
    };
    goals: {
      total: number;
      conceded: number;
      assists: number;
      saves: number;
    };
    passes: {
      total: number;
      key: number;
      accuracy: number;
    };
  }>;
}

export interface Injury {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
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
  type: string;
  reason: string;
}

export interface Transfer {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  update: string;
  league?: {
    id: number;
    name: string;
    logo: string;
  };
  transfers: Array<{
    date: string;
    type: string;
    teams: {
      in: {
        id: number;
        name: string;
        logo: string;
      } | null;
      out: {
        id: number;
        name: string;
        logo: string;
      } | null;
    };
  }>;
}

export interface TransfersByLeague {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  transfers: Transfer[];
}

export interface Trophy {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
  };
  season: string;
  place: string;
}

export interface Coach {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  age: number;
  birth: {
    date: string;
    place: string;
    country: string;
  };
  nationality: string;
  height: string;
  weight: string;
  photo: string;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  career: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    start: string;
    end: string | null;
  }>;
}

export interface Venue {
  id: number;
  name: string;
  address: string;
  city: string;
  country: string;
  capacity: number;
  surface: string;
  image: string;
}

export interface LeagueRound {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
  };
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
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
  };
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
 * Includes automatic retry on timeout with exponential backoff
 * Uses circuit breaker to prevent hammering server when down
 * Uses request queue to limit concurrent requests (max 3)
 */
const fetchFromProxy = async <T,>(
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
    // Return empty array instead of throwing error - rate limits are expected
    if (__DEV__) {
      const cached = rateLimitCache.get(endpoint);
      const remainingTime = cached ? Math.ceil((cached.retryAfter - (Date.now() - cached.timestamp)) / 1000) : 0;
      logger.debug(`⏸️ Rate limit active for ${endpoint}, will retry after ${remainingTime}s`);
    }
    // Return empty array/object matching expected type
    return [] as T;
  }

  // Create circuit breaker key based on endpoint
  const circuitKey = `football_api_${endpoint.split('/')[1] || 'default'}`;

  // Define the actual fetch function
  const fetchFn = async (): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          if (__DEV__) {
            console.log(`🔄 Retry attempt ${attempt}/${retries} for ${endpoint}`);
          }
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
          await new Promise(resolve => setTimeout(resolve, delay));
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
            
            // If we have retries left, wait and retry (silent)
            if (attempt < retries) {
              // Silent retry - don't log to avoid spamming console
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue; // Retry the request
            } else {
              // All retries exhausted - return empty array instead of throwing
              // This prevents error spam in console
              return [] as T;
            }
          }
          
          throw new ApiFootballError(
            `API request failed: ${response.status} ${errorMessage}`,
            response.status
          );
        }

        const data: ProxyResponse<T> = await response.json();

        if (data.status === 'ERROR') {
          const errorMessage = data.message || 'API returned errors';
          // Check if error message indicates rate limit
          if (errorMessage.toLowerCase().includes('rate limit') || 
              errorMessage.toLowerCase().includes('rate_limit') ||
              errorMessage.toLowerCase().includes('429') ||
              errorMessage.toLowerCase().includes('تم تجاوز الحد الأقصى')) {
            // Cache this rate limit error
            const retryDelay = 60 * 1000; // Default 1 minute
            cacheRateLimitError(endpoint, retryDelay);
            // Return empty array instead of throwing
            if (__DEV__) {
              logger.debug('⏸️ Rate limit error from backend, returning empty result');
            }
            return [] as T;
          }
          throw new ApiFootballError(errorMessage);
        }

        if (__DEV__) {
          console.log(`✅ Football API Proxy Response: ${data.results} results`);
        }

        return data.response as T;
      } catch (error) {
        lastError = error as Error;
        
        // Handle rate limit errors - return empty array instead of throwing
        if (isRateLimitError(error)) {
          if (attempt === retries) {
            // All retries exhausted - return empty array gracefully
            if (__DEV__) {
              logger.debug('⏸️ Rate limit encountered, returning empty result');
            }
            // Return empty array since we don't have context to fetch cached matches
            return [] as T;
          }
          // Continue to retry logic below for rate limit errors
        }
        
        // Don't retry on non-timeout/rate-limit errors (like 4xx responses except 429)
        if (error instanceof ApiFootballError && error.statusCode && error.statusCode < 500 && error.statusCode !== 429) {
          throw error;
        }
        
        // Only retry on timeout, network errors, or rate limit errors (429)
        if (attempt === retries) {
          // Only log actual errors (not rate limits) as errors
          if (!isRateLimitError(error)) {
            logger.error('❌ Football API Proxy Error (all retries failed):', error);
          }
          // For rate limit errors, return empty array instead of throwing
          if (isRateLimitError(error)) {
            return [] as T;
          }
          throw error;
        }
      }
    }
  
    // If we exit the loop without returning, throw the last error
    throw lastError || new Error('Request failed');
  };

  // Define fallback function that returns cached data
  const fallbackFn = async (): Promise<T> => {
    logger.debug(`[fetchFromProxy] Circuit open, trying to return cached data for ${endpoint}`);
    
    // Try to return stale cached data
    // This is a best-effort fallback - may not always have cached data
    return [] as T;
  };

  // Wrap with circuit breaker and request queue
  return requestQueueService.enqueue(
    () => circuitBreakerService.execute(circuitKey, fetchFn, fallbackFn),
    { priority: endpoint.includes('/cached/') ? 10 : 0 } // Prioritize cached endpoints
  );
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
   * ✅ Uses offline storage first
   * ✅ Falls back to /fixtures/players when lineups endpoint is empty
   */
  async getFixtureLineups(
    fixtureId: number,
    options?: { skipCache?: boolean },
  ): Promise<Lineup[]> {
    const { convertFixturePlayersToLineups, hasLineupData } = await import(
      '../utils/matchLineupsFallback'
    );

    const resolveFromDirect = async (): Promise<Lineup[]> => {
      let lineups = await fetchFromProxy<Lineup[]>(`/fixtures/${fixtureId}/lineups`);
      if (hasLineupData(lineups)) return lineups;

      try {
        const players = await fetchFromProxy<unknown[]>(`/fixtures/${fixtureId}/players`);
        const fromPlayers = convertFixturePlayersToLineups(players);
        if (hasLineupData(fromPlayers)) return fromPlayers;
      } catch {
        // players endpoint unavailable for this fixture
      }

      return lineups ?? [];
    };

    if (options?.skipCache) {
      return resolveFromDirect();
    }

    const { offlineDataService } = await import('./offlineDataService');
    const offlineMatch = await offlineDataService.getFinishedMatch(fixtureId);
    if (offlineMatch?.lineups && hasLineupData(offlineMatch.lineups)) {
      return offlineMatch.lineups;
    }

    try {
      const lineups = await fetchFromProxy<Lineup[]>(`/cached/fixture/${fixtureId}/lineups`);
      if (hasLineupData(lineups)) {
        return lineups;
      }
      return resolveFromDirect();
    } catch {
      return resolveFromDirect();
    }
  },

  /**
   * Get team statistics for a specific fixture
   * Uses backend permanent cache for finished matches
   */
  async getFixtureStatistics(
    fixtureId: number,
    options?: { skipCache?: boolean },
  ): Promise<TeamStatistics[]> {
    try {
      if (options?.skipCache) {
        return await fetchFromProxy<TeamStatistics[]>(`/fixtures/${fixtureId}/statistics`);
      }
      return await fetchFromProxy<TeamStatistics[]>(`/cached/fixture/${fixtureId}/statistics`);
    } catch (error) {
      return fetchFromProxy<TeamStatistics[]>(`/fixtures/${fixtureId}/statistics`);
    }
  },

  /**
   * Get last fixtures for a team in a specific league/season
   */
  async getTeamLastFixtures(
    teamId: number,
    count: number = 5,
    options?: { leagueId?: number; season?: number },
  ): Promise<TeamFixture[]> {
    try {
      const season = options?.season ?? new Date().getFullYear();
      const params: Record<string, string | number> = {
        team: teamId,
        season,
        status: 'FT',
        last: count,
      };
      if (options?.leagueId) {
        params.league = options.leagueId;
      }

      const fixtures = await fetchFromProxy<TeamFixture[]>('/fixtures', params);

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
  async getFixtureById(fixtureId: number, options?: { skipCache?: boolean }): Promise<Fixture | null> {
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

    // ✅ 2. Try cache first (skip during live polling for fresh scores)
    if (!options?.skipCache) {
      const cached = await footballCacheService.getMatch(fixtureId);
      if (cached) {
        console.log(`📦 Match cache hit for ID ${fixtureId}`);
        return cached as Fixture;
      }
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
   * Full match details in one request — fixture, lineups, stats, events, venue.
   */
  async getFixtureDetailsBundle(
    fixtureId: number,
    options?: { skipCache?: boolean },
  ): Promise<{
    fixture: Fixture | null;
    lineups: Lineup[];
    statistics: TeamStatistics[];
    events: FixtureEvent[];
    venue: Venue | null;
  }> {
    try {
      if (options?.skipCache) {
        const [fixture, lineups, statistics, events] = await Promise.all([
          this.getFixtureById(fixtureId, { skipCache: true }),
          this.getFixtureLineups(fixtureId, { skipCache: true }),
          this.getFixtureStatistics(fixtureId, { skipCache: true }),
          this.getFixtureEvents(fixtureId),
        ]);
        let venue: Venue | null = (fixture?.fixture?.venue as Venue) ?? null;
        if (venue?.id) {
          venue = (await this.getVenueInfo(venue.id)) ?? venue;
        }
        return {
          fixture,
          lineups: lineups ?? [],
          statistics: statistics ?? [],
          events: events ?? [],
          venue,
        };
      }

      const raw = await fetchFromProxy<any>(`/cached/fixture/${fixtureId}/details`);
      const bundle = raw?.response ?? raw;
      return {
        fixture: bundle?.fixture ?? null,
        lineups: bundle?.lineups ?? [],
        statistics: bundle?.statistics ?? [],
        events: bundle?.events ?? [],
        venue: bundle?.venue ?? null,
      };
    } catch (error) {
      logger.warn('Fixture details bundle failed, falling back to parallel fetch:', error);
      const [fixture, lineups, statistics, events] = await Promise.all([
        this.getFixtureById(fixtureId, options),
        this.getFixtureLineups(fixtureId, options),
        this.getFixtureStatistics(fixtureId, options),
        this.getFixtureEvents(fixtureId),
      ]);
      let venue: Venue | null = (fixture?.fixture?.venue as Venue) ?? null;
      if (venue?.id) {
        venue = (await this.getVenueInfo(venue.id)) ?? venue;
      }
      return {
        fixture,
        lineups: lineups ?? [],
        statistics: statistics ?? [],
        events: events ?? [],
        venue,
      };
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
   * Get standings for a specific league and season (flat list).
   * Uses backend cache (1 hour TTL)
   */
  async getStandings(leagueId: number, season?: number): Promise<Standing[]> {
    const result = await this.getLeagueStandingsGrouped(leagueId, season);
    return result.groups.flatMap((g) => g.standings);
  },

  /**
   * Get standings preserving groups/tiers; tries multiple seasons when empty.
   */
  async getLeagueStandingsGrouped(
    leagueId: number,
    season?: number,
  ): Promise<{ groups: import('../utils/standingsHelpers').StandingsGroup[]; season: number; available: boolean }> {
    const {
      standingsSeasonCandidates,
      normalizeStandingsGroups,
      getCurrentFootballSeason,
    } = await import('../utils/standingsHelpers');

    for (const trySeason of standingsSeasonCandidates(season)) {
      const cached = await footballCacheService.getStandings(leagueId, trySeason);
      if (cached?.length) {
        return {
          groups: [{ group: 'Table', standings: cached }],
          season: trySeason,
          available: true,
        };
      }

      try {
        const payload = await this.fetchStandingsCachePayload(leagueId, trySeason);
        const groups = normalizeStandingsGroups(payload.groups, payload.flat);
        if (groups.length > 0) {
          if (payload.flat.length) {
            footballCacheService
              .cacheStandings(leagueId, trySeason, payload.flat)
              .catch(console.error);
          }
          return { groups, season: trySeason, available: true };
        }
      } catch (error) {
        console.error(`Error fetching standings for league ${leagueId} season ${trySeason}:`, error);
      }
    }

    return {
      groups: [],
      season: season ?? getCurrentFootballSeason(),
      available: false,
    };
  },

  async fetchStandingsCachePayload(
    leagueId: number,
    season: number,
  ): Promise<{
    flat: Standing[];
    groups: import('../utils/standingsHelpers').StandingsGroup[];
  }> {
    const baseUrl = getApiUrl();
    const url = new URL(`${baseUrl}/football/cached/standings/${leagueId}`);
    url.searchParams.set('season', String(season));

    const response = await withTimeout(
      fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      }),
    );

    if (!response.ok) {
      return { flat: [], groups: [] };
    }

    const data = (await response.json()) as {
      response?: Standing[];
      groups?: import('../utils/standingsHelpers').StandingsGroup[];
    };

    return {
      flat: data.response ?? [],
      groups: data.groups ?? [],
    };
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
   * Handles 404 errors gracefully with placeholder data
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
    } catch (error: any) {
      // Handle 404 gracefully - return placeholder team
      if (error instanceof ApiFootballError && error.statusCode === 404) {
        logger.warn(`⚠️ Team ${teamId} not found (404), returning placeholder`);
        return [{
          team: {
            id: teamId,
            name: 'Unknown Team',
            logo: null, // ✅ Return null instead of placeholder URL
            country: 'Unknown',
            founded: null,
            national: false,
          },
          venue: {
            id: null,
            name: 'Unknown',
            address: null,
            city: null,
            capacity: null,
            surface: null,
            image: null,
          }
        }];
      }
      
      console.error('Error fetching team:', error);
      return [];
    }
  },

  /**
   * Get the top 5 clubs for a country, backed by `cached_teams` on the
   * server (refreshed at most once every 7 days per country). Used by the
   * club-picker modal so users can choose real clubs from API-Football
   * with their actual logos instead of static fictional placeholders.
   */
  async getTopClubsByCountry(country: string, forceRefresh = false): Promise<{
    teamId: number;
    name: string;
    logo: string | null;
    country: string;
    founded: number | null;
    venueName: string | null;
  }[]> {
    try {
      // ✅ Direct fetch instead of fetchFromProxy because the response shape
      // uses { status, results, response: { clubs } } which fetchFromProxy
      // unwraps to the inner object. We need to handle both the old cached
      // shape (data field) and the new shape (response field) gracefully.
      const baseUrl = getApiUrl();
      const url = `${baseUrl}/football/teams/top-by-country?country=${encodeURIComponent(country)}${forceRefresh ? '&refresh=true' : ''}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        logger.error(`[getTopClubsByCountry] HTTP ${res.status}`);
        return [];
      }
      const json = await res.json();
      // Handle both shapes: { response: { clubs } } and { data: { clubs } }
      const clubs = json?.response?.clubs ?? json?.data?.clubs ?? [];
      return Array.isArray(clubs) ? clubs : [];
    } catch (error) {
      logger.error('[getTopClubsByCountry] Failed:', error);
      return [];
    }
  },

  /**
   * Get the list of countries the club-picker supports out of the box.
   */
  async getTopSupportedCountries(): Promise<string[]> {
    try {
      const result = await fetchFromProxy<{ countries: string[]; count: number }>(
        '/teams/top-supported-countries',
      );
      return Array.isArray(result?.countries) ? result.countries : [];
    } catch (error) {
      logger.error('[getTopSupportedCountries] Failed:', error);
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

  // ============================================
  // NEW FEATURES - Team Statistics
  // ============================================

  /**
   * Get team statistics for a league and season
   */
  async getTeamStatistics(teamId: number, leagueId: number, season?: number): Promise<any> {
    const currentSeason = season || 2024;
    try {
      const result = await fetchFromProxy<any>(`/teams/${teamId}/statistics`, {
        league: leagueId,
        season: currentSeason,
      });
      return result?.response || result || null;
    } catch (error) {
      console.error('Error fetching team statistics:', error);
      return null;
    }
  },

  // ============================================
  // NEW FEATURES - Top Scorers & Assists
  // ============================================

  /**
   * Get top scorers for a league
   */
  async getTopScorers(leagueId: number, season?: number): Promise<TopScorer[]> {
    const currentSeason = season || 2024;
    try {
      const result = await fetchFromProxy<TopScorer[]>('/players/top/scorers', {
        league: leagueId,
        season: currentSeason,
      });
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching top scorers:', error);
      return [];
    }
  },

  /**
   * Get top assists/playmakers for a league
   */
  async getTopAssists(leagueId: number, season?: number): Promise<TopAssist[]> {
    const currentSeason = season || 2024;
    try {
      const result = await fetchFromProxy<TopAssist[]>('/players/top/assists', {
        league: leagueId,
        season: currentSeason,
      });
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching top assists:', error);
      return [];
    }
  },

  // ============================================
  // NEW FEATURES - Injuries
  // ============================================

  /**
   * Get team injuries
   */
  async getTeamInjuries(teamId: number): Promise<Injury[]> {
    try {
      const result = await fetchFromProxy<Injury[]>(`/teams/${teamId}/injuries`);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching team injuries:', error);
      return [];
    }
  },

  // ============================================
  // NEW FEATURES - Transfers
  // ============================================

  /**
   * Get transfers
   * Note: This endpoint may not be available in all API-Football plans
   */
  async getTransfers(params: { team?: number; player?: number; date?: string; from?: string; to?: string }): Promise<Transfer[]> {
    try {
      const queryParams: Record<string, any> = {};
      if (params.team) queryParams.team = params.team;
      if (params.player) queryParams.player = params.player;
      if (params.date) queryParams.date = params.date;
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;

      const result = await fetchFromProxy<Transfer[]>('/transfers', queryParams);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      // Silently handle 404 errors - transfers endpoint may not be available
      if (error instanceof ApiFootballError && error.statusCode === 404) {
        if (__DEV__) {
          logger.debug('Transfers endpoint not available (404) - returning empty array');
        }
        return [];
      }
      
      // Log other errors only in dev mode
      if (__DEV__) {
        logger.warn('Error fetching transfers:', error);
      }
      return [];
    }
  },

  /**
   * Get transfers by date range
   */
  async getTransfersByDateRange(dateRange: { from: string; to: string }): Promise<Transfer[]> {
    try {
      const result = await fetchFromProxy<Transfer[]>('/transfers', {
        from: dateRange.from,
        to: dateRange.to,
      });
      return Array.isArray(result) ? result : [];
    } catch (error) {
      if (__DEV__) {
        logger.warn('Error fetching transfers by date range:', error);
      }
      return [];
    }
  },

  /**
   * Get transfers by leagues with optional date range
   * Fetches transfers for all teams in specified leagues
   */
  async getTransfersByLeagues(params: { 
    leagues?: number[]; 
    dateRange?: { from: string; to: string } 
  }): Promise<TransfersByLeague[]> {
    try {
      const queryParams: Record<string, any> = {};
      if (params.leagues && params.leagues.length > 0) {
        queryParams.leagues = params.leagues.join(',');
      }
      if (params.dateRange) {
        queryParams.from = params.dateRange.from;
        queryParams.to = params.dateRange.to;
      }

      const result = await fetchFromProxy<TransfersByLeague[]>('/transfers/by-leagues', queryParams);
      if (__DEV__) {
        console.log('📦 Transfers by leagues result:', result?.length || 0, 'leagues');
        if (result && result.length > 0) {
          const totalTransfers = result.reduce((sum, league) => sum + (league.transfers?.length || 0), 0);
          console.log('📦 Total transfers:', totalTransfers);
        }
      }
      return Array.isArray(result) ? result : [];
    } catch (error) {
      if (__DEV__) {
        logger.warn('Error fetching transfers by leagues:', error);
      }
      return [];
    }
  },

  // ============================================
  // NEW FEATURES - Trophies
  // ============================================

  /**
   * Get team trophies
   */
  async getTeamTrophies(teamId: number): Promise<Trophy[]> {
    try {
      const result = await fetchFromProxy<Trophy[]>(`/teams/${teamId}/trophies`);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching team trophies:', error);
      return [];
    }
  },

  // ============================================
  // NEW FEATURES - Coaches
  // ============================================

  /**
   * Get team coaches
   */
  async getTeamCoaches(teamId: number): Promise<Coach[]> {
    try {
      const result = await fetchFromProxy<Coach[]>(`/teams/${teamId}/coaches`);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching team coaches:', error);
      return [];
    }
  },

  // ============================================
  // NEW FEATURES - Venues
  // ============================================

  /**
   * Get venue/stadium information
   */
  async getVenueInfo(venueId: number): Promise<Venue | null> {
    try {
      const result = await fetchFromProxy<Venue>(`/venues/${venueId}`);
      return result || null;
    } catch (error) {
      console.error('Error fetching venue info:', error);
      return null;
    }
  },

  // ============================================
  // NEW FEATURES - Rounds
  // ============================================

  /**
   * Get league rounds
   */
  async getLeagueRounds(leagueId: number, season?: number, current?: boolean): Promise<string[]> {
    const currentSeason = season || 2024;
    try {
      const params: Record<string, any> = {
        league: leagueId,
        season: currentSeason,
      };
      if (current !== undefined) params.current = current;

      const result = await fetchFromProxy<string[]>('/fixtures/rounds', params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching league rounds:', error);
      return [];
    }
  },
};

export default ApiFootballService;


// Re-export cache service for external use
export { footballCacheService } from './footballCacheService';
