/**
 * Football API Service
 * Proxies requests to API-Football v3 with caching and rate limiting
 * Documentation: https://www.api-football.com/documentation-v3
 */

import { logger } from '../utils/logger';
import { getRedisClient } from '../lib/redis';
import { convertFixturePlayersToLineups, hasLineupData } from '../utils/lineups-fallback';

interface ApiResponse<T> {
  get: string;
  parameters: Record<string, any>;
  errors: any[] | Record<string, any>;
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Cache TTL values in milliseconds
// ✅ OPTIMIZED for Free Plan (100 requests/day): Aggressive caching
const CACHE_TTL = {
  // Live matches: 8 seconds. Matches the UI poll cadence so the elapsed
  // minute and live score stay within ~8s of API-Football. Upstream calls
  // are still throttled by the route-level shared cache and the rate
  // limiter below.
  LIVE: 8 * 1000,
  SHORT: 30 * 60 * 1000,              // 30 minutes for upcoming matches
  MEDIUM: 2 * 60 * 60 * 1000,         // 2 hours for standings, stats
  LONG: 7 * 24 * 60 * 60 * 1000,      // 7 days for teams, leagues, players
  PERMANENT: 30 * 24 * 60 * 60 * 1000, // 30 days for finished matches, logos
};

class FootballApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'FootballApiError';
  }
}

// Circuit breaker for 429 Too Many Requests: once we hit the daily quota,
// stop making API calls for a cool-down window instead of burning retries.
let quotaExhaustedUntil = 0;
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const QUOTA_COOLDOWN_RETRY_AFTER_MS = 10 * 60 * 1000; // if Retry-After not present, guess 10 min

function isQuotaExhausted(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

function markQuotaExhausted(retryAfterSec?: number): void {
  const coolMs = retryAfterSec ? retryAfterSec * 1000 : QUOTA_COOLDOWN_MS;
  quotaExhaustedUntil = Date.now() + coolMs;
}

class FootballService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://v3.football.api-sports.io';
  private readonly timeout = 20000; // 20s (was 15s — api-football can be slow)

  // ✅ OPTIMIZED: Use Redis for persistent caching across server restarts
  // Fallback to in-memory cache if Redis is unavailable
  private memoryCache = new Map<string, CacheEntry>();
  private useRedis = true; // Flag to disable Redis if connection fails

  // Rate limiting: 300 requests per minute for Pro plan
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 300;
  private readonly windowMs = 60 * 1000;
  private readonly minDelay = 200; // 200ms between requests (Pro plan)
  private lastRequestTime = 0;

  // Pro Plan allows any date range
  private readonly isPro = true;

  constructor() {
    const apiKey = process.env.FOOTBALL_API_KEY;
    if (!apiKey) {
      logger.warn('⚠️ FOOTBALL_API_KEY not set. Football API features will be disabled.');
    }
    this.apiKey = apiKey || '';
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Check if a date is within the allowed range
   * Pro Plan allows any date
   */
  isDateAllowed(dateStr: string): boolean {
    // Pro plan allows any date
    if (this.isPro) {
      return true;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const requestDate = new Date(dateStr);
    requestDate.setHours(0, 0, 0, 0);

    const diffDays = Math.abs(Math.floor((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return diffDays <= 1;
  }

  /**
   * Get the allowed date range
   * Pro Plan: Up to 1 year of historical data
   */
  getAllowedDateRange(): { from: string; to: string } {
    const today = new Date();
    const from = new Date(today);
    const to = new Date(today);

    // Pro plan: 1 year back, 1 month forward
    if (this.isPro) {
      from.setFullYear(from.getFullYear() - 1);
      to.setMonth(to.getMonth() + 1);
    } else {
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() + 1);
    }

    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }


  /**
   * Rate limiting check and wait
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset window if needed
    if (now - this.windowStart >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Wait if rate limit reached
    if (this.requestCount >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.windowStart);
      logger.info(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await this.sleep(waitTime);
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    // Ensure minimum delay between requests (increased for better rate limit compliance)
    const timeSinceLastRequest = now - this.lastRequestTime;
    const requiredDelay = this.minDelay;
    if (timeSinceLastRequest < requiredDelay && this.lastRequestTime > 0) {
      await this.sleep(requiredDelay - timeSinceLastRequest);
    }
  }

  /**
   * Get data from cache (Redis first, then memory fallback)
   * ✅ OPTIMIZED: Persistent caching with Redis
   */
  private async getCachedData(key: string): Promise<any | null> {
    try {
      // Try Redis first
      if (this.useRedis) {
        const redis = getRedisClient();
        if (redis) {
          const cached = await redis.get(`football:${key}`);
          if (cached) {
            logger.debug('📦 Redis cache hit:', key);
            return JSON.parse(cached);
          }
        } else {
          this.useRedis = false;
        }
      }
    } catch (error) {
      logger.warn('Redis cache read failed, using memory cache:', error);
      this.useRedis = false; // Disable Redis temporarily
    }

    // Fallback to memory cache
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached) {
      const now = Date.now();
      if (now - memoryCached.timestamp < 60000) { // 1 minute memory cache
        logger.debug('📦 Memory cache hit:', key);
        return memoryCached.data;
      }
      this.memoryCache.delete(key);
    }

    return null;
  }

  /**
   * Set data in cache (Redis + memory)
   * ✅ OPTIMIZED: Dual-layer caching
   */
  private async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    try {
      // Save to Redis with TTL
      if (this.useRedis) {
        const redis = getRedisClient();
        if (redis) {
          await redis.setex(
            `football:${key}`,
            Math.floor(ttl / 1000), // Convert to seconds
            JSON.stringify(data)
          );
          logger.debug('💾 Saved to Redis cache:', key);
        } else {
          this.useRedis = false;
        }
      }
    } catch (error) {
      logger.warn('Redis cache write failed:', error);
      this.useRedis = false;
    }

    // Also save to memory cache as backup (with shorter TTL)
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Check if data exists in cache
   */
  private async hasCachedData(key: string): Promise<boolean> {
    const data = await this.getCachedData(key);
    return data !== null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine cache TTL based on endpoint and match status
   * ✅ OPTIMIZED for Free Plan: Aggressive caching to minimize API calls
   */
  private getCacheTTL(endpoint: string, params: Record<string, any>): number {
    // Live data: 2 minutes (reduced from 30s to save quota)
    if (params.live || endpoint.includes('/fixtures/events')) {
      return CACHE_TTL.LIVE;
    }
    
    // Match statistics during live matches: 2 minutes
    if (endpoint.includes('/fixtures/statistics') && params.fixture) {
      return CACHE_TTL.LIVE;
    }
    
    // Finished matches: 30 days (never change)
    if (params.status && ['FT', 'AET', 'PEN'].includes(params.status)) {
      return CACHE_TTL.PERMANENT;
    }
    
    // Upcoming matches: 30 minutes (increased from 5 minutes)
    if (endpoint.includes('/fixtures')) {
      return CACHE_TTL.SHORT;
    }
    
    // Standings: 2 hours (increased from 30 minutes)
    if (endpoint.includes('/standings')) {
      return CACHE_TTL.MEDIUM;
    }
    
    // Teams, leagues, players: 7 days (increased from 24 hours)
    if (endpoint.includes('/teams') || endpoint.includes('/leagues') || endpoint.includes('/players')) {
      return CACHE_TTL.LONG;
    }
    
    // Default: 30 minutes (increased from 5 minutes)
    return CACHE_TTL.SHORT;
  }

  /**
   * Validate search query for API-Football
   * API-Football search field may only contain alpha-numeric characters and spaces.
   * It also usually requires at least 3-4 characters.
   */
  private isValidSearch(query: string): boolean {
    if (!query || query.length < 3) return false;

    // Check for alpha-numeric + spaces (latin only)
    // This prevents 500 errors when users search with Arabic or special characters
    const latinAlphaNumeric = /^[a-zA-Z0-9 ]+$/;
    return latinAlphaNumeric.test(query);
  }

  /**
   * Fetch data from API-Football with Redis caching and rate limiting
   * ✅ OPTIMIZED: Redis-backed caching for better performance
   */
  async fetchFromApi<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new FootballApiError('Football API not configured');
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add params to URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });

    const cacheKey = url.pathname + url.search;
    const ttl = this.getCacheTTL(endpoint, params);

    // ✅ Check Redis cache first
    const cached = await this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    // ✅ If we already hit the daily quota, skip the API entirely and return
    // an empty array so upstream code uses the DB fallback instead of burning
    // retries and producing cascading 429 errors in the logs.
    if (isQuotaExhausted()) {
      logger.debug(`⏭️  Skipping API call (quota exhausted until ${new Date(quotaExhaustedUntil).toISOString()}): ${cacheKey}`);
      // Short TTL so we don't poison the cache with empty results once the quota resets
      await this.setCachedData(cacheKey, [], 5 * 60 * 1000);
      return [] as T;
    }

    // Rate limit check
    await this.checkRateLimit();

    logger.debug('🔍 Football API Request:', cacheKey);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-apisports-key': this.apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.requestCount++;
      this.lastRequestTime = Date.now();

      if (!response.ok) {
        // 429 → trip the circuit breaker so we stop burning retries for the day
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;
          markQuotaExhausted(isNaN(retryAfterSec as number) ? undefined : retryAfterSec);
          logger.warn(`⚠️ API-Football 429 Too Many Requests — pausing outbound calls until ${new Date(quotaExhaustedUntil).toISOString()}`);
          // Cache empty so upstream returns a usable value instead of throwing
          await this.setCachedData(cacheKey, [], 5 * 60 * 1000);
          return [] as T;
        }

        throw new FootballApiError(
          `API request failed: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json() as ApiResponse<T>;

      if (data.errors && Object.keys(data.errors).length > 0) {
        // Check if it's a Free Plan date restriction error
        const errorMessage = (data.errors as any).plan || (data.errors as any).message || '';
        if (typeof errorMessage === 'string' && errorMessage.includes('Free plans do not have access')) {
          logger.debug('📅 Free Plan date restriction:', errorMessage);
          // Return empty array for date restrictions instead of throwing error
          await this.setCachedData(cacheKey, [], ttl);
          return [] as T;
        }

        logger.error('❌ Football API Errors:', data.errors);

        if ((data.errors as any).rateLimit) {
          throw new FootballApiError('Rate limit exceeded. Please wait a moment.');
        }

        // Log the full error for debugging
        logger.error('❌ Football API full error object:', JSON.stringify(data.errors));
        throw new FootballApiError(`API returned errors: ${JSON.stringify(data.errors)}`);
      }

      logger.debug(`✅ Football API Response: ${data.results} results`);

      // ✅ Save to Redis cache
      await this.setCachedData(cacheKey, data.response, ttl);

      return data.response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new FootballApiError('Request timed out');
      }
      logger.error('❌ Football API Error:', error);
      throw error;
    }
  }


  /**
   * Get all available leagues
   */
  async getLeagues(params: {
    country?: string;
    season?: number;
    current?: boolean;
  } = {}): Promise<any[]> {
    return this.fetchFromApi<any[]>('/leagues', params);
  }

  /**
   * Get fixtures with filters
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
  } = {}): Promise<any[]> {
    return this.fetchFromApi<any[]>('/fixtures', params);
  }

  /**
   * Get live fixtures
   */
  async getLiveFixtures(): Promise<any[]> {
    return this.getFixtures({ live: 'all' });
  }

  /**
   * Get a single fixture by ID
   */
  async getFixtureById(fixtureId: number): Promise<any | null> {
    const fixtures = await this.getFixtures({ id: fixtureId });
    return fixtures && fixtures.length > 0 ? fixtures[0] : null;
  }

  /**
   * Get standings for a specific league and season
   */
  async getStandings(leagueId: number, season?: number): Promise<any[]> {
    const currentSeason = season || 2024;
    const params = {
      league: leagueId,
      season: currentSeason,
    };

    try {
      const response = await this.fetchFromApi<any[]>('/standings', params);
      if (response && response.length > 0 && response[0].league && response[0].league.standings) {
        return response[0].league.standings.flat();
      }
      return [];
    } catch (error) {
      logger.error('Error fetching standings:', error);
      return [];
    }
  }

  /**
   * Get head to head matches between two teams
   */
  async getHeadToHead(team1Id: number, team2Id: number, count: number = 5): Promise<any[]> {
    try {
      const fixtures = await this.fetchFromApi<any[]>('/fixtures/headtohead', {
        h2h: `${team1Id}-${team2Id}`,
      });

      return fixtures
        .sort((a: any, b: any) => b.fixture.timestamp - a.fixture.timestamp)
        .slice(0, count);
    } catch (error) {
      logger.error('Error fetching head to head:', error);
      return [];
    }
  }

  /**
   * Get lineups for a specific fixture
   */
  async getFixtureLineups(fixtureId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/fixtures/lineups', { fixture: fixtureId });
  }

  /**
   * Player-level match data — often populated when /fixtures/lineups is empty.
   */
  async getFixturePlayers(fixtureId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/fixtures/players', { fixture: fixtureId });
  }

  /**
   * Lineups with /fixtures/players fallback for lower-tier leagues.
   */
  async getFixtureLineupsResolved(fixtureId: number): Promise<any[]> {
    const primary = await this.getFixtureLineups(fixtureId);
    if (hasLineupData(primary)) return primary;

    try {
      const players = await this.getFixturePlayers(fixtureId);
      const fromPlayers = convertFixturePlayersToLineups(players);
      if (hasLineupData(fromPlayers)) {
        logger.info(`[Lineups] Fixture ${fixtureId}: using /fixtures/players fallback`);
        return fromPlayers as any[];
      }
    } catch (err) {
      logger.debug(`[Lineups] Fixture ${fixtureId}: players fallback failed`, err);
    }

    return primary ?? [];
  }

  /**
   * Get team statistics for a specific fixture
   */
  async getFixtureStatistics(fixtureId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/fixtures/statistics', { fixture: fixtureId });
  }

  /**
   * Get match events (goals, cards, substitutions)
   */
  async getFixtureEvents(fixtureId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/fixtures/events', { fixture: fixtureId });
  }

  /**
   * Clear cache (useful for testing)
   * ✅ OPTIMIZED: Clear both Redis and memory cache
   */
  async clearCache(): Promise<void> {
    try {
      // Clear Redis cache (all football keys)
      if (this.useRedis) {
        const redis = getRedisClient();
        if (redis) {
          const keys = await redis.keys('football:*');
          if (keys.length > 0) {
            await redis.del(...keys);
            logger.info(`🗑️ Cleared ${keys.length} Redis cache entries`);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to clear Redis cache:', error);
    }

    // Clear memory cache
    this.memoryCache.clear();
    logger.info('🗑️ Cleared memory cache');
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { requestCount: number; windowStart: number; maxRequests: number } {
    return {
      requestCount: this.requestCount,
      windowStart: this.windowStart,
      maxRequests: this.maxRequests,
    };
  }

  // ============================================
  // PLAYER ENDPOINTS
  // ============================================

  /**
   * Get player info by ID
   * ✅ Always uses current season if not specified for real-time data
   */
  async getPlayerById(playerId: number, season?: number): Promise<any[]> {
    // ✅ Get current season if not provided
    const currentSeason = season || (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      return month >= 6 ? year : year - 1; // July+ = current year, before July = previous year
    })();
    
    return this.fetchFromApi<any[]>('/players', {
      id: playerId,
      season: currentSeason
    });
  }

  /**
   * Get player statistics
   */
  async getPlayerStatistics(playerId: number, season?: number): Promise<any[]> {
    const currentSeason = season || 2024;
    return this.fetchFromApi<any[]>('/players', {
      id: playerId,
      season: currentSeason,
    });
  }

  /** API-Football requires `league` or `team` (plus `season`) when using `search` on /players. */
  private static readonly PLAYER_SEARCH_LEAGUE_IDS = [
    39, 140, 135, 78, 61, 2, 3, 88, 94, 203, 253, 307, // top leagues + Saudi
  ];

  private currentSeason(): number {
    const now = new Date();
    const year = now.getUTCFullYear();
    return now.getUTCMonth() >= 6 ? year : year - 1;
  }

  /**
   * Search players by name (API requires league or team + season with search).
   */
  async searchPlayers(name: string, league?: number, team?: number): Promise<any[]> {
    if (!this.isValidSearch(name)) return [];
    const season = this.currentSeason();

    if (team) {
      try {
        const byTeam = await this.fetchFromApi<any[]>('/players', {
          search: name,
          team,
          season,
        });
        if (byTeam?.length) return byTeam;
      } catch (err) {
        logger.warn(
          `[Football] searchPlayers by team ${team} failed for "${name}" — trying league scan`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (league) {
      return this.fetchFromApi<any[]>('/players', {
        search: name,
        league,
        season,
      });
    }

    const merged: any[] = [];
    const seenPlayerIds = new Set<number>();

    for (const leagueId of FootballService.PLAYER_SEARCH_LEAGUE_IDS) {
      try {
        const batch = await this.fetchFromApi<any[]>('/players', {
          search: name,
          league: leagueId,
          season,
        });
        for (const item of batch ?? []) {
          const pid = item?.player?.id;
          if (typeof pid === 'number') {
            if (seenPlayerIds.has(pid)) continue;
            seenPlayerIds.add(pid);
          }
          merged.push(item);
        }
        if (merged.length >= 8) break;
      } catch (err) {
        if (err instanceof FootballApiError) {
          logger.debug(
            `[Football] Player search in league ${leagueId} for "${name}": ${err.message}`,
          );
          continue;
        }
        throw err;
      }
    }

    return merged;
  }

  // ============================================
  // TEAM ENDPOINTS
  // ============================================

  /**
   * Get team info by ID
   */
  async getTeamById(teamId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/teams', { id: teamId });
  }

  /**
   * ✅ OPTIMIZATION 2: Batch fetch multiple teams in one request
   * Get multiple teams by IDs (up to 10 teams per request to avoid URL length limits)
   */
  /**
   * Get teams by country (API-Football requires country parameter)
   * Fetches teams from a specific country
   */
  async getTeamsByCountry(country: string, page: number = 1): Promise<{ teams: any[]; hasMore: boolean; total: number }> {
    const params: Record<string, any> = {
      country: country,
    };

    const response = await this.fetchFromApi<any[]>('/teams', params);
    
    // Response is already the teams array from fetchFromApi
    const teams = Array.isArray(response) ? response : [];
    
    // API-Football doesn't always return pagination for teams
    // Return all teams found (usually limited by country)
    return {
      teams,
      hasMore: false,
      total: teams.length,
    };
  }

  /**
   * Get all countries from API-Football
   */
  async getCountries(): Promise<any[]> {
    return this.fetchFromApi<any[]>('/countries');
  }

  async getTeamsByIds(teamIds: number[]): Promise<any[]> {
    if (teamIds.length === 0) return [];

    // Filter out invalid IDs (null, undefined, NaN, non-integer) and dedupe
    const validIds = Array.from(
      new Set(teamIds.filter(id => Number.isInteger(id) && id > 0))
    );
    if (validIds.length === 0) return [];

    // ⚠️ API-Football's /teams endpoint requires `id` to be a single integer.
    // Passing multiple IDs (e.g. "33-34-35") returns:
    //   { id: "The Id field must contain an integer." }
    // So we must issue one request per team, in bounded-concurrency batches.
    const concurrency = 5;
    const allTeams: any[] = [];

    for (let i = 0; i < validIds.length; i += concurrency) {
      const slice = validIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        slice.map(id => this.fetchFromApi<any[]>('/teams', { id }))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allTeams.push(...result.value);
        } else if (result.status === 'rejected') {
          logger.warn('Failed to fetch team by id:', result.reason);
        }
      }
    }

    return allTeams;
  }

  /**
   * Get team squad (all players)
   */
  async getTeamSquad(teamId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/players/squads', { team: teamId });
  }

  /**
   * Get team statistics for a season
   */
  async getTeamStatistics(teamId: number, leagueId: number, season?: number): Promise<any> {
    const currentSeason = season || 2024;
    const params: any = { team: teamId, league: leagueId, season: currentSeason };
    return this.fetchFromApi<any>('/teams/statistics', params);
  }

  // ============================================
  // TOP SCORERS / ASSISTS
  // ============================================

  /**
   * Get top scorers for a league
   */
  async getTopScorers(leagueId: number, season?: number): Promise<any[]> {
    const currentSeason = season || 2024;
    return this.fetchFromApi<any[]>('/players/topscorers', {
      league: leagueId,
      season: currentSeason,
    });
  }

  /**
   * Get top assists/playmakers for a league
   */
  async getTopAssists(leagueId: number, season?: number): Promise<any[]> {
    const currentSeason = season || 2024;
    return this.fetchFromApi<any[]>('/players/topassists', {
      league: leagueId,
      season: currentSeason,
    });
  }

  /**
   * Get top yellow cards (players with most yellow cards)
   * Note: API-Football doesn't have a direct endpoint, so we'll use players statistics
   */
  async getTopYellowCards(leagueId: number, season?: number): Promise<any[]> {
    const currentSeason = season || 2024;
    // Use top scorers endpoint which includes cards statistics
    const players = await this.fetchFromApi<any[]>('/players/topscorers', {
      league: leagueId,
      season: currentSeason,
    });
    
    // Extract and sort by yellow cards
    return players
      .map((player: any) => {
        const stats = player.statistics?.[0];
        return {
          ...player,
          yellowCards: stats?.cards?.yellow || 0,
        };
      })
      .filter((player: any) => player.yellowCards > 0)
      .sort((a: any, b: any) => b.yellowCards - a.yellowCards);
  }

  /**
   * Get top red cards (players with most red cards)
   */
  async getTopRedCards(leagueId: number, season?: number): Promise<any[]> {
    const currentSeason = season || 2024;
    // Use top scorers endpoint which includes cards statistics
    const players = await this.fetchFromApi<any[]>('/players/topscorers', {
      league: leagueId,
      season: currentSeason,
    });
    
    // Extract and sort by red cards
    return players
      .map((player: any) => {
        const stats = player.statistics?.[0];
        return {
          ...player,
          redCards: stats?.cards?.red || 0,
        };
      })
      .filter((player: any) => player.redCards > 0)
      .sort((a: any, b: any) => b.redCards - a.redCards);
  }

  /**
   * Get team injuries
   */
  async getTeamInjuries(teamId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/injuries', {
      team: teamId,
    });
  }



  /**
   * Get team trophies
   */
  async getTeamTrophies(teamId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/trophies', {
      team: teamId,
    });
  }

  /**
   * Get team coaches
   */
  async getTeamCoaches(teamId: number): Promise<any[]> {
    return this.fetchFromApi<any[]>('/coaches', {
      team: teamId,
    });
  }

  /**
   * Get venue/stadium information
   */
  async getVenueInfo(venueId: number): Promise<any> {
    const venues = await this.fetchFromApi<any[]>('/venues', {
      id: venueId,
    });
    return venues && venues.length > 0 ? venues[0] : null;
  }

  /**
   * Get league rounds
   */
  async getLeagueRounds(leagueId: number, season?: number, current?: boolean): Promise<string[]> {
    const currentSeason = season || 2024;
    const params: Record<string, any> = {
      league: leagueId,
      season: currentSeason,
    };
    if (current !== undefined) params.current = current;
    
    return this.fetchFromApi<string[]>('/fixtures/rounds', params);
  }

  /**
   * Search teams by name
   */
  async searchTeams(name: string): Promise<any[]> {
    if (!this.isValidSearch(name)) return [];
    return this.fetchFromApi<any[]>('/teams', { search: name });
  }

  /**
   * Search leagues by name
   */
  async searchLeagues(name: string): Promise<any[]> {
    if (!this.isValidSearch(name)) return [];
    return this.fetchFromApi<any[]>('/leagues', { search: name });
  }

  /**
   * Search venues by name
   */
  async searchVenues(name: string): Promise<any[]> {
    if (!this.isValidSearch(name)) return [];
    return this.fetchFromApi<any[]>('/venues', { search: name });
  }
}

export const footballService = new FootballService();
export { FootballApiError };
