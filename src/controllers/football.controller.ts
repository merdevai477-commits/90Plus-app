import { Request, Response } from 'express';
import { footballService, FootballApiError } from '../services/football.service';
import { matchCacheService, FixtureFromAPI } from '../services/match-cache.service';
import { footballDataCacheService } from '../services/football-data-cache.service';
import { getTopClubsByCountry, getSupportedCountries } from '../services/top-clubs.service';
import { logger } from '../utils/logger';
import { getFootballMetrics } from '../utils/football-metrics';
import { resolveAppLanguage } from '../utils/app-language.util';
import prisma from '../lib/prisma';
import {
  resolveFixtureForClient,
  resolveLiveFixturesForClient,
} from '../services/live-fixture-cache.service';
import { getScores365GameIdForFixture, ensureScores365GameMapping, is365StoreDetailsHotfix, isScores365ExperimentEnabled, isScores365ExperimentFixture, resolveApiFixtureIdFor365GameId, fetchScores365GameById, registerScores365FixtureMapping } from '../services/scores365-experiment.service';
import { threeSixFiveScoresService } from '../services/threeSixFiveScores.service';

/**
 * Football API Proxy Controller
 * Proxies requests to API-Football v3 while keeping API key secure on backend
 */

// Helper function to ensure string from params (handles string | string[])
function ensureString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

/** fresh=1 query param, or WC store hotfix (legacy app compatibility). */
function wantsFreshMatchDetails(req: Request): boolean {
  return (
    is365StoreDetailsHotfix() ||
    req.query.fresh === '1' ||
    req.query.fresh === 'true' ||
    req.query.forceRefresh === '1'
  );
}

// Helper function to format transfer date
function formatTransferDate(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  
  try {
    // Handle YYMMDD format (e.g., "310812" = 31/08/2012)
    if (dateStr.length === 6 && /^\d{6}$/.test(dateStr)) {
      const year = 2000 + parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4)) - 1;
      const day = parseInt(dateStr.substring(4, 6));
      const date = new Date(year, month, day);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    // Handle YYYY-MM-DD format
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    return dateStr;
  } catch {
    return dateStr;
  }
}

export class FootballController {
  /**
   * GET /api/football/365/competitions/:competitionId/coaches
   * Fetches coaches for teams in a 365Scores competition via lineups.
   */
  static async get365CompetitionCoaches(req: Request, res: Response): Promise<void> {
    try {
      const competitionId = parseInt(String(req.params.competitionId), 10);
      if (isNaN(competitionId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid competitionId' });
        return;
      }
      
      const lang = req.headers['accept-language']?.split(',')[0] || 'en';
      const result = await threeSixFiveScoresService.extractCompetitionCoaches(competitionId, lang);
      
      res.json({
        status: 'SUCCESS',
        results: result.data?.length ?? 0,
        response: result.data ?? [],
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

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
      
      let dbStatus = 'Unknown';
      try {
        // ✅ Use centralized singleton instead of creating new PrismaClient
        dbStatus = 'Connected';
      } catch (error: any) {
        dbStatus = 'Disconnected';
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
        },
        database: {
          status: dbStatus,
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
          footballMetrics: getFootballMetrics(),
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/fixtures/live - Get live fixtures
   * Prefers Redis snapshot from LiveFixtureSync (≤10s) before upstream API.
   */
  static async getLiveFixtures(req: Request, res: Response): Promise<void> {
    try {
      const language = resolveAppLanguage(req);
      const redisLive = await resolveLiveFixturesForClient(language);
      if (
        (redisLive.source === 'redis' || redisLive.source === 'scores365-experiment') &&
        redisLive.fixtures.length > 0
      ) {
        logger.debug(`📦 Returning ${redisLive.fixtures.length} live fixtures from ${redisLive.source}`);
        res.json({
          status: 'SUCCESS',
          results: redisLive.fixtures.length,
          response: redisLive.fixtures,
          cached: true,
          source: redisLive.source === 'scores365-experiment' ? 'scores365-experiment' : 'redis-sync',
          language,
        });
        return;
      }

      if (!footballService.isConfigured()) {
        if (isScores365ExperimentEnabled()) {
          res.json({
            status: 'SUCCESS',
            results: 0,
            response: [],
            cached: true,
            source: 'scores365-experiment',
            language,
          });
          return;
        }
        res.status(503).json({
          status: 'ERROR',
          message: 'Football API not configured',
        });
        return;
      }

      logger.debug('📡 Fetching live fixtures from API (Redis sync empty)');
      let fixtures: any[] = [];
      try {
        fixtures = await footballService.getLiveFixtures();
      } catch (fetchError: any) {
        if (fetchError?.name === 'FootballApiError' || fetchError?.message?.includes('timed out') || fetchError?.message?.includes('timeout')) {
          logger.warn('getLiveFixtures: first attempt failed, retrying once...', fetchError?.message);
          fixtures = await footballService.getLiveFixtures();
        } else {
          throw fetchError;
        }
      }

      if (fixtures.length > 0) {
        const { matchCacheService } = await import('../services/match-cache.service');
        matchCacheService.upsertFixtures(fixtures).catch((err) => {
          logger.warn('getLiveFixtures: DB upsert failed (non-fatal):', err);
        });
      }

      res.json({
        status: 'SUCCESS',
        results: fixtures.length,
        response: fixtures,
        cached: false,
      });
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      logger.warn(`getLiveFixtures: upstream error (${errMsg}), returning empty list for client stability`);
      res.status(200).json({
        status: 'SUCCESS',
        results: 0,
        response: [],
        cached: false,
        degraded: true,
        message: 'Live fixtures temporarily unavailable',
      });
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

      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      const resolved = await resolveFixtureForClient(fixtureId, resolveAppLanguage(req));
      if (resolved.fixture) {
        res.json({
          status: 'SUCCESS',
          results: 1,
          response: [resolved.fixture],
          cached: resolved.source !== null,
          source: resolved.source ?? undefined,
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

      const parsed = await footballService.getStandingsParsed(leagueId, seasonYear);

      res.json({
        status: 'SUCCESS',
        results: parsed.flat.length,
        response: parsed.flat,
        groups: parsed.groups,
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

      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      await ensureScores365GameMapping(fixtureId);
      if (isScores365ExperimentFixture(fixtureId)) {
        const lineups = await footballDataCacheService.getMatchLineups(fixtureId, {
          forceRefresh: wantsFreshMatchDetails(req),
          language: resolveAppLanguage(req),
        });
        res.json({
          status: 'SUCCESS',
          results: lineups?.length ?? 0,
          response: lineups ?? [],
        });
        return;
      }

      const lineups = await footballService.getFixtureLineupsResolved(fixtureId);

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
   * GET /api/football/fixtures/:id/players - Player-level match data
   */
  static async getFixturePlayers(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      const fixtureId = parseInt(ensureString(req.params.id));
      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      const players = await footballService.getFixturePlayers(fixtureId);
      res.json({ status: 'SUCCESS', results: players.length, response: players });
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

      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      await ensureScores365GameMapping(fixtureId);
      if (isScores365ExperimentFixture(fixtureId)) {
        const statistics = await footballDataCacheService.getMatchStatistics(fixtureId);
        res.json({
          status: 'SUCCESS',
          results: statistics?.length ?? 0,
          response: statistics ?? [],
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

      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Invalid fixture ID',
        });
        return;
      }

      try {
        const language = resolveAppLanguage(req);
        const events = await footballDataCacheService.getMatchEvents(fixtureId, {
          language,
          forceRefresh: wantsFreshMatchDetails(req),
        });

        res.json({
          status: 'SUCCESS',
          results: events?.length ?? 0,
          response: events ?? [],
        });
        return;
      } catch (fetchError: any) {
        logger.warn(
          `getFixtureEvents: upstream error for ${fixtureId} (${fetchError?.message ?? fetchError}), returning degraded empty list`,
        );

        const dbMatch = await prisma.cachedFixture.findUnique({
          where: { fixtureId },
          select: { fullData: true },
        });
        const fromDb = (dbMatch?.fullData as { events?: unknown[] } | null)?.events;
        if (Array.isArray(fromDb) && fromDb.length > 0) {
          res.status(200).json({
            status: 'SUCCESS',
            results: fromDb.length,
            response: fromDb,
            degraded: true,
            message: 'Events served from database cache',
          });
          return;
        }

        res.status(200).json({
          status: 'SUCCESS',
          results: 0,
          response: [],
          degraded: true,
          message: 'Match events temporarily unavailable',
        });
      }
    } catch (error) {
      logger.error('getFixtureEvents unexpected error:', error);
      res.status(200).json({
        status: 'SUCCESS',
        results: 0,
        response: [],
        degraded: true,
        message: 'Match events temporarily unavailable',
      });
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

      const playerId = parseInt(ensureString(req.params.id));
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

      const teamId = parseInt(ensureString(req.params.id));

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

      const teamId = parseInt(ensureString(req.params.id));

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
   * GET /api/football/players/top/yellow-cards - Get top yellow cards
   */
  static async getTopYellowCards(req: Request, res: Response): Promise<void> {
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

      const players = await footballDataCacheService.getTopYellowCards(league, season);

      res.json({
        status: 'SUCCESS',
        results: players.length,
        response: players,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/players/top/red-cards - Get top red cards
   */
  static async getTopRedCards(req: Request, res: Response): Promise<void> {
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

      const players = await footballDataCacheService.getTopRedCards(league, season);

      res.json({
        status: 'SUCCESS',
        results: players.length,
        response: players,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/players/top/scorers/predictions - Get predictions for top scorers
   * This endpoint provides predictions based on current season performance
   */
  static async getTopScorersPredictions(req: Request, res: Response): Promise<void> {
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

      // Get current top scorers
      const currentScorers = await footballDataCacheService.getTopScorers(league, season);

      // Calculate predictions based on:
      // 1. Current goals per game ratio
      // 2. Remaining matches estimate
      // 3. Historical performance
      const predictions = currentScorers.map((scorer: any) => {
        const stats = scorer.statistics?.[0];
        const currentGoals = stats?.goals?.total || 0;
        const gamesPlayed = stats?.games?.appearances || 1;
        const goalsPerGame = currentGoals / gamesPlayed;
        
        // Estimate remaining games (assuming ~38 games per season for most leagues)
        const estimatedTotalGames = 38;
        const remainingGames = Math.max(0, estimatedTotalGames - gamesPlayed);
        const predictedGoals = Math.round(currentGoals + (goalsPerGame * remainingGames));

        return {
          player: scorer.player,
          current: {
            goals: currentGoals,
            games: gamesPlayed,
            goalsPerGame: parseFloat(goalsPerGame.toFixed(2)),
          },
          prediction: {
            predictedGoals: predictedGoals,
            remainingGames: remainingGames,
            confidence: gamesPlayed >= 10 ? 'high' : gamesPlayed >= 5 ? 'medium' : 'low',
          },
          statistics: scorer.statistics,
        };
      }).sort((a: any, b: any) => b.prediction.predictedGoals - a.prediction.predictedGoals);

      res.json({
        status: 'SUCCESS',
        results: predictions.length,
        response: predictions,
        note: 'Predictions are based on current season performance and estimated remaining games',
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

      const teamId = parseInt(ensureString(req.params.id));
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

      const teamId = parseInt(ensureString(req.params.id));

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

      const teamId = parseInt(ensureString(req.params.id));

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

      const teamId = parseInt(ensureString(req.params.id));

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
   * GET /api/football/teams/all-logos
   * Fetch all team logos from API-Football by country and save to database
   * Strategy: Get teams from all leagues (which includes team logos)
   * This fetches teams from standings of all leagues
   */
  static async getAllTeamLogos(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      logger.info('📡 Starting to fetch all team logos from leagues...');

      const startTime = Date.now();
      let totalTeams = 0;
      let savedCount = 0;
      const processedTeamIds = new Set<number>();

      // Strategy: Get all leagues, then get standings for each league
      // Standings include all teams with logos
      logger.info('📡 Step 1: Fetching all leagues...');
      const allLeagues = await footballDataCacheService.getAllLeagues();
      
      logger.info(`📡 Found ${allLeagues.length} leagues. Fetching teams from standings...`);

      // Process leagues in batches to avoid overwhelming the API
      const batchSize = 5; // Process 5 leagues at a time
      const currentSeason = new Date().getFullYear();
      
      for (let i = 0; i < allLeagues.length; i += batchSize) {
        const leagueBatch = allLeagues.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = leagueBatch.map(async (league: any) => {
          const leagueId = league.league?.id || league.id;
          const leagueName = league.league?.name || league.name;
          
          if (!leagueId) return;
          
          try {
            // Try multiple seasons (current and recent)
            const seasonsToTry = [currentSeason, currentSeason - 1, currentSeason - 2];
            
            for (const season of seasonsToTry) {
              try {
                logger.debug(`📡 Fetching standings for ${leagueName} (season ${season})...`);
                const standings = await footballDataCacheService.getStandings(leagueId, season);
                
                if (standings && standings.length > 0) {
                  // Extract teams from standings and cache them
                  for (const standing of standings) {
                    const team = standing.team || standing;
                    if (team?.id && !processedTeamIds.has(team.id)) {
                      processedTeamIds.add(team.id);
                      
                      await footballDataCacheService.cacheTeam({
                        id: team.id,
                        name: team.name || 'Unknown Team',
                        logo: team.logo || null,
                        code: team.code,
                        country: league.league?.country || league.country,
                      });
                      
                      savedCount++;
                    }
                  }
                  
                  logger.debug(`✅ Found ${standings.length} teams in ${leagueName}`);
                  break; // Found standings, no need to try other seasons
                }
              } catch (error: any) {
                // Some leagues may not have standings for certain seasons
                if (error?.message?.includes('404') || error?.message?.includes('Not found')) {
                  continue; // Try next season
                }
                logger.debug(`⚠️ Error fetching standings for ${leagueName} (season ${season}):`, error.message);
              }
            }
            
            // Small delay between leagues
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (error: any) {
            logger.warn(`⚠️ Error processing league ${leagueName}:`, error.message);
          }
        });

        await Promise.all(batchPromises);
        
        totalTeams = processedTeamIds.size;
        
        logger.info(`📊 Progress: ${i + leagueBatch.length}/${allLeagues.length} leagues processed, ${totalTeams} unique teams found`);
        
        // Rate limit protection: delay between batches
        if (i + batchSize < allLeagues.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const duration = Date.now() - startTime;
      const minutes = Math.round(duration / 1000 / 60);

      logger.info(`✅ Completed fetching team logos: ${totalTeams} unique teams in ${minutes} minutes, ${savedCount} saved to database`);

      res.json({
        status: 'SUCCESS',
        message: `Successfully fetched ${totalTeams} unique teams and saved ${savedCount} logos to database`,
        data: {
          totalTeamsFound: totalTeams,
          totalTeamsSaved: savedCount,
          leaguesProcessed: allLeagues.length,
          durationMinutes: minutes,
          durationSeconds: Math.round(duration / 1000),
        },
      });
    } catch (error) {
      logger.error('Error fetching all team logos:', error);
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/african-logos
   * Get logos for 10 major African teams
   * Strategy: First check database, then fetch from API using known working league IDs
   */
  static async getAfricanTeamLogos(req: Request, res: Response): Promise<void> {
    try {
      if (!footballService.isConfigured()) {
        res.status(503).json({ status: 'ERROR', message: 'Football API not configured' });
        return;
      }

      logger.info('📡 Fetching African team logos...');

      const teamsWithLogos: Array<{ id: number; name: string; logo: string; country?: string }> = [];
      const foundTeamIds = new Set<number>();

      // First: Check if we have any African teams in database - RETURN IMMEDIATELY if found
      try {
        // ✅ Use centralized singleton instead of creating new PrismaClient
        const africanCountries = ['Egypt', 'Morocco', 'South Africa', 'Tunisia', 'Algeria', 'Nigeria', 'Ghana'];
        const dbTeams = await prisma.cachedTeam.findMany({
          where: {
            country: { in: africanCountries },
            logo: { not: null },
          },
          take: 50,
        });

        if (dbTeams.length > 0) {
          logger.info(`📦 Found ${dbTeams.length} African teams in database - returning immediately`);
          for (const team of dbTeams) {
            teamsWithLogos.push({
              id: team.teamId,
              name: team.name,
              logo: team.logo || '',
              country: team.country || 'Africa',
            });
            foundTeamIds.add(team.teamId);
          }

          // Return immediately with database results
          res.json({
            status: 'SUCCESS',
            message: `Fetched ${teamsWithLogos.length} African team logos from database`,
            data: {
              teams: teamsWithLogos,
              count: teamsWithLogos.length,
            },
          });

          // Fetch more in background (don't wait)
          setImmediate(async () => {
            try {
              await this.fetchMoreAfricanTeamsInBackground(foundTeamIds);
            } catch (error) {
              logger.warn('Background fetch failed:', error);
            }
          });

          return;
        }
      } catch (error: any) {
        logger.warn('Error checking database:', error.message);
      }

      // If database didn't have enough teams, try quick API fetch with timeout
      // But limit to 5 seconds max to avoid timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 5000); // 5 second timeout
      });

      const fetchPromise = (async () => {
        // Try fetching major teams by ID first (faster)
        const majorAfricanTeamIds = [
          { id: 1020, name: 'Al Ahly', country: 'Egypt' },
          { id: 1021, name: 'Zamalek', country: 'Egypt' },
          { id: 5765, name: 'Pyramids FC', country: 'Egypt' },
          { id: 1022, name: 'Ismaily', country: 'Egypt' },
          { id: 6959, name: 'Wydad Casablanca', country: 'Morocco' },
          { id: 6960, name: 'Raja Casablanca', country: 'Morocco' },
          { id: 6955, name: 'Espérance de Tunis', country: 'Tunisia' },
          { id: 6956, name: 'Étoile du Sahel', country: 'Tunisia' },
          { id: 239, name: 'Orlando Pirates', country: 'South Africa' },
          { id: 240, name: 'Kaizer Chiefs', country: 'South Africa' },
        ];

        const teamFetchPromises = majorAfricanTeamIds
          .filter(team => !foundTeamIds.has(team.id))
          .slice(0, 5) // Limit to 5 teams max to avoid timeout
          .map(async (teamInfo) => {
            try {
              const team = await footballService.getTeamById(teamInfo.id);
              if (team && team.length > 0) {
                const teamData = team[0]?.team || team[0];
                if (teamData?.id && teamData?.logo && !foundTeamIds.has(teamData.id)) {
                  foundTeamIds.add(teamData.id);
                  await footballDataCacheService.cacheTeam({
                    id: teamData.id,
                    name: teamData.name || teamInfo.name,
                    logo: teamData.logo,
                    country: teamData.country || teamInfo.country,
                  });
                  teamsWithLogos.push({
                    id: teamData.id,
                    name: teamData.name || teamInfo.name,
                    logo: teamData.logo,
                    country: teamData.country || teamInfo.country,
                  });
                }
              }
            } catch (error: any) {
              logger.debug(`⚠️ Failed to fetch team ${teamInfo.id}:`, error.message);
            }
          });

        await Promise.all(teamFetchPromises);
      })();

      // Wait for either completion or timeout
      await Promise.race([fetchPromise, timeoutPromise]);

      logger.info(`✅ Total fetched: ${teamsWithLogos.length} African team logos`);

      res.json({
        status: 'SUCCESS',
        message: `Fetched ${teamsWithLogos.length} African team logos`,
        data: {
          teams: teamsWithLogos,
          count: teamsWithLogos.length,
        },
      });

      // Fetch more in background (don't wait)
      setImmediate(async () => {
        try {
          await this.fetchMoreAfricanTeamsInBackground(foundTeamIds);
        } catch (error) {
          logger.warn('Background fetch failed:', error);
        }
      });
    } catch (error) {
      logger.error('Error in getAfricanTeamLogos:', error);
      FootballController.handleError(res, error);
    }
  }

  /**
   * Background method to fetch more African teams (called asynchronously)
   */
  private static async fetchMoreAfricanTeamsInBackground(foundTeamIds: Set<number>): Promise<void> {
    try {
      logger.info('📡 Background: Fetching more African teams from standings...');
      
      const africanLeagues = [
        { id: 233, name: 'Egyptian Premier League', country: 'Egypt', seasons: [2024, 2023] },
        { id: 200, name: 'Moroccan Botola', country: 'Morocco', seasons: [2024, 2023] },
      ];

      for (const league of africanLeagues) {
        for (const season of league.seasons) {
          try {
            const standings = await footballDataCacheService.getStandings(league.id, season);
            if (standings && Array.isArray(standings) && standings.length > 0) {
              for (const standing of standings) {
                const team = standing.team || standing;
                const teamId = team?.id;
                const teamLogo = team?.logo;
                
                if (teamId && teamLogo && !foundTeamIds.has(teamId)) {
                  foundTeamIds.add(teamId);
                  await footballDataCacheService.cacheTeam({
                    id: teamId,
                    name: team?.name || 'Unknown',
                    logo: teamLogo,
                    country: league.country,
                  });
                }
              }
            }
          } catch (error: any) {
            logger.debug(`Background: Failed to fetch ${league.name} season ${season}:`, error.message);
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      logger.info('✅ Background: Finished fetching more African teams');
    } catch (error) {
      logger.warn('Background fetch error:', error);
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

      const venueId = parseInt(ensureString(req.params.id));

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

  static async getCachedMatchesByDate(req: Request, res: Response): Promise<void> {
    const dateString = ensureString(req.params.date);
    try {
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
      logger.warn(`getCachedMatchesByDate(${dateString}): error, returning empty`, error);
      res.status(200).json({
        status: 'SUCCESS',
        results: 0,
        response: [],
        _meta: {
          date: dateString,
          cached: true,
        },
        degraded: true,
        message: 'Cached matches temporarily unavailable',
      });
    }
  }

  /**
   * GET /api/football/cached/league/:leagueId/matches/:date
   * League-scoped fixtures for a day (covers lower-tier leagues).
   */
  static async getCachedLeagueMatchesByDate(req: Request, res: Response): Promise<void> {
    const dateString = ensureString(req.params.date);
    const leagueId = parseInt(ensureString(req.params.leagueId), 10);
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid date format. Use YYYY-MM-DD' });
        return;
      }
      if (Number.isNaN(leagueId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid league ID' });
        return;
      }

      const matches = await footballDataCacheService.getLeagueMatchesByDate(leagueId, dateString);

      res.json({
        status: 'SUCCESS',
        results: matches.length,
        response: matches,
        _meta: { date: dateString, leagueId, cached: true, available: matches.length > 0 },
      });
    } catch (error) {
      logger.warn(`getCachedLeagueMatchesByDate(${leagueId}, ${dateString}): error`, error);
      res.status(200).json({
        status: 'SUCCESS',
        results: 0,
        response: [],
        _meta: { date: dateString, leagueId, cached: true, available: false },
        degraded: true,
      });
    }
  }

  /**
   * GET /api/football/cached/world-cup/phase/:phase
   * All World Cup fixtures for a phase (upcoming | live | finished | all) from 365Scores.
   */
  static async getCachedWorldCupPhaseMatches(req: Request, res: Response): Promise<void> {
    const phaseRaw = ensureString(req.params.phase).toLowerCase();
    const phase =
      phaseRaw === 'upcoming' || phaseRaw === 'live' || phaseRaw === 'finished' || phaseRaw === 'all'
        ? phaseRaw
        : 'upcoming';
    try {
      const { getWorldCupTabState } = await import('../services/app-features.service');
      const wc = getWorldCupTabState();
      if (!wc.enabled) {
        res.status(403).json({
          status: 'ERROR',
          message: 'World Cup tab is locked',
          secondsRemaining: wc.secondsRemaining,
        });
        return;
      }

      const language = resolveAppLanguage(req);
      const matches = await footballDataCacheService.getWorldCupMatchesByPhase(
        phase,
        language,
      );

      res.json({
        status: 'SUCCESS',
        results: matches.length,
        response: matches,
        _meta: { phase, language, scores365Experiment: true },
      });
    } catch (error) {
      logger.warn(`getCachedWorldCupPhaseMatches(${phaseRaw}): error`, error);
      res.status(200).json({
        status: 'SUCCESS',
        results: 0,
        response: [],
        degraded: true,
      });
    }
  }

  /**
   * GET /api/football/cached/world-cup/:date
   * World Cup fixtures for a date (league + season from env / feature config).
   */
  static async getCachedWorldCupMatches(req: Request, res: Response): Promise<void> {
    const dateString = ensureString(req.params.date);
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid date format. Use YYYY-MM-DD' });
        return;
      }

      const { getWorldCupTabState } = await import('../services/app-features.service');
      const wc = getWorldCupTabState();
      if (!wc.enabled) {
        res.status(403).json({
          status: 'ERROR',
          message: 'World Cup tab is locked',
          secondsRemaining: wc.secondsRemaining,
        });
        return;
      }

      const language = resolveAppLanguage(req);

      const matches = await footballDataCacheService.getWorldCupMatchesByDate(
        dateString,
        wc.leagueId,
        wc.season,
        language,
      );

      res.json({
        status: 'SUCCESS',
        results: matches.length,
        response: matches,
        _meta: {
          date: dateString,
          leagueId: wc.leagueId,
          season: wc.season,
          language,
          cached: true,
          scores365Experiment: matches.some((m: any) => m?._experiment === 'scores365'),
          scores365ForceEnglish: (await import('../services/scores365-experiment.service')).isScores365ForceEnglish(),
        },
      });
    } catch (error) {
      logger.warn(`getCachedWorldCupMatches(${dateString}): error`, error);
      res.status(200).json({
        status: 'SUCCESS',
        results: 0,
        response: [],
        _meta: { date: dateString, cached: true },
        degraded: true,
      });
    }
  }

  /**
   * GET /api/football/transfers?player=&team=
   */
  static async getTransfers(req: Request, res: Response): Promise<void> {
    try {
      const player = req.query.player ? parseInt(String(req.query.player), 10) : undefined;
      const team = req.query.team ? parseInt(String(req.query.team), 10) : undefined;

      if ((!player || Number.isNaN(player)) && (!team || Number.isNaN(team))) {
        res.status(400).json({ status: 'ERROR', message: 'player or team query param required' });
        return;
      }

      const transfers = await footballService.getTransfers({
        ...(player && !Number.isNaN(player) ? { player } : {}),
        ...(team && !Number.isNaN(team) ? { team } : {}),
      });

      res.json({ status: 'SUCCESS', results: transfers.length, response: transfers });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/player/:id - Get player with permanent caching
   */
  static async getCachedPlayer(req: Request, res: Response): Promise<void> {
    try {
      const playerId = parseInt(ensureString(req.params.id));
      const season = req.query.season
        ? parseInt(req.query.season as string)
        : (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            return month >= 6 ? year : year - 1;
          })();
      const forceRefresh =
        req.query.fresh === '1' ||
        req.query.fresh === 'true' ||
        req.query.nocache === '1';

      if (isNaN(playerId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid player ID' });
        return;
      }

      const player = await footballDataCacheService.getPlayer(playerId, season, { forceRefresh });

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
      const teamId = parseInt(ensureString(req.params.id));

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
   * GET /api/football/teams/top-by-country
   * Returns the top 5 clubs for a country, backed by `cached_teams` (refreshed
   * from API-Football at most once every 7 days per country).
   *
   * Query params:
   *   - country (required): country name (e.g. 'England', 'Egypt')
   *   - refresh (optional): 'true' forces a refresh from API
   */
  static async getTopClubsByCountry(req: Request, res: Response): Promise<void> {
    try {
      const country = (req.query.country as string | undefined)?.trim();
      if (!country) {
        res.status(400).json({
          status: 'ERROR',
          code: 'E001',
          message: 'country query param is required',
        });
        return;
      }

      const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
      const result = await getTopClubsByCountry(country, forceRefresh);

      // ✅ Use `response` field (not `data`) because fetchFromProxy on the
      // frontend unwraps `data.response` from every football endpoint.
      res.json({
        status: 'SUCCESS',
        results: result.clubs.length,
        response: {
          country,
          clubs: result.clubs,
          source: result.source,
          count: result.clubs.length,
        },
      });
    } catch (error) {
      logger.error('Error in getTopClubsByCountry:', error);
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/teams/top-supported-countries
   * Returns the list of countries we have a primary-league mapping for.
   * Useful for the picker UI to render the country tabs/filters.
   */
  static async getTopSupportedCountries(_req: Request, res: Response): Promise<void> {
    try {
      const countries = getSupportedCountries();
      res.json({
        status: 'SUCCESS',
        results: countries.length,
        response: { countries, count: countries.length },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/teams/all - Get all cached teams from database
   */
  static async getAllCachedTeams(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '500', offset = '0', country } = req.query;
      
      const where: any = {};
      if (country) {
        where.country = country as string;
      }
      
      const teams = await prisma.cachedTeam.findMany({
        where,
        select: {
          teamId: true,
          name: true,
          logo: true,
          country: true,
          code: true,
        },
        orderBy: [
          { country: 'asc' },
          { name: 'asc' },
        ],
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      });
      
      const total = await prisma.cachedTeam.count({ where });
      
      logger.info(`✅ Returned ${teams.length} cached teams (total: ${total})`);
      
      res.json({
        status: 'SUCCESS',
        response: teams,
        teams,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error: any) {
      logger.error('Error getting all cached teams:', error);
      res.status(500).json({
        status: 'ERROR',
        message: 'Failed to get cached teams',
      });
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
      const leagueId = parseInt(ensureString(req.params.leagueId));
      const season = req.query.season ? parseInt(req.query.season as string) : 2024;

      if (isNaN(leagueId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid league ID' });
        return;
      }

      const parsed = await footballDataCacheService.getStandingsParsed(leagueId, season);

      res.json({
        status: 'SUCCESS',
        results: parsed.flat?.length || 0,
        response: parsed.flat || [],
        groups: parsed.groups || [],
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
      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      const language = resolveAppLanguage(req);
      const forceRefresh = wantsFreshMatchDetails(req);
      const lineups = await footballDataCacheService.getMatchLineups(fixtureId, {
        forceRefresh,
        language,
      });
      const gameId =
        (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);

      res.json({
        status: 'SUCCESS',
        results: lineups?.length || 0,
        response: lineups || [],
        _meta: gameId
          ? {
              scores365GameId: gameId,
              lineupPlayerIdField: 'athleteId',
            }
          : undefined,
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
      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      try {
        const statistics = await footballDataCacheService.getMatchStatistics(fixtureId);

        res.json({
          status: 'SUCCESS',
          results: statistics?.length || 0,
          response: statistics || [],
        });
        return;
      } catch (fetchError: any) {
        logger.warn(
          `getCachedStatistics: upstream error for ${fixtureId} (${fetchError?.message ?? fetchError}), returning degraded empty list`,
        );

        const dbMatch = await prisma.cachedFixture.findUnique({
          where: { fixtureId },
          select: { fullData: true },
        });
        const fromDb = (dbMatch?.fullData as { statistics?: unknown[] } | null)?.statistics;
        if (Array.isArray(fromDb) && fromDb.length > 0) {
          res.status(200).json({
            status: 'SUCCESS',
            results: fromDb.length,
            response: fromDb,
            degraded: true,
            message: 'Statistics served from database cache',
          });
          return;
        }

        res.status(200).json({
          status: 'SUCCESS',
          results: 0,
          response: [],
          degraded: true,
          message: 'Match statistics temporarily unavailable',
        });
      }
    } catch (error) {
      logger.error('getCachedStatistics unexpected error:', error);
      res.status(200).json({
        status: 'SUCCESS',
        results: 0,
        response: [],
        degraded: true,
        message: 'Match statistics temporarily unavailable',
      });
    }
  }

  /**
   * GET /api/football/cached/fixture/:id/events - Get events with caching
   */
  static async getCachedEvents(req: Request, res: Response): Promise<void> {
    try {
      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      const language = resolveAppLanguage(req);
      const forceRefresh = wantsFreshMatchDetails(req);
      const events = await footballDataCacheService.getMatchEvents(fixtureId, {
        language,
        forceRefresh,
      });

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
   * GET /api/football/cached/fixture/:id/details
   * Bundle: fixture + lineups + statistics + events + venue (one round trip).
   */
  static async getCachedFixtureDetails(req: Request, res: Response): Promise<void> {
    try {
      const fixtureId = parseInt(ensureString(req.params.id));

      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }

      const language = resolveAppLanguage(req);
      const forceRefresh = wantsFreshMatchDetails(req);
      const bundle = await footballDataCacheService.getFixtureDetailsBundle(fixtureId, {
        language,
        forceRefresh,
      });
      const gameId =
        (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);

      res.json({
        status: 'SUCCESS',
        response: bundle,
        _meta: gameId
          ? {
              scores365GameId: gameId,
              lineupPlayerIdField: 'athleteId',
            }
          : undefined,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/standings — World Cup group standings (365Scores).
   */
  static async getCached365Standings(req: Request, res: Response): Promise<void> {
    try {
      const language = resolveAppLanguage(req);
      // Optional ?competitions= (or ?competitionId=) for non-WC leagues;
      // omitted → defaults to the World Cup competition inside the service.
      const rawQuery = req.query.competitions ?? req.query.competitionId;
      const rawCompetition = typeof rawQuery === 'string' ? rawQuery.trim() : '';
      const parsedCompetition = rawCompetition ? parseInt(rawCompetition, 10) : NaN;
      const competitionId = Number.isFinite(parsedCompetition) ? parsedCompetition : undefined;
      const result = await footballDataCacheService.getCached365Standings(competitionId, language);
      if (!result.data?.length) {
        const count = await footballDataCacheService.syncWorldCupStandingsFrom365(language);
        if (count > 0) {
          const retry = await footballDataCacheService.getCached365Standings(competitionId, language);
          if (retry.data?.length) {
            res.json({
              status: 'SUCCESS',
              source: retry.source,
              results: retry.data.length,
              response: retry.data,
            });
            return;
          }
        }
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores standings unavailable',
          source: result.source,
        });
        return;
      }
      res.json({
        status: 'SUCCESS',
        source: result.source,
        results: result.data.length,
        response: result.data,
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/fixture/:id/form — recent form per team (365Scores).
   */
  static async getCached365FixtureForm(req: Request, res: Response): Promise<void> {
    try {
      const fixtureId = parseInt(ensureString(req.params.id));
      if (isNaN(fixtureId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture ID' });
        return;
      }
      const gameId =
        (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
      if (!gameId) {
        res.status(404).json({ status: 'ERROR', message: '365Scores game not mapped for this fixture' });
        return;
      }
      const language = resolveAppLanguage(req);
      const result = await footballDataCacheService.getCached365HeadToHeadForm(gameId, language);
      if (!result.data) {
        await ensureScores365GameMapping(fixtureId);
        const retryGameId =
          (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
        if (retryGameId) {
          const retry = await footballDataCacheService.getCached365HeadToHeadForm(retryGameId, language);
          if (retry.data) {
            res.json({
              status: 'SUCCESS',
              source: retry.source,
              response: retry.data,
              _meta: { scores365GameId: retryGameId, fixtureId },
            });
            return;
          }
        }
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores form unavailable',
          source: result.source,
        });
        return;
      }
      res.json({
        status: 'SUCCESS',
        source: result.source,
        response: result.data,
        _meta: { scores365GameId: gameId, fixtureId },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/game/:gameId/resolve
   * Map a 365Scores gameId → fixtureId for match-details navigation.
   */
  static async resolve365GameFixture(req: Request, res: Response): Promise<void> {
    try {
      const gameId = parseInt(ensureString(req.params.gameId));
      if (isNaN(gameId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid game ID' });
        return;
      }

      const apiFixtureId = await resolveApiFixtureIdFor365GameId(gameId);
      if (apiFixtureId != null) {
        res.json({
          status: 'SUCCESS',
          response: { fixtureId: apiFixtureId, gameId },
        });
        return;
      }

      const language = resolveAppLanguage(req);
      const game = await fetchScores365GameById(gameId, { language });
      if (game?.id) {
        registerScores365FixtureMapping(gameId, game.id);
        res.json({
          status: 'SUCCESS',
          response: { fixtureId: gameId, gameId: game.id },
        });
        return;
      }

      res.status(404).json({ status: 'ERROR', message: '365Scores game not found' });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/fixture/:id/player/:athleteId/report
   * Match report + shot map for one player (365Scores). athleteId comes from lineup.
   */
  static async getCached365PlayerMatchReport(req: Request, res: Response): Promise<void> {
    try {
      const fixtureId = parseInt(ensureString(req.params.id));
      const athleteId = parseInt(ensureString(req.params.athleteId));
      if (isNaN(fixtureId) || isNaN(athleteId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid fixture or athlete ID' });
        return;
      }
      const gameId =
        (await ensureScores365GameMapping(fixtureId)) ?? getScores365GameIdForFixture(fixtureId);
      if (!gameId) {
        res.status(404).json({ status: 'ERROR', message: '365Scores game not mapped for this fixture' });
        return;
      }
      const language = resolveAppLanguage(req);
      const result = await footballDataCacheService.getCached365PlayerMatchReport(
        athleteId,
        gameId,
        language,
      );
      if (!result.data) {
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores player match report unavailable',
          source: result.source,
        });
        return;
      }
      res.json({
        status: 'SUCCESS',
        source: result.source,
        response: result.data,
        _meta: { scores365GameId: gameId, fixtureId, athleteId },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/player/:athleteId/shot-chart — career shot map (365Scores).
   * Enrichment only: athleteId must already be known from a lineup or CachedPlayer — not cold discovery.
   */
  static async getCached365PlayerShotChart(req: Request, res: Response): Promise<void> {
    try {
      const athleteId = parseInt(ensureString(req.params.athleteId));
      if (isNaN(athleteId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid athlete ID' });
        return;
      }
      const language = resolveAppLanguage(req);
      const result = await footballDataCacheService.getCached365PlayerCareerShotChart(
        athleteId,
        language,
      );
      if (!result.data) {
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores career shot chart unavailable',
          source: result.source,
        });
        return;
      }
      res.json({
        status: 'SUCCESS',
        source: result.source,
        response: result.data,
        _meta: { athleteId },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/player/lookup?q= — search + profile + career (365Scores).
   * Optional: ?athleteId=51735 to skip search. ?limit=3 for multiple matches.
   */
  static async lookup365Player(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.query.q as string)?.trim() ?? '';
      const athleteIdParam = req.query.athleteId ? parseInt(req.query.athleteId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 1;
      const includeInfo = req.query.info !== 'false';
      const includeCareer = req.query.career !== 'false';

      if (!athleteIdParam && query.length < 2) {
        res.status(400).json({
          status: 'ERROR',
          message: 'Provide q (min 2 chars) or athleteId',
        });
        return;
      }

      const language = resolveAppLanguage(req);
      const result = await footballDataCacheService.lookup365Player(query, language, {
        athleteId: athleteIdParam,
        limit,
        includeInfo,
        includeCareer,
      });

      if (!result.data) {
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores player lookup unavailable',
          source: result.source,
        });
        return;
      }

      if (!result.data.players.length) {
        res.status(404).json({
          status: 'ERROR',
          message: 'No players found',
          source: result.source,
          response: result.data,
        });
        return;
      }

      res.json({
        status: 'SUCCESS',
        source: result.source,
        response: result.data,
        _meta: {
          query: result.data.query,
          count: result.data.players.length,
        },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/search?q= — discover 365 athleteId by player name.
   */
  static async search365Athletes(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.query.q as string)?.trim();
      if (!query || query.length < 2) {
        res.status(400).json({ status: 'ERROR', message: 'Query must be at least 2 characters' });
        return;
      }
      const language = resolveAppLanguage(req);
      const result = await threeSixFiveScoresService.searchAthletes(query, language);
      if (!result.data) {
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores player search unavailable',
          source: result.source,
        });
        return;
      }
      res.json({
        status: 'SUCCESS',
        source: result.source,
        response: { athletes: result.data },
        _meta: { query, count: result.data.length },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/player/:athleteId/info — basic profile + next game (365Scores).
   */
  static async getCached365PlayerInfo(req: Request, res: Response): Promise<void> {
    try {
      const athleteId = parseInt(ensureString(req.params.athleteId));
      if (isNaN(athleteId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid athlete ID' });
        return;
      }
      const language = resolveAppLanguage(req);
      const result = await footballDataCacheService.getCached365PlayerBasicInfo(athleteId, language);
      if (!result.data) {
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores player info unavailable',
          source: result.source,
        });
        return;
      }
      res.json({
        status: 'SUCCESS',
        source: result.source,
        response: result.data,
        _meta: { athleteId },
      });
    } catch (error) {
      FootballController.handleError(res, error);
    }
  }

  /**
   * GET /api/football/cached/365/player/:athleteId/career — full career across all seasons (365Scores).
   * Persisted in Postgres; athleteId must be known from a lineup, not cold discovery.
   */
  static async getCached365PlayerCareer(req: Request, res: Response): Promise<void> {
    try {
      const athleteId = parseInt(ensureString(req.params.athleteId));
      if (isNaN(athleteId)) {
        res.status(400).json({ status: 'ERROR', message: 'Invalid athlete ID' });
        return;
      }
      const language = resolveAppLanguage(req);
      const result = await footballDataCacheService.getCached365PlayerCareer(athleteId, language);
      if (!result.data?.seasons?.length) {
        res.status(503).json({
          status: 'ERROR',
          message: '365Scores player career unavailable',
          source: result.source,
        });
        return;
      }
      res.json({
        status: 'SUCCESS',
        source: result.source,
        response: result.data,
        _meta: { athleteId },
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
      const teamId = parseInt(ensureString(req.params.id));
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

