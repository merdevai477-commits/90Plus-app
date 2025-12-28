/**
 * API-Football v3 Service
 * Documentation: https://www.api-football.com/documentation-v3
 */

import rateLimiter from './rateLimiter';

const API_KEY = 'd06b124b9252ef31dd3863af61876b20';
const API_BASE_URL = 'https://v3.football.api-sports.io';
const DEFAULT_TIMEOUT = 15000;

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
};

class ApiFootballError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiFootballError';
  }
}

const withTimeout = async <T>(promise: Promise<T>, timeout = DEFAULT_TIMEOUT): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new ApiFootballError('Request timed out'));
    }, timeout);
  });

  return Promise.race([promise, timeoutPromise]);
};

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
  type: string; // 'Goal', 'Card', 'subst', 'Var'
  detail: string; // 'Normal Goal', 'Yellow Card', 'Substitution 1', etc.
  comments: string | null;
}

// Simple in-memory cache
const apiCache = new Map<string, { data: any; timestamp: number }>();

// Cache durations
const CACHE_TTL = {
  LIVE: 30 * 1000, // 30 seconds for live data
  SHORT: 2 * 60 * 1000, // 2 minutes for volatile data
  LONG: 60 * 60 * 1000, // 1 hour for static data
};

const fetchFromApi = async <T>(endpoint: string, params: Record<string, any> = {}): Promise<T> => {
  // Use rate limiter to prevent exceeding API limits
  return rateLimiter.execute(async () => {
    const url = new URL(`${API_BASE_URL}${endpoint}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });

    const cacheKey = url.pathname + url.search;
    const now = Date.now();

    // Determine TTL
    let ttl = CACHE_TTL.SHORT;
    if (params.live || endpoint.includes('/fixtures/events') || endpoint.includes('/fixtures/statistics')) {
      ttl = CACHE_TTL.LIVE;
    } else if (endpoint.includes('/leagues')) {
      ttl = CACHE_TTL.LONG;
    }

    // Check cache
    if (apiCache.has(cacheKey)) {
      const cached = apiCache.get(cacheKey)!;
      if (now - cached.timestamp < ttl) {
        console.log('📦 Serving from cache:', cacheKey);
        return cached.data;
      }
    }

    console.log('🔍 API-Football Request:', cacheKey);

    try {
      const response = await withTimeout(
        fetch(url.toString(), {
          method: 'GET',
          headers: {
            'x-apisports-key': API_KEY,
            'Accept': 'application/json',
          },
        })
      );

      if (!response.ok) {
        throw new ApiFootballError(
          `API request failed: ${response.statusText}`,
          response.status
        );
      }

      const data: ApiResponse<T> = await response.json();

      if (data.errors && Object.keys(data.errors).length > 0) {
        console.error('❌ API-Football Errors:', data.errors);

        // Check if it's a rate limit error
        if ((data.errors as any).rateLimit) {
          throw new ApiFootballError('Rate limit exceeded. Please wait a moment.');
        }

        throw new ApiFootballError('API returned errors');
      }

      console.log(`✅ API-Football Response: ${data.results} results`);

      // Save to cache
      apiCache.set(cacheKey, { data: data.response, timestamp: now });

      return data.response;
    } catch (error) {
      console.error('❌ API-Football Error:', error);
      throw error;
    }
  });
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
    return fetchFromApi<League[]>('/leagues', params);
  },

  /**
   * Get fixtures with filters
   */
  async getFixtures(params: {
    live?: 'all' | string;
    date?: string; // YYYY-MM-DD
    league?: number;
    season?: number;
    team?: number;
    last?: number;
    next?: number;
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    status?: string; // NS, LIVE, FT, etc.
    id?: number; // Fixture ID
    ids?: string; // Comma separated IDs
  } = {}): Promise<Fixture[]> {
    return fetchFromApi<Fixture[]>('/fixtures', params);
  },

  /**
   * Get specific fixtures by their IDs (DEPRECATED: Not supported on Free Plan)
   * Use getLiveFixtures() or getFixtures() with other filters instead.
   */
  async getFixturesByIds(ids: number[]): Promise<Fixture[]> {
    console.warn('getFixturesByIds is not supported on the free plan. Returning empty array.');
    return [];
  },

  /**
   * Get live fixtures
   */
  async getLiveFixtures(): Promise<Fixture[]> {
    return this.getFixtures({ live: 'all' });
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
    // Free plan only supports up to 2024
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
    const allFixtures: Fixture[] = [];

    // Get fixtures for today if no date specified
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      // Fetch all fixtures for the date
      const fixtures = await this.getFixturesByDate(targetDate);

      // Filter for major leagues
      const majorFixtures = fixtures.filter(f =>
        majorLeagueIds.includes(f.league.id)
      );

      allFixtures.push(...majorFixtures);
    } catch (error) {
      console.error('Error fetching major leagues fixtures:', error);
    }

    return allFixtures;
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

    // Free plan only supports up to 2024
    const currentSeason = 2024;
    const season = params.season || currentSeason;
    const allFixtures: Fixture[] = [];

    try {
      // Fetch fixtures for each league
      for (const leagueId of top5Leagues) {
        try {
          const fixtures = await this.getFixtures({
            league: leagueId,
            season,
            ...params,
          });
          allFixtures.push(...fixtures);
        } catch (error) {
          console.error(`Error fetching fixtures for league ${leagueId}:`, error);
        }
      }

      // Sort by date
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
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + days);

    return this.getFixtures({
      from: today.toISOString().split('T')[0],
      to: future.toISOString().split('T')[0],
      status: 'NS',
    });
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
      // 1. Live matches first
      const aIsLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(a.fixture.status.short);
      const bIsLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(b.fixture.status.short);

      if (aIsLive && !bIsLive) return -1;
      if (bIsLive && !aIsLive) return 1;

      // 2. Major leagues priority
      const top5Leagues = [
        MAJOR_LEAGUES.PREMIER_LEAGUE,
        MAJOR_LEAGUES.LA_LIGA,
        MAJOR_LEAGUES.BUNDESLIGA,
        MAJOR_LEAGUES.SERIE_A,
        MAJOR_LEAGUES.LIGUE_1,
      ];

      const aIsMajor = top5Leagues.includes(a.league.id);
      const bIsMajor = top5Leagues.includes(b.league.id);

      if (aIsMajor && !bIsMajor) return -1;
      if (bIsMajor && !aIsMajor) return 1;

      // 3. Champions League and Europa League
      const aIsEuropean = [MAJOR_LEAGUES.CHAMPIONS_LEAGUE, MAJOR_LEAGUES.EUROPA_LEAGUE].includes(a.league.id);
      const bIsEuropean = [MAJOR_LEAGUES.CHAMPIONS_LEAGUE, MAJOR_LEAGUES.EUROPA_LEAGUE].includes(b.league.id);

      if (aIsEuropean && !bIsEuropean) return -1;
      if (bIsEuropean && !aIsEuropean) return 1;

      // 4. Upcoming before finished
      const aIsFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(a.fixture.status.short);
      const bIsFinished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(b.fixture.status.short);

      if (!aIsFinished && bIsFinished) return -1;
      if (!bIsFinished && aIsFinished) return 1;

      // 5. Sort by time (earlier first)
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

    // Live statuses
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
   */
  async getFixtureLineups(fixtureId: number): Promise<Lineup[]> {
    return fetchFromApi<Lineup[]>('/fixtures/lineups', { fixture: fixtureId });
  },

  /**
   * Get team statistics for a specific fixture
   */
  async getFixtureStatistics(fixtureId: number): Promise<TeamStatistics[]> {
    return fetchFromApi<TeamStatistics[]>('/fixtures/statistics', { fixture: fixtureId });
  },

  /**
   * Get last fixtures for a team (using date range for free plan compatibility)
   */
  async getTeamLastFixtures(teamId: number, count: number = 5): Promise<TeamFixture[]> {
    // Free plan doesn't support 'last' parameter, so we fetch recent fixtures using date range
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 90); // Get fixtures from last 90 days

    try {
      // Free plan only supports seasons 2021-2023, use 2023 as default
      const fixtures = await fetchFromApi<TeamFixture[]>('/fixtures', {
        team: teamId,
        season: 2023,
        status: 'FT' // Only finished matches
      });

      // Sort by date descending and take the last N matches
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
   */
  async getFixtureById(fixtureId: number): Promise<Fixture | null> {
    const fixtures = await this.getFixtures({
      id: fixtureId
    } as any);
    return fixtures && fixtures.length > 0 ? fixtures[0] : null;
  },

  /**
   * Get match events (goals, cards, substitutions)
   */
  async getFixtureEvents(fixtureId: number): Promise<FixtureEvent[]> {
    return fetchFromApi<FixtureEvent[]>('/fixtures/events', { fixture: fixtureId });
  },

  /**
   * Get head to head matches between two teams (using date range for free plan compatibility)
   */
  async getHeadToHead(team1Id: number, team2Id: number, count: number = 5): Promise<Fixture[]> {
    // Free plan doesn't support 'last' parameter, so we fetch recent fixtures using date range
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 365); // Get fixtures from last year

    try {
      // H2H endpoint doesn't need date range or season, just the team IDs
      const fixtures = await fetchFromApi<Fixture[]>('/fixtures/headtohead', {
        h2h: `${team1Id}-${team2Id}`
      });

      // Sort by date descending and take the last N matches
      return fixtures
        .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
        .slice(0, count);
    } catch (error) {
      console.error('Error fetching head to head:', error);
      return [];
    }
  },

  /**
   * Get standings for a specific league and season
   */
  async getStandings(leagueId: number, season?: number): Promise<Standing[]> {
    // Free plan only supports up to 2024
    const currentSeason = 2024;
    const params = {
      league: leagueId,
      season: season || currentSeason
    };

    try {
      const response = await fetchFromApi<any[]>('/standings', params);
      // API returns an array of leagues, each containing an array of standings (groups)
      // Usually response[0].league.standings[0] is what we want for single-group leagues
      if (response && response.length > 0 && response[0].league && response[0].league.standings) {
        // Flatten the standings if there are multiple groups (like Champions League) or just take the first one
        return response[0].league.standings.flat();
      }
      return [];
    } catch (error) {
      console.error('Error fetching standings:', error);
      return [];
    }
  },
};

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

export default ApiFootballService;
