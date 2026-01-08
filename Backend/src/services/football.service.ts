/**
 * Football API Service
 * Proxies requests to API-Football v3 with caching and rate limiting
 * Documentation: https://www.api-football.com/documentation-v3
 */

import { logger } from '../utils/logger';

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
const CACHE_TTL = {
  LIVE: 30 * 1000,        // 30 seconds for live data
  SHORT: 2 * 60 * 1000,   // 2 minutes for volatile data
  LONG: 60 * 60 * 1000,   // 1 hour for static data
};

class FootballApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'FootballApiError';
  }
}

class FootballService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://v3.football.api-sports.io';
  private readonly timeout = 15000;

  // In-memory cache
  private cache = new Map<string, CacheEntry>();

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
    const requiredDelay = this.minDelay * 2; // Double the delay for transfers
    if (timeSinceLastRequest < requiredDelay && this.lastRequestTime > 0) {
      await this.sleep(requiredDelay - timeSinceLastRequest);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine cache TTL based on endpoint
   */
  private getCacheTTL(endpoint: string, params: Record<string, any>): number {
    if (params.live || endpoint.includes('/fixtures/events') || endpoint.includes('/fixtures/statistics')) {
      return CACHE_TTL.LIVE;
    }
    if (endpoint.includes('/leagues') || endpoint.includes('/standings')) {
      return CACHE_TTL.LONG;
    }
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
   * Fetch data from API-Football with caching and rate limiting
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
    const now = Date.now();
    const ttl = this.getCacheTTL(endpoint, params);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < ttl) {
      logger.debug('📦 Football API cache hit:', cacheKey);
      return cached.data;
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
          this.cache.set(cacheKey, { data: [], timestamp: now });
          return [] as T;
        }

        logger.error('❌ Football API Errors:', data.errors);

        if ((data.errors as any).rateLimit) {
          throw new FootballApiError('Rate limit exceeded. Please wait a moment.');
        }

        throw new FootballApiError('API returned errors');
      }

      logger.debug(`✅ Football API Response: ${data.results} results`);

      // Save to cache
      this.cache.set(cacheKey, { data: data.response, timestamp: now });

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
   */
  clearCache(): void {
    this.cache.clear();
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

  /**
   * Search players by name
   */
  async searchPlayers(name: string, league?: number): Promise<any[]> {
    if (!this.isValidSearch(name)) return [];
    const params: any = { search: name };
    if (league) params.league = league;
    return this.fetchFromApi<any[]>('/players', params);
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
    
    const teams = Array.isArray(response) ? response : response.response || [];
    
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
    
    // API-Football supports multiple IDs separated by '-'
    // Limit to 10 teams per request to avoid URL length issues
    const batchSize = 10;
    const batches: number[][] = [];
    
    for (let i = 0; i < teamIds.length; i += batchSize) {
      batches.push(teamIds.slice(i, i + batchSize));
    }

    const allTeams: any[] = [];
    
    // Fetch all batches in parallel
    const batchPromises = batches.map(batch => {
      const idsParam = batch.join('-');
      return this.fetchFromApi<any[]>('/teams', { id: idsParam });
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Flatten results
    for (const batchResult of batchResults) {
      if (Array.isArray(batchResult)) {
        allTeams.push(...batchResult);
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
   * Get transfers
   * Note: API-Football does not support 'date' parameter for transfers endpoint
   * Date filtering should be done client-side after fetching
   * Note: Can be called without parameters to get all transfers
   */
  async getTransfers(params: { team?: number; player?: number; date?: string }): Promise<any[]> {
    const apiParams: Record<string, any> = {};
    if (params.team) apiParams.team = params.team;
    if (params.player) apiParams.player = params.player;
    // Note: date parameter is not supported by API-Football transfers endpoint
    // We'll filter by date in the cache service instead
    // Note: Can be called without parameters to get all transfers
    
    const allTransfers = await this.fetchFromApi<any[]>('/transfers', apiParams);
    
    // Filter by date if provided (client-side filtering)
    if (params.date && allTransfers) {
      return allTransfers.filter((transfer: any) => {
        // Check if any transfer in the transfers array matches the date
        if (transfer.transfers && Array.isArray(transfer.transfers)) {
          return transfer.transfers.some((t: any) => t.date === params.date);
        }
        // Fallback: check update field
        return transfer.update === params.date;
      });
    }
    
    return allTransfers;
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
}

export const footballService = new FootballService();
export { FootballApiError };
