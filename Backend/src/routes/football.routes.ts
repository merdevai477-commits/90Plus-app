import { Router } from 'express';
import { FootballController } from '../controllers/football.controller';

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
router.get('/leagues', FootballController.getLeagues);

// GET /api/football/leagues/all
// Get all available leagues with caching
router.get('/leagues/all', FootballController.getAllLeagues);

// GET /api/football/teams/all-logos
// Fetch ALL team logos from API-Football and save to database
// Query params: page (optional), limit (optional, default 100)
router.get('/teams/all-logos', FootballController.getAllTeamLogos);

// ============================================
// GET /api/football/fixtures
// Get fixtures with filters
// Query params: live, date, league, season, team, last, next, from, to, status, id, ids
// ============================================
router.get('/fixtures', FootballController.getFixtures);

// GET /api/football/search
// Unified search across players, teams, leagues
router.get('/search', FootballController.search);

// ============================================
// GET /api/football/fixtures/live
// Get live fixtures
// ============================================
router.get('/fixtures/live', FootballController.getLiveFixtures);

// ============================================
// GET /api/football/fixtures/optimized
// Get fixtures with intelligent caching (DB + API)
// Uses DB for finished matches, API for live/scheduled
// Query params: from, to (YYYY-MM-DD format)
// ============================================
router.get('/fixtures/optimized', FootballController.getOptimizedFixtures);

// ============================================
// CACHED DATA ROUTES (Permanent Storage)
// These endpoints use PostgreSQL for permanent storage
// ============================================

// GET /api/football/cached/matches/:date - Get matches by date (permanent cache)
router.get('/cached/matches/:date', FootballController.getCachedMatchesByDate);

// GET /api/football/cached/player/:id - Get player (permanent cache)
router.get('/cached/player/:id', FootballController.getCachedPlayer);

// ✅ OPTIMIZATION 2: GET /api/football/cached/teams/batch - Get multiple teams in one request
// Query param: ?ids=1020,1021,1022 (comma-separated team IDs)
// Must be before /cached/team/:id to avoid route conflicts
router.get('/cached/teams/batch', FootballController.getCachedTeamsBatch);

// GET /api/football/cached/team/:id - Get team (permanent cache)
router.get('/cached/team/:id', FootballController.getCachedTeam);

// GET /api/football/cached/standings/:leagueId - Get standings (1 hour cache)
router.get('/cached/standings/:leagueId', FootballController.getCachedStandings);

// GET /api/football/cached/h2h - Get H2H (permanent cache)
router.get('/cached/h2h', FootballController.getCachedH2H);

// GET /api/football/cached/fixture/:id/lineups - Get lineups (permanent for finished)
router.get('/cached/fixture/:id/lineups', FootballController.getCachedLineups);

// GET /api/football/cached/fixture/:id/statistics - Get statistics (permanent for finished)
router.get('/cached/fixture/:id/statistics', FootballController.getCachedStatistics);

// GET /api/football/cached/fixture/:id/events - Get events (permanent for finished)
router.get('/cached/fixture/:id/events', FootballController.getCachedEvents);

// GET /api/football/cached/search - Unified search with caching
router.get('/cached/search', FootballController.getCachedSearch);

// GET /api/football/cached/popular-searches - Get popular search suggestions
router.get('/cached/popular-searches', FootballController.getPopularSearches);

// GET /api/football/cached/team/:id/matches - Get team matches (live, upcoming, finished)
router.get('/cached/team/:id/matches', FootballController.getCachedTeamMatches);

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
router.get('/fixtures/:id', FootballController.getFixtureById);

// ============================================
// GET /api/football/fixtures/:id/lineups
// Get lineups for a fixture
// ============================================
router.get('/fixtures/:id/lineups', FootballController.getFixtureLineups);

// ============================================
// GET /api/football/fixtures/:id/statistics
// Get statistics for a fixture
// ============================================
router.get('/fixtures/:id/statistics', FootballController.getFixtureStatistics);

// ============================================
// GET /api/football/fixtures/:id/events
// Get events for a fixture (goals, cards, substitutions)
// ============================================
router.get('/fixtures/:id/events', FootballController.getFixtureEvents);

// ============================================
// GET /api/football/standings
// Get standings for a league
// Query params: league (required), season (optional)
// ============================================
router.get('/standings', FootballController.getStandings);

// ============================================
// GET /api/football/h2h
// Get head to head matches between two teams
// Query params: team1 (required), team2 (required), count (optional, default 5)
// ============================================
router.get('/h2h', FootballController.getHeadToHead);

// ============================================
// GET /api/football/h2h/cached
// Get head to head with intelligent caching
// Query params: team1 (required), team2 (required), count (optional)
// ============================================
router.get('/h2h/cached', FootballController.getH2HWithCache);

// ============================================
// PLAYER ROUTES
// ============================================

// GET /api/football/players/top/scorers
// Must be before /players/:id to avoid route conflicts
router.get('/players/top/scorers', FootballController.getTopScorers);

// GET /api/football/players/top/assists
// Top assists/playmakers
router.get('/players/top/assists', FootballController.getTopAssists);

// GET /api/football/players/:id
router.get('/players/:id', FootballController.getPlayerById);

// ============================================
// TEAM ROUTES
// ============================================

// GET /api/football/teams/:id/squad
// Must be before /teams/:id to avoid route conflicts
router.get('/teams/:id/squad', FootballController.getTeamSquad);

// GET /api/football/teams/:id/statistics
// Team statistics
router.get('/teams/:id/statistics', FootballController.getTeamStatistics);

// GET /api/football/teams/:id/injuries
// Team injuries
router.get('/teams/:id/injuries', FootballController.getTeamInjuries);

// GET /api/football/teams/:id/trophies
// Team trophies and awards
router.get('/teams/:id/trophies', FootballController.getTeamTrophies);

// GET /api/football/teams/:id/coaches
// Team coaches
router.get('/teams/:id/coaches', FootballController.getTeamCoaches);

// GET /api/football/teams/:id
router.get('/teams/:id', FootballController.getTeamById);

// ============================================
// TRANSFERS ROUTES
// ============================================

// GET /api/football/transfers
// Player transfers
router.get('/transfers', FootballController.getTransfers);

// GET /api/football/transfers/by-leagues
// Get transfers by leagues with date range
// Query params: leagues (comma-separated IDs), from (YYYY-MM-DD), to (YYYY-MM-DD)
router.get('/transfers/by-leagues', FootballController.getTransfersByLeagues);

// POST /api/football/transfers/sync
// Sync transfers from API to database (run this to populate the database)
// Query params: force (boolean) - force sync even if already syncing
router.post('/transfers/sync', FootballController.syncTransfersToDatabase);

// GET /api/football/transfers/sync/status
// Get the status of the transfers sync service
router.get('/transfers/sync/status', FootballController.getSyncStatus);

// GET /api/football/transfers/cached
// Get cached transfers from database (fast, zero-delay)
// Query params: leagues (comma-separated IDs), season (optional), from (YYYY-MM-DD), to (YYYY-MM-DD)
router.get('/transfers/cached', FootballController.getCachedTransfers);

// ============================================
// VENUES ROUTES
// ============================================

// GET /api/football/venues/:id
// Venue/stadium information
router.get('/venues/:id', FootballController.getVenueInfo);

// ============================================
// ROUNDS ROUTES
// ============================================

// GET /api/football/fixtures/rounds
// League rounds
router.get('/fixtures/rounds', FootballController.getLeagueRounds);

export default router;

