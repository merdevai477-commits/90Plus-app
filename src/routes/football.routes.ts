import { Router } from 'express';
import { FootballController } from '../controllers/football.controller';
import { responseCacheMiddleware } from '../middleware/responseCache.middleware';

// Shared public cache TTLs for football data (no userId in key — same response for all users)
const SHARED_CACHE_15S  = responseCacheMiddleware({ ttl: 15  * 1000, sharedCache: true });
const SHARED_CACHE_30S  = responseCacheMiddleware({ ttl: 30  * 1000, sharedCache: true });
const SHARED_CACHE_60S  = responseCacheMiddleware({ ttl: 60  * 1000, sharedCache: true });
const SHARED_CACHE_8S   = responseCacheMiddleware({ ttl: 8   * 1000, sharedCache: true });
const SHARED_CACHE_5MIN = responseCacheMiddleware({ ttl: 5   * 60 * 1000, sharedCache: true });
const SHARED_CACHE_1H   = responseCacheMiddleware({ ttl: 60  * 60 * 1000, sharedCache: true });
const SHARED_CACHE_24H  = responseCacheMiddleware({ ttl: 24  * 60 * 60 * 1000, sharedCache: true });

const router = Router();

// ============================================
// GET /api/football/health
// Health check for Football API
// ============================================
router.get('/health', FootballController.getHealth);

// ============================================
// GET /api/football/leagues
// Get all available leagues
// ============================================
router.get('/leagues', SHARED_CACHE_1H, FootballController.getLeagues);

// GET /api/football/leagues/all
// Get all available leagues with caching
router.get('/leagues/all', SHARED_CACHE_24H, FootballController.getAllLeagues);

// GET /api/football/teams/all-logos
// Fetch ALL team logos from API-Football and save to database
// Query params: page (optional), limit (optional, default 100)
router.get('/teams/all-logos', FootballController.getAllTeamLogos);

// GET /api/football/teams/african-logos
// Get logos for 10 major African teams
router.get('/teams/african-logos', SHARED_CACHE_24H, FootballController.getAfricanTeamLogos);

// GET /api/football/teams/top-supported-countries
// Returns the list of countries we have a primary-league mapping for. Used by
// the club-picker UI to render country tabs.
router.get('/teams/top-supported-countries', SHARED_CACHE_24H, FootballController.getTopSupportedCountries);

// GET /api/football/teams/top-by-country
// Returns the top 5 clubs for a country (cached for 7 days in cached_teams).
// Query: ?country=England[&refresh=true]
router.get('/teams/top-by-country', SHARED_CACHE_1H, FootballController.getTopClubsByCountry);

// ============================================
// GET /api/football/fixtures
// Get fixtures with filters — smart TTL based on date param
// Past dates: 24h cache | Today: 60s | Future: 5min | No date: 30s
// ============================================
router.get('/fixtures', (req, res, next) => {
  const dateParam = req.query.date as string | undefined;
  if (dateParam) {
    const today = new Date().toISOString().split('T')[0];
    if (dateParam < today) {
      // Past date — permanent-ish cache (24h)
      return SHARED_CACHE_24H(req, res, next);
    } else if (dateParam === today) {
      // Today — refresh every 60s; live scores also flow via WebSocket + live sync job
      return SHARED_CACHE_60S(req, res, next);
    } else {
      // Future date — 5min cache
      return SHARED_CACHE_5MIN(req, res, next);
    }
  }
  // No date filter (live/other) — 8s
  return SHARED_CACHE_8S(req, res, next);
}, FootballController.getFixtures);

// GET /api/football/search
// Unified search across players, teams, leagues
router.get('/search', SHARED_CACHE_5MIN, FootballController.search);

// ============================================
// GET /api/football/fixtures/live
// Get live fixtures — shared 8s cache (same for all users)
// ============================================
router.get('/fixtures/live', SHARED_CACHE_15S, FootballController.getLiveFixtures);

// ============================================
// GET /api/football/fixtures/optimized
// Get fixtures with intelligent caching (DB + API)
// Uses DB for finished matches, API for live/scheduled
// Query params: from, to (YYYY-MM-DD format)
// ============================================
router.get('/fixtures/optimized', SHARED_CACHE_8S, FootballController.getOptimizedFixtures);

// ============================================
// CACHED DATA ROUTES (Permanent Storage)
// These endpoints use PostgreSQL for permanent storage
// ============================================

// GET /api/football/cached/matches/:date — TTL by date (today 8s for live scores)
router.get('/cached/matches/:date', (req, res, next) => {
  const dateParam = req.params.date as string;
  const today = new Date().toISOString().split('T')[0];
  if (dateParam < today) {
    return SHARED_CACHE_24H(req, res, next);
  }
  if (dateParam === today) {
    return SHARED_CACHE_60S(req, res, next);
  }
  return SHARED_CACHE_5MIN(req, res, next);
}, FootballController.getCachedMatchesByDate);

// GET /api/football/cached/league/:leagueId/matches/:date — per-league fixtures (incl. lower tiers)
router.get('/cached/league/:leagueId/matches/:date', (req, res, next) => {
  const dateParam = req.params.date as string;
  const today = new Date().toISOString().split('T')[0];
  if (dateParam < today) {
    return SHARED_CACHE_24H(req, res, next);
  }
  if (dateParam === today) {
    return SHARED_CACHE_60S(req, res, next);
  }
  return SHARED_CACHE_5MIN(req, res, next);
}, FootballController.getCachedLeagueMatchesByDate);

// GET /api/football/cached/world-cup/:date — World Cup fixtures (league + season from env)
router.get('/cached/world-cup/:date', (req, res, next) => {
  const dateParam = req.params.date as string;
  const today = new Date().toISOString().split('T')[0];
  if (dateParam < today) {
    return SHARED_CACHE_24H(req, res, next);
  }
  if (dateParam === today) {
    return SHARED_CACHE_8S(req, res, next);
  }
  return SHARED_CACHE_5MIN(req, res, next);
}, FootballController.getCachedWorldCupMatches);

// GET /api/football/transfers — player or team transfer history
router.get('/transfers', SHARED_CACHE_1H, FootballController.getTransfers);

// GET /api/football/cached/player/:id - Get player (permanent cache)
router.get('/cached/player/:id', SHARED_CACHE_5MIN, FootballController.getCachedPlayer);

// GET /api/football/cached/teams/all - Get all cached teams
router.get('/cached/teams/all', SHARED_CACHE_24H, FootballController.getAllCachedTeams);

// ✅ OPTIMIZATION 2: GET /api/football/cached/teams/batch - Get multiple teams in one request
// Query param: ?ids=1020,1021,1022 (comma-separated team IDs)
// Must be before /cached/team/:id to avoid route conflicts
router.get('/cached/teams/batch', SHARED_CACHE_1H, FootballController.getCachedTeamsBatch);

// GET /api/football/cached/team/:id - Get team (permanent cache)
router.get('/cached/team/:id', SHARED_CACHE_1H, FootballController.getCachedTeam);

// GET /api/football/cached/standings/:leagueId - Get standings (1 hour cache)
router.get('/cached/standings/:leagueId', SHARED_CACHE_1H, FootballController.getCachedStandings);

// GET /api/football/cached/h2h - Get H2H (permanent cache)
router.get('/cached/h2h', SHARED_CACHE_24H, FootballController.getCachedH2H);

// GET /api/football/cached/fixture/:id/lineups - Get lineups (permanent for finished, short for empty/live)
// 5min route cache lets the inner cache logic (which tracks empty vs full
// results) actually surface fresh data — a 24h shared HTTP cache would lock
// an empty array for a day.
router.get('/cached/fixture/:id/lineups', SHARED_CACHE_15S, FootballController.getCachedLineups);

// GET /api/football/cached/fixture/:id/statistics - Get statistics (permanent for finished, short for empty/live)
router.get('/cached/fixture/:id/statistics', SHARED_CACHE_15S, FootballController.getCachedStatistics);

// GET /api/football/cached/fixture/:id/events - Get events (permanent for finished, short for empty/live)
router.get('/cached/fixture/:id/events', SHARED_CACHE_15S, FootballController.getCachedEvents);

// GET /api/football/cached/fixture/:id/details - Full match details bundle (3s TTL for live)
router.get('/cached/fixture/:id/details', SHARED_CACHE_15S, FootballController.getCachedFixtureDetails);

// GET /api/football/cached/search - Unified search with caching
router.get('/cached/search', SHARED_CACHE_5MIN, FootballController.getCachedSearch);

// GET /api/football/cached/popular-searches - Get popular search suggestions
router.get('/cached/popular-searches', SHARED_CACHE_1H, FootballController.getPopularSearches);

// GET /api/football/cached/team/:id/matches - Get team matches (live, upcoming, finished)
router.get('/cached/team/:id/matches', SHARED_CACHE_5MIN, FootballController.getCachedTeamMatches);

// GET /api/football/cached/stats - Get full cache statistics
router.get('/cached/stats', FootballController.getFullCacheStats);

// ============================================
// GET /api/football/cache/stats
// Get cache statistics and rate limit status
// ============================================
router.get('/cache/stats', FootballController.getCacheStats);

// ============================================
// GET /api/football/fixtures/:id
// Get a single fixture by ID
// ============================================
router.get('/fixtures/:id', SHARED_CACHE_15S, FootballController.getFixtureById);

// ============================================
// GET /api/football/fixtures/:id/lineups
// Get lineups for a fixture
// ============================================
router.get('/fixtures/:id/lineups', SHARED_CACHE_8S, FootballController.getFixtureLineups);

// ============================================
// GET /api/football/fixtures/:id/players
// Player-level match data (lineup fallback)
// ============================================
router.get('/fixtures/:id/players', SHARED_CACHE_1H, FootballController.getFixturePlayers);

// ============================================
// GET /api/football/fixtures/:id/statistics
// Get statistics for a fixture
// ============================================
router.get('/fixtures/:id/statistics', SHARED_CACHE_8S, FootballController.getFixtureStatistics);

// ============================================
// GET /api/football/fixtures/:id/events
// Get events for a fixture (goals, cards, substitutions)
// ============================================
router.get('/fixtures/:id/events', SHARED_CACHE_15S, FootballController.getFixtureEvents);

// ============================================
// GET /api/football/standings
// Get standings for a league
// Query params: league (required), season (optional)
// ============================================
router.get('/standings', SHARED_CACHE_1H, FootballController.getStandings);

// ============================================
// GET /api/football/h2h
// Get head to head matches between two teams
// Query params: team1 (required), team2 (required), count (optional, default 5)
// ============================================
router.get('/h2h', SHARED_CACHE_24H, FootballController.getHeadToHead);

// ============================================
// GET /api/football/h2h/cached
// Get head to head with intelligent caching
// Query params: team1 (required), team2 (required), count (optional)
// ============================================
router.get('/h2h/cached', SHARED_CACHE_24H, FootballController.getH2HWithCache);

// ============================================
// PLAYER ROUTES
// ============================================

// GET /api/football/players/top/scorers
// Must be before /players/:id to avoid route conflicts
router.get('/players/top/scorers', SHARED_CACHE_1H, FootballController.getTopScorers);

// GET /api/football/players/top/scorers/predictions
// Get predictions for top scorers based on current performance
router.get('/players/top/scorers/predictions', SHARED_CACHE_1H, FootballController.getTopScorersPredictions);

// GET /api/football/players/top/assists
// Top assists/playmakers
router.get('/players/top/assists', SHARED_CACHE_1H, FootballController.getTopAssists);

// GET /api/football/players/top/yellow-cards
// Top yellow cards
router.get('/players/top/yellow-cards', SHARED_CACHE_1H, FootballController.getTopYellowCards);

// GET /api/football/players/top/red-cards
// Top red cards
router.get('/players/top/red-cards', SHARED_CACHE_1H, FootballController.getTopRedCards);

// GET /api/football/players/:id
router.get('/players/:id', SHARED_CACHE_1H, FootballController.getPlayerById);

// ============================================
// TEAM ROUTES
// ============================================

// GET /api/football/teams/:id/squad
// Must be before /teams/:id to avoid route conflicts
router.get('/teams/:id/squad', SHARED_CACHE_1H, FootballController.getTeamSquad);

// GET /api/football/teams/:id/statistics
// Team statistics
router.get('/teams/:id/statistics', SHARED_CACHE_1H, FootballController.getTeamStatistics);

// GET /api/football/teams/:id/injuries
// Team injuries
router.get('/teams/:id/injuries', SHARED_CACHE_5MIN, FootballController.getTeamInjuries);

// GET /api/football/teams/:id/trophies
// Team trophies and awards
router.get('/teams/:id/trophies', SHARED_CACHE_24H, FootballController.getTeamTrophies);

// GET /api/football/teams/:id/coaches
// Team coaches
router.get('/teams/:id/coaches', SHARED_CACHE_24H, FootballController.getTeamCoaches);

// GET /api/football/teams/:id
router.get('/teams/:id', SHARED_CACHE_1H, FootballController.getTeamById);

// ============================================
// VENUES ROUTES
// ============================================

// GET /api/football/venues/:id
// Venue/stadium information
router.get('/venues/:id', SHARED_CACHE_24H, FootballController.getVenueInfo);

// ============================================
// ROUNDS ROUTES
// ============================================

// GET /api/football/fixtures/rounds
// League rounds
router.get('/fixtures/rounds', SHARED_CACHE_1H, FootballController.getLeagueRounds);

// ============================================
// GET /api/football/standings/:leagueId
// Get standings for a league (path parameter version)
// ============================================
router.get('/standings/:leagueId', SHARED_CACHE_1H, async (req, res) => {
    // Forward to main standings endpoint with query params
    req.query.league = req.params.leagueId;
    return FootballController.getStandings(req, res);
});

export default router;

// Force Railway redeploy: ensures the new /teams/top-by-country and
// /teams/top-supported-countries routes registered above are bundled into
// dist/. The previous deploy ran an older build that lacked these routes,
// so requests fell through to /teams/:id and returned "Invalid team ID".
