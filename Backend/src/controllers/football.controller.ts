import { Request, Response } from 'express';
import { footballService, FootballApiError } from '../services/football.service';
import { matchCacheService, FixtureFromAPI } from '../services/match-cache.service';
import { footballDataCacheService } from '../services/football-data-cache.service';
import { logger } from '../utils/logger';

/**
 * Football API Proxy Controller
 * Proxies requests to API-Football v3 while keeping API key secure on backend
 */
export class FootballController {
  /**
   * GET /api/football/leagues - Get all available leagues
   */
  static async getLeagues(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const { country, season, current } = req.query;

      const params: Record<string, any> = {};
      if (country) params.country = country;
      if (season) params.season = parseInt(season as string);
      if (current !== undefined) params.current = current === 'true';

      const leagues = await footballService.getLeagues(params);

      res.json({
        status: 'SUCCESS',
        results: leagues.length,
        response: leagues,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures - Get fixtures with filters
   */
  static async getFixtures(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const { live, date, league, season, team, last, next, from, to, status, id, ids } = req.query;

      // Check if date is outside Free Plan range - return empty array instead of error
      if (date && typeof date === 'string' && !footballService.isDateAllowed(date)) {
        const allowedRange = footballService.getAllowedDateRange();
        logger.debug(`📅 Date ${date} outside Free Plan range (${allowedRange.from} to ${allowedRange.to})`);
        res.json({
          status: 'SUCCESS',
          results: 0,
          response: [],
          notice: `Free Plan only allows dates from ${allowedRange.from} to ${allowedRange.to}`,
        });
        return;
      }

      const params: Record<string, any> = {};
      if (live) params.live = live;
      if (date) params.date = date;
      if (league) params.league = parseInt(league as string);
      if (season) params.season = parseInt(season as string);
      if (team) params.team = parseInt(team as string);
      if (last) params.last = parseInt(last as string);
      if (next) params.next = parseInt(next as string);
      if (from) params.from = from;
      if (to) params.to = to;
      if (status) params.status = status;
      if (id) params.id = parseInt(id as string);
      if (ids) params.ids = ids;

      const fixtures = await footballService.getFixtures(params);

      res.json({
        status: 'SUCCESS',
        results: fixtures.length,
        response: fixtures,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/optimized - Get fixtures with intelligent caching
   * 
   * This endpoint combines:
   * - Finished matches from PostgreSQL (no API call)
   * - Live matches from API (single call)
   * - Scheduled matches from API (uses from/to for batch fetch)
   * 
   * Query params:
   * - from: Start date (YYYY-MM-DD)
   * - to: End date (YYYY-MM-DD)
   */
  static async getOptimizedFixtures(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const { from, to } = req.query;

      // Default to today + 7 days if no range specified
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const defaultTo = new Date(today);
      defaultTo.setDate(defaultTo.getDate() + 7);

      const fromDate = from ? new Date(from as string) : today;
      const toDate = to ? new Date(to as string) : defaultTo;

      // Validate dates
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      logger.debug(`📅 Optimized fixtures request: ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);

      // Use the MatchCacheService for intelligent caching
      const fixtures = await matchCacheService.getOptimizedMatches(
        fromDate,
        toDate,
        async () => {
          // This function is called only when API fetch is needed
          const fromStr = fromDate.toISOString().split('T')[0];
          const toStr = toDate.toISOString().split('T')[0];

          logger.debug(`📡 Fetching from API: ${fromStr} to ${toStr}`);

          return footballService.getFixtures({ from: fromStr, to: toStr }) as Promise<FixtureFromAPI[]>;
        }
      );

      // Get cache stats for debugging
      const cacheStats = matchCacheService.getCacheStats();

      res.json({
        status: 'SUCCESS',
        results: fixtures.length,
        response: fixtures,
        _meta: {
          dateRange: {
            from: fromDate.toISOString().split('T')[0],
            to: toDate.toISOString().split('T')[0],
          },
          cacheStats: {
            finishedInDb: cacheStats.dbFixtureCount,
            memoryCacheEntries: cacheStats.memoryCacheSize,
          },
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/health - Health check for Football API
   * Checks API configuration, rate limits, and database connectivity
   */
  static async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const isConfigured = footballService.isConfigured();
      const rateLimitStatus = footballService.getRateLimitStatus();
      const cacheStats = matchCacheService.getCacheStats();
      
      // Check database connectivity for cached transfers
      let dbStatus = 'Unknown';
      let transfersCount = 0;
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const count = await prisma.cachedTransfer.count().catch(() => 0);
        transfersCount = count;
        dbStatus = 'Connected';
        await prisma.$disconnect();
      } catch (error: any) {
        dbStatus = error?.code === 'P2021' ? 'Table not found' : 'Disconnected';
      }

      const health = {
        status: isConfigured ? 'OK' : 'WARNING',
        timestamp: new Date().toISOString(),
        api: {
          configured: isConfigured,
          baseUrl: 'https://v3.football.api-sports.io',
          message: isConfigured 
            ? 'Football API is configured and ready' 
            : 'Football API key not configured (FOOTBALL_API_KEY missing)',
        },
        rateLimit: rateLimitStatus,
        cache: {
          matchCache: cacheStats,
          transfersInDatabase: transfersCount,
        },
        database: {
          status: dbStatus,
          transfersCount,
        },
      };

      res.status(isConfigured ? 200 : 503).json(health);
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cache/stats - Get cache statistics
   */
  static async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = matchCacheService.getCacheStats();
      const rateLimitStatus = footballService.getRateLimitStatus();

      res.json({
        status: 'SUCCESS',
        data: {
          matchCache: stats,
          rateLimit: rateLimitStatus,
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/live - Get live fixtures
   * ✅ Uses memory cache with 5 minutes TTL to reduce API calls
   */
  private static liveFixturesCache: { data: any[]; timestamp: number } | null = null;
  private static readonly LIVE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static async getLiveFixtures(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      // Check cache first
      const now = Date.now();
      if (
        FootballController.liveFixturesCache &&
        now - FootballController.liveFixturesCache.timestamp < FootballController.LIVE_CACHE_TTL
      ) {
        logger.debug('📦 Returning live fixtures from cache');
        res.json({
          status: 'SUCCESS',
          results: FootballController.liveFixturesCache.data.length,
          response: FootballController.liveFixturesCache.data,
          cached: true,
        });
        return;
      }

      // Fetch from API
      logger.debug('📡 Fetching live fixtures from API');
      const fixtures = await footballService.getLiveFixtures();

      // Update cache
      FootballController.liveFixturesCache = {
        data: fixtures,
        timestamp: now,
      };

      res.json({
        status: 'SUCCESS',
        results: fixtures.length,
        response: fixtures,
        cached: false,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/:id - Get a single fixture by ID
   */
  static async getFixtureById(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const fixtureId = parseInt(req.params.id);

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      const fixture = await footballService.getFixtureById(fixtureId);

      if (!fixture) {
        res.status(404).json({
          status: 'ERROR',
          message: 'Fixture not found',
        });
        return;
      }

      res.json({
        status: 'SUCCESS',
        results: 1,
        response: [fixture],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }


  /**
   * GET /api/football/standings - Get standings for a league
   */
  static async getStandings(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const { league, season } = req.query;

      if (!league) {
        res.status(400).json({
          status: 'ERROR',
          message: 'League ID is required',
        });
        return;
      }

      const leagueId = parseInt(league as string);
      const seasonYear = season ? parseInt(season as string) : undefined;

      if (isNaN(leagueId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid league ID',
        });
        return;
      }

      const standings = await footballService.getStandings(leagueId, seasonYear);

      res.json({
        status: 'SUCCESS',
        results: standings.length,
        response: standings,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/h2h - Get head to head matches between two teams
   */
  static async getHeadToHead(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const { team1, team2, count } = req.query;

      if (!team1 || !team2) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Both team1 and team2 IDs are required',
        });
        return;
      }

      const team1Id = parseInt(team1 as string);
      const team2Id = parseInt(team2 as string);
      const matchCount = count ? parseInt(count as string) : 5;

      if (isNaN(team1Id) || isNaN(team2Id)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid team IDs',
        });
        return;
      }

      const fixtures = await footballService.getHeadToHead(team1Id, team2Id, matchCount);

      res.json({
        status: 'SUCCESS',
        results: fixtures.length,
        response: fixtures,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/:id/lineups - Get lineups for a fixture
   */
  static async getFixtureLineups(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const fixtureId = parseInt(req.params.id);

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      const lineups = await footballService.getFixtureLineups(fixtureId);

      res.json({
        status: 'SUCCESS',
        results: lineups.length,
        response: lineups,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }


  /**
   * GET /api/football/fixtures/:id/statistics - Get statistics for a fixture
   */
  static async getFixtureStatistics(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const fixtureId = parseInt(req.params.id);

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      const statistics = await footballService.getFixtureStatistics(fixtureId);

      res.json({
        status: 'SUCCESS',
        results: statistics.length,
        response: statistics,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/:id/events - Get events for a fixture
   */
  static async getFixtureEvents(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      const fixtureId = parseInt(req.params.id);

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      const events = await footballService.getFixtureEvents(fixtureId);

      res.json({
        status: 'SUCCESS',
        results: events.length,
        response: events,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * Handle errors from the Football API service
   */
  private static handleError(res: Response, error: unknown): void {
    logger.error('Football API Error:', error);

    if (error instanceof FootballApiError) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        status: 'ERROR',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'ERROR',
      message: 'Internal server error',
    });
  }

  // ============================================
  // PLAYER ENDPOINTS
  // ============================================

  /**
   * GET /api/football/players/:id - Get player by ID with caching
   */
  static async getPlayerById(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const playerId = parseInt(req.params.id);
      // ✅ Get current season if not provided (real-time data)
      const season = req.query.season ? parseInt(req.query.season as string) : (() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return month >= 6 ? year : year - 1; // July+ = current year, before July = previous year
      })();

      if (isNaN(playerId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid player ID' });
        return;
      }

      // ✅ Use cache service for intelligent caching
      // ✅ Always fetch with current season to ensure real-time team data
      const { playerCacheService } = await import('../services/player-cache.service');

      const player = await playerCacheService.getPlayer(playerId, async () => {
        // ✅ Always fetch with current season for real-time data
        return footballService.getPlayerById(playerId, season);
      });

      if (!player) {
        res.status(404).json({ status: 'ERROR', message: 'Player not found' });
        return;
      }

      res.json({
        status: 'SUCCESS',
        results: 1,
        response: [player],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/:id - Get team by ID with caching
   */
  static async getTeamById(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const teamId = parseInt(req.params.id);

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      const { playerCacheService } = await import('../services/player-cache.service');

      const team = await playerCacheService.getTeam(teamId, async () => {
        return footballService.getTeamById(teamId);
      });

      if (!team) {
        res.status(404).json({ status: 'ERROR', message: 'Team not found' });
        return;
      }

      res.json({
        status: 'SUCCESS',
        results: 1,
        response: [team],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/:id/squad - Get team squad
   */
  static async getTeamSquad(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const teamId = parseInt(req.params.id);

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      const squad = await footballService.getTeamSquad(teamId);

      res.json({
        status: 'SUCCESS',
        results: squad.length,
        response: squad,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/h2h - Get head-to-head with caching
   */
  static async getH2HWithCache(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const team1 = parseInt(req.query.team1 as string);
      const team2 = parseInt(req.query.team2 as string);
      const count = req.query.count ? parseInt(req.query.count as string) : 10;

      if (isNaN(team1) || isNaN(team2)) {
        res.status(400).json({ status: 'ERROR', message: 'Both team1 and team2 IDs are required' });
        return;
      }

      const { playerCacheService } = await import('../services/player-cache.service');

      const h2h = await playerCacheService.getH2H(team1, team2, async () => {
        return footballService.getHeadToHead(team1, team2, count);
      });

      if (!h2h) {
        res.json({
          status: 'SUCCESS',
          results: 0,
          response: [],
          summary: { totalMatches: 0, team1Wins: 0, team2Wins: 0, draws: 0 },
        });
        return;
      }

      res.json({
        status: 'SUCCESS',
        results: h2h.matches.length,
        response: h2h.matches,
        summary: h2h.summary,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/players/top/scorers - Get top scorers
   */
  static async getTopScorers(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const league = parseInt(req.query.league as string);
      const season = req.query.season ? parseInt(req.query.season as string) : 2024;

      if (isNaN(league)) {
        res.status(400).json({ status: 'ERROR', message: 'League ID is required' });
        return;
      }

      const scorers = await footballDataCacheService.getTopScorers(league, season);

      res.json({
        status: 'SUCCESS',
        results: scorers.length,
        response: scorers,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/players/top/assists - Get top assists/playmakers
   */
  static async getTopAssists(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const league = parseInt(req.query.league as string);
      const season = req.query.season ? parseInt(req.query.season as string) : 2024;

      if (isNaN(league)) {
        res.status(400).json({ status: 'ERROR', message: 'League ID is required' });
        return;
      }

      const assists = await footballDataCacheService.getTopAssists(league, season);

      res.json({
        status: 'SUCCESS',
        results: assists.length,
        response: assists,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/:id/statistics - Get team statistics
   */
  static async getTeamStatistics(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const teamId = parseInt(req.params.id);
      const league = req.query.league ? parseInt(req.query.league as string) : undefined;
      const season = req.query.season ? parseInt(req.query.season as string) : 2024;

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      if (!league) {
        res.status(400).json({ status: 'ERROR', message: 'League ID is required' });
        return;
      }

      const statistics = await footballDataCacheService.getTeamStatistics(teamId, league, season);

      res.json({
        status: 'SUCCESS',
        results: statistics ? 1 : 0,
        response: statistics,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/:id/injuries - Get team injuries
   */
  static async getTeamInjuries(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const teamId = parseInt(req.params.id);

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      const injuries = await footballDataCacheService.getTeamInjuries(teamId);

      res.json({
        status: 'SUCCESS',
        results: injuries.length,
        response: injuries,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/:id/trophies - Get team trophies
   */
  static async getTeamTrophies(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const teamId = parseInt(req.params.id);

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      const trophies = await footballDataCacheService.getTeamTrophies(teamId);

      res.json({
        status: 'SUCCESS',
        results: trophies.length,
        response: trophies,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/:id/coaches - Get team coaches
   */
  static async getTeamCoaches(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const teamId = parseInt(req.params.id);

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      const coaches = await footballDataCacheService.getTeamCoaches(teamId);

      res.json({
        status: 'SUCCESS',
        results: coaches.length,
        response: coaches,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/transfers - Get transfers
   */
  static async getTransfers(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const team = req.query.team ? parseInt(req.query.team as string) : undefined;
      const player = req.query.player ? parseInt(req.query.player as string) : undefined;
      const date = req.query.date as string | undefined;

      const params: Record<string, any> = {};
      if (team) params.team = team;
      if (player) params.player = player;
      if (date) params.date = date;

      const transfers = await footballDataCacheService.getTransfers(params);

      res.json({
        status: 'SUCCESS',
        results: transfers.length,
        response: transfers,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/transfers/by-leagues - Get transfers by leagues with date range
   */
  static async getTransfersByLeagues(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const leaguesParam = req.query.leagues as string | undefined;
      const fromDate = req.query.from as string | undefined;
      const toDate = req.query.to as string | undefined;

      const leagueIds = leaguesParam 
        ? leaguesParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : undefined;

      const dateRange = (fromDate && toDate) 
        ? { from: fromDate, to: toDate }
        : undefined;

      const transfersByLeagues = await footballDataCacheService.getTransfersByLeagues(leagueIds, dateRange);

      const totalTransfers = transfersByLeagues.reduce((sum, item) => sum + item.transfers.length, 0);

      res.json({
        status: 'SUCCESS',
        results: totalTransfers,
        leagues: transfersByLeagues.length,
        response: transfersByLeagues,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * POST /api/football/transfers/sync
   * Sync transfers from API to database (admin endpoint)
   * This fetches transfers from the external API and saves them to the database
   * Query params: force (boolean) - force sync even if already syncing
   */
  static async syncTransfersToDatabase(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const force = req.query.force === 'true';
      logger.info(`📡 Starting transfers sync to database (force: ${force})...`);

      // Use the sync service for proper tracking
      const { transfersSyncService } = await import('../services/transfers-sync.service');
      const stats = await transfersSyncService.triggerManualSync(force);
      
      res.json({
        status: 'SUCCESS',
        message: `Sync completed`,
        data: {
          totalTransfersInDb: stats.totalTransfersInDb,
          newTransfersFound: stats.newTransfersFound,
          syncDuration: `${Math.round(stats.syncDuration / 1000)}s`,
          lastSyncDate: stats.lastSyncDate,
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/all-logos
   * Fetch all team logos from API-Football and save to database
   * This endpoint fetches ALL teams (can be 100k+) and saves logos in batches
   */
  static async getAllTeamLogos(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      logger.info('📡 Starting to fetch all team logos...');

      const pageParam = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limitParam = req.query.limit ? parseInt(req.query.limit as string) : 100;

      // If page is specified, fetch that page only
      if (pageParam) {
        const result = await footballService.getAllTeams(pageParam, limitParam);
        
        // Save teams to database
        let savedCount = 0;
        for (const team of result.teams) {
          try {
            const teamData = team.team || team;
            if (teamData?.id) {
              await footballDataCacheService.cacheTeamFromTransfer({
                id: teamData.id,
                name: teamData.name || 'Unknown Team',
                logo: teamData.logo || null,
              });
              savedCount++;
            }
          } catch (error) {
            logger.warn(`Failed to save team ${team.team?.id}:`, error);
          }
        }

        res.json({
          status: 'SUCCESS',
          message: `Fetched page ${pageParam}`,
          data: {
            page: pageParam,
            totalPages: result.total,
            hasMore: result.hasMore,
            teamsInThisPage: result.teams.length,
            savedToDatabase: savedCount,
          },
        });
        return;
      }

      // Fetch all teams with pagination
      let currentPage = 1;
      let totalTeams = 0;
      let savedCount = 0;
      let hasMore = true;
      const startTime = Date.now();

      logger.info('📡 Fetching all teams with pagination...');

      while (hasMore) {
        try {
          const result = await footballService.getAllTeams(currentPage, limitParam);
          
          logger.info(`📥 Page ${currentPage}: Fetched ${result.teams.length} teams`);

          // Save teams to database
          for (const team of result.teams) {
            try {
              const teamData = team.team || team;
              if (teamData?.id) {
                await footballDataCacheService.cacheTeamFromTransfer({
                  id: teamData.id,
                  name: teamData.name || 'Unknown Team',
                  logo: teamData.logo || null,
                  code: teamData.code,
                  country: teamData.country,
                  founded: teamData.founded,
                });
                savedCount++;
              }
            } catch (error) {
              // Ignore duplicate errors, continue
            }
          }

          totalTeams += result.teams.length;
          hasMore = result.hasMore;
          currentPage++;

          // Small delay between pages to avoid rate limits
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Safety limit - stop at page 1000 (100k teams)
          if (currentPage > 1000) {
            logger.warn('⚠️ Reached safety limit of 1000 pages (100k teams). Stopping.');
            break;
          }
        } catch (error: any) {
          logger.error(`Error fetching page ${currentPage}:`, error);
          
          // If rate limit error, wait and retry
          if (error?.statusCode === 429 || error?.message?.includes('Rate limit')) {
            logger.warn(`⏳ Rate limit hit. Waiting 60 seconds before continuing...`);
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }
          
          // For other errors, stop
          break;
        }
      }

      const duration = Date.now() - startTime;
      const minutes = Math.round(duration / 1000 / 60);

      logger.info(`✅ Completed fetching all team logos: ${totalTeams} teams in ${minutes} minutes, ${savedCount} saved to database`);

      res.json({
        status: 'SUCCESS',
        message: `Successfully fetched ${totalTeams} teams and saved ${savedCount} logos to database`,
        data: {
          totalTeamsFetched: totalTeams,
          totalTeamsSaved: savedCount,
          totalPagesProcessed: currentPage - 1,
          durationMinutes: minutes,
          durationSeconds: Math.round(duration / 1000),
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/transfers/sync/status
   * Get the status of the transfers sync service
   */
  static async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      const { transfersSyncService } = await import('../services/transfers-sync.service');
      const status = transfersSyncService.getStatus();
      
      res.json({
        status: 'SUCCESS',
        data: {
          serviceRunning: status.isRunning,
          currentlySyncing: status.isSyncing,
          lastSync: status.lastSync ? {
            date: status.lastSync.lastSyncDate,
            totalTransfersInDb: status.lastSync.totalTransfersInDb,
            newTransfersFound: status.lastSync.newTransfersFound,
            duration: `${Math.round(status.lastSync.syncDuration / 1000)}s`,
          } : null,
          schedule: {
            weekly: 'Every Sunday at 3:00 AM',
            daily: 'Every day at 6:00 AM',
          },
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/transfers/cached
   * Get cached transfers from database (fast, no API calls)
   * Query params: leagues (comma-separated IDs), season (optional, default current), from (YYYY-MM-DD), to (YYYY-MM-DD)
   */
  static async getCachedTransfers(req: Request, res: Response): Promise<void> {
    try {
      const leaguesParam = req.query.leagues as string | undefined;
      const seasonParam = req.query.season as string | undefined;
      const fromDate = req.query.from as string | undefined;
      const toDate = req.query.to as string | undefined;

      const leagueIds = leaguesParam 
        ? leaguesParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : undefined; // undefined means get from all leagues (كل الدوريات)

      // Season is optional - if not provided, get from all seasons (including last year)
      const season = seasonParam ? parseInt(seasonParam) : undefined;

      const dateRange = (fromDate && toDate) 
        ? { from: fromDate, to: toDate }
        : undefined;

      // Get transfers from database (includes last year - السنة الفاتت)
      logger.debug(`📡 getCachedTransfers request - LeagueIds: ${leagueIds ? leagueIds.join(',') : 'ALL'}, Season: ${season || 'ALL'}, DateRange: ${dateRange ? `${dateRange.from} to ${dateRange.to}` : 'ALL'}`);
      
      const transfersByLeagues = await footballDataCacheService.getCachedTransfersByLeagues(leagueIds, season, dateRange);

      const totalTransfers = transfersByLeagues.reduce((sum, item) => sum + item.transfers.length, 0);

      logger.debug(`📡 getCachedTransfers response - Leagues: ${transfersByLeagues.length}, Total Transfers: ${totalTransfers}`);

      res.json({
        status: 'SUCCESS',
        results: totalTransfers,
        leagues: transfersByLeagues.length,
        response: transfersByLeagues,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/venues/:id - Get venue/stadium information
   */
  static async getVenueInfo(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const venueId = parseInt(req.params.id);

      if (isNaN(venueId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid venue ID' });
        return;
      }

      const venue = await footballDataCacheService.getVenueInfo(venueId);

      res.json({
        status: 'SUCCESS',
        results: venue ? 1 : 0,
        response: venue,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/rounds - Get league rounds
   */
  static async getLeagueRounds(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const league = parseInt(req.query.league as string);
      const season = req.query.season ? parseInt(req.query.season as string) : 2024;
      const current = req.query.current === 'true';

      if (isNaN(league)) {
        res.status(400).json({ status: 'ERROR', message: 'League ID is required' });
        return;
      }

      const rounds = await footballDataCacheService.getLeagueRounds(league, season, current);

      res.json({
        status: 'SUCCESS',
        results: rounds.length,
        response: rounds,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/search - Unified search across players, teams, leagues
   */
  static async search(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        res.status(400).json({ status: 'ERROR', message: 'Query string "q" must be at least 2 characters' });
        return;
      }

      const { leagueCacheService } = await import('../services/league-cache.service');
      const results = await leagueCacheService.unifiedSearch(query);

      res.json({
        status: 'SUCCESS',
        response: results,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/leagues/all - Get all leagues with caching
   */
  static async getAllLeagues(req: Request, res: Response): Promise<void> {
    try {
      const { leagueCacheService } = await import('../services/league-cache.service');
      const leagues = await leagueCacheService.getAllLeagues();

      res.json({
        status: 'SUCCESS',
        results: leagues.length,
        response: leagues,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  // ============================================
  // CACHED DATA ENDPOINTS (Permanent Storage)
  // ============================================

  /**
   * GET /api/football/cached/matches/:date - Get matches for a specific date
   * Uses permanent database storage for finished matches
   */
  static async getCachedMatchesByDate(req: Request, res: Response): Promise<void> {
    try {
      const dateString = req.params.date;

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }

      const matches = await footballDataCacheService.getMatchesByDate(dateString);

      res.json({
        status: 'SUCCESS',
        results: matches.length,
        response: matches,
        _meta: {
          date: dateString,
          cached: true,
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/player/:id - Get player with permanent caching
   */
  static async getCachedPlayer(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(req.params.id);
      const season = req.query.season ? parseInt(req.query.season as string) : 2024;

      if (isNaN(playerId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid player ID' });
        return;
      }

      const player = await footballDataCacheService.getPlayer(playerId, season);

      if (!player) {
        res.status(404).json({ status: 'ERROR', message: 'Player not found' });
        return;
      }

      res.json({
        status: 'SUCCESS',
        results: 1,
        response: [player],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/team/:id - Get team with permanent caching
   */
  static async getCachedTeam(req: Request, res: Response): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      const team = await footballDataCacheService.getTeam(teamId);

      if (!team) {
        res.status(404).json({ status: 'ERROR', message: 'Team not found' });
        return;
      }

      res.json({
        status: 'SUCCESS',
        results: 1,
        response: [team],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * ✅ OPTIMIZATION 2: GET /api/football/cached/teams/batch - Get multiple teams in one request
   * Query param: ?ids=1020,1021,1022 (comma-separated team IDs)
   */
  static async getCachedTeamsBatch(req: Request, res: Response): Promise<void> {
    try {
      const idsParam = req.query.ids as string;
      
      if (!idsParam) {
        res.status(400).json({ status: 'ERROR', message: 'Missing ids query parameter' });
        return;
      }

      const teamIds = idsParam
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id) && id > 0);

      if (teamIds.length === 0) {
        res.status(400).json({ status: 'ERROR', message: 'No valid team IDs provided' });
        return;
      }

      if (teamIds.length > 20) {
        res.status(400).json({ status: 'ERROR', message: 'Maximum 20 teams per request' });
        return;
      }

      const teamsMap = await footballDataCacheService.getTeams(teamIds);
      const teams = Array.from(teamsMap.values());

      res.json({
        status: 'SUCCESS',
        results: teams.length,
        response: teams,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/standings/:leagueId - Get standings with caching
   */
  static async getCachedStandings(req: Request, res: Response): Promise<void> {
    try {
      const leagueId = parseInt(req.params.leagueId);
      const season = req.query.season ? parseInt(req.query.season as string) : 2024;

      if (isNaN(leagueId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid league ID' });
        return;
      }

      const standings = await footballDataCacheService.getStandings(leagueId, season);

      res.json({
        status: 'SUCCESS',
        results: standings?.length || 0,
        response: standings || [],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/h2h - Get H2H with permanent caching
   */
  static async getCachedH2H(req: Request, res: Response): Promise<void> {
    try {
      const team1 = parseInt(req.query.team1 as string);
      const team2 = parseInt(req.query.team2 as string);
      const count = req.query.count ? parseInt(req.query.count as string) : 10;

      if (isNaN(team1) || isNaN(team2)) {
        res.status(400).json({ status: 'ERROR', message: 'Both team1 and team2 IDs are required' });
        return;
      }

      const h2h = await footballDataCacheService.getH2H(team1, team2, count);

      res.json({
        status: 'SUCCESS',
        results: h2h?.matches?.length || 0,
        response: h2h?.matches || [],
        summary: h2h?.summary || { totalMatches: 0, team1Wins: 0, team2Wins: 0, draws: 0 },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/fixture/:id/lineups - Get lineups with caching
   */
  static async getCachedLineups(req: Request, res: Response): Promise<void> {
    try {
      const fixtureId = parseInt(req.params.id);

      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      const lineups = await footballDataCacheService.getMatchLineups(fixtureId);

      res.json({
        status: 'SUCCESS',
        results: lineups?.length || 0,
        response: lineups || [],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/fixture/:id/statistics - Get statistics with caching
   */
  static async getCachedStatistics(req: Request, res: Response): Promise<void> {
    try {
      const fixtureId = parseInt(req.params.id);

      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      const statistics = await footballDataCacheService.getMatchStatistics(fixtureId);

      res.json({
        status: 'SUCCESS',
        results: statistics?.length || 0,
        response: statistics || [],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/fixture/:id/events - Get events with caching
   */
  static async getCachedEvents(req: Request, res: Response): Promise<void> {
    try {
      const fixtureId = parseInt(req.params.id);

      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      const events = await footballDataCacheService.getMatchEvents(fixtureId);

      res.json({
        status: 'SUCCESS',
        results: events?.length || 0,
        response: events || [],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/search - Unified search with caching
   * Returns teams, players, leagues, and matches
   * Results are cached in PostgreSQL for instant retrieval by all users
   */
  static async getCachedSearch(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        res.status(400).json({ status: 'ERROR', message: 'Query must be at least 2 characters' });
        return;
      }

      // Use the new search cache service
      const { searchCacheService } = await import('../services/search-cache.service');
      const results = await searchCacheService.search(query);

      res.json({
        status: 'SUCCESS',
        response: {
          teams: results.teams,
          players: results.players,
          leagues: results.leagues,
          matches: results.matches,
        },
        _meta: {
          fromCache: results.fromCache,
          searchCount: results.searchCount,
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/team/:id/matches - Get team matches (live, upcoming, finished)
   */
  static async getCachedTeamMatches(req: Request, res: Response): Promise<void> {
    try {
      const teamId = parseInt(req.params.id);
      const count = req.query.count ? parseInt(req.query.count as string) : 10;

      if (isNaN(teamId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid team ID' });
        return;
      }

      const result = await footballDataCacheService.getTeamMatches(teamId, count);

      res.json({
        status: 'SUCCESS',
        response: result,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/stats - Get cache statistics
   */
  static async getFullCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await footballDataCacheService.getCacheStats();
      
      // Also get search stats
      const { searchCacheService } = await import('../services/search-cache.service');
      const searchStats = await searchCacheService.getCacheStats();

      res.json({
        status: 'SUCCESS',
        data: {
          ...stats,
          search: searchStats,
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/popular-searches - Get popular search suggestions
   */
  static async getPopularSearches(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const { searchCacheService } = await import('../services/search-cache.service');
      const popular = await searchCacheService.getPopularSearches(limit);

      res.json({
        status: 'SUCCESS',
        response: popular,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }
}

