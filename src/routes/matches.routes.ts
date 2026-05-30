import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';
import { enqueueNotification } from '../queues/notification.queue';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

// ============================================
// POST /api/matches/favorite/:matchId
// Add match to favorites
// ============================================
router.post('/favorite/:matchId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        // Ensure matchId is a string (handle array case)
        const matchIdParam = Array.isArray(req.params.matchId) ? req.params.matchId[0] : req.params.matchId;
        const apiMatchId = parseInt(matchIdParam);
        const { homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, matchDate, leagueName } = req.body;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        if (isNaN(apiMatchId)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid match ID');
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Check if already favorited
        const existing = await prisma.favoriteMatch.findUnique({
            where: {
                userId_apiMatchId: {
                    userId: user.id,
                    apiMatchId,
                },
            },
        });

        if (existing) {
            sendError(req, res, ErrorCode.VALIDATION, 'Match already in favorites');
            return;
        }

        // Create favorite
        const favorite = await prisma.favoriteMatch.create({
            data: {
                userId: user.id,
                apiMatchId,
                homeTeam: homeTeam || 'Unknown',
                awayTeam: awayTeam || 'Unknown',
                homeTeamLogo,
                awayTeamLogo,
                matchDate: matchDate ? new Date(matchDate) : new Date(),
                leagueName,
            },
        });

        // 🔔 Fire instant push notification (non-blocking) when user favorites a match
        const home = homeTeam || 'الفريق الأول';
        const away = awayTeam || 'الفريق الثاني';
        enqueueNotification({
            userId: user.id,
            title: '🔔 تم تفضيل المباراة',
            message: `${home} ضد ${away} — سيتم إخبارك بكل الأهداف والأحداث المهمة!`,
            type: 'MATCH_FAVORITE',
            data: {
                type: 'MATCH_FAVORITE',
                matchId: String(apiMatchId),
                fixtureId: String(apiMatchId),
                homeTeam: home,
                awayTeam: away,
                leagueName,
                screen: '/(tabs)/match-details',
            },
        }).catch(err => logger.warn('[matches/favorite] Notification enqueue failed (non-fatal):', err));

        res.json({
            status: 'SUCCESS',
            message: 'Match added to favorites',
            data: { favorite },
        });
    } catch (error: any) {
        logger.error('Add favorite match error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to add favorite');
    }
});

// ============================================
// DELETE /api/matches/favorite/:matchId
// Remove match from favorites
// ============================================
router.delete('/favorite/:matchId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        // Ensure matchId is a string (handle array case)
        const matchIdParam = Array.isArray(req.params.matchId) ? req.params.matchId[0] : req.params.matchId;
        const apiMatchId = parseInt(matchIdParam);

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        if (isNaN(apiMatchId)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid match ID');
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Delete favorite
        await prisma.favoriteMatch.deleteMany({
            where: {
                userId: user.id,
                apiMatchId,
            },
        });

        res.json({
            status: 'SUCCESS',
            message: 'Match removed from favorites',
        });
    } catch (error: any) {
        logger.error('Remove favorite match error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to remove favorite');
    }
});

// ============================================
// GET /api/matches/favorites
// Get all favorite matches for user
// ============================================
router.get('/favorites', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Get favorites
        const favorites = await prisma.favoriteMatch.findMany({
            where: { userId: user.id },
            orderBy: { matchDate: 'asc' },
        });

        res.json({
            status: 'SUCCESS',
            data: { 
                favorites: favorites.map(f => ({
                    id: f.id,
                    apiMatchId: f.apiMatchId,
                    homeTeam: f.homeTeam,
                    awayTeam: f.awayTeam,
                    homeTeamLogo: f.homeTeamLogo,
                    awayTeamLogo: f.awayTeamLogo,
                    matchDate: f.matchDate,
                    leagueName: f.leagueName,
                })),
            },
        });
    } catch (error: any) {
        logger.error('Get favorite matches error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to get favorites');
    }
});

// ============================================
// GET /api/matches/favorite/:matchId/check
// Check if match is favorited
// ============================================
router.get('/favorite/:matchId/check', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        // Ensure matchId is a string (handle array case)
        const matchIdParam = Array.isArray(req.params.matchId) ? req.params.matchId[0] : req.params.matchId;
        const apiMatchId = parseInt(matchIdParam);

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.json({ status: 'SUCCESS', data: { isFavorite: false } });
            return;
        }

        const favorite = await prisma.favoriteMatch.findUnique({
            where: {
                userId_apiMatchId: {
                    userId: user.id,
                    apiMatchId,
                },
            },
        });

        res.json({
            status: 'SUCCESS',
            data: { isFavorite: !!favorite },
        });
    } catch (error: any) {
        logger.error('Check favorite error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to check favorite');
    }
});

// ============================================
// POST /api/matches/push-token
// Register Expo Push Token
// ============================================
router.post('/push-token', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        const { token } = req.body;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        if (!token) {
            sendError(req, res, ErrorCode.VALIDATION, 'Push token is required');
            return;
        }

        // Validate Expo push token format before saving
        const { Expo } = await import('expo-server-sdk');
        if (!Expo.isExpoPushToken(token)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid Expo push token format');
            return;
        }

        // Update user's push token
        await prisma.user.update({
            where: { clerkUserId },
            data: { expoPushToken: token },
        });

        res.json({
            status: 'SUCCESS',
            message: 'Push token registered',
        });
    } catch (error: any) {
        logger.error('Register push token error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to register push token');
    }
});

// ============================================
// GET /api/matches/live
// Get live matches from Football API
// ============================================
router.get('/live', async (req: Request, res: Response): Promise<void> => {
    try {
        // Import FootballController instead of FootballService
        const { FootballController } = await import('../controllers/football.controller');
        
        // Call the controller method directly
        await FootballController.getLiveFixtures(req, res);
    } catch (error: any) {
        logger.error('Get live matches error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ============================================
// GET /api/matches/today
// Get today's matches
// ============================================
router.get('/today', async (req: Request, res: Response): Promise<void> => {
    try {
        // Use football fixtures endpoint with today's date
        const { FootballController } = await import('../controllers/football.controller');
        
        // Set query params for today
        req.query.date = new Date().toISOString().split('T')[0];
        
        await FootballController.getFixtures(req, res);
    } catch (error: any) {
        logger.error('Get today matches error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ============================================
// GET /api/matches/upcoming
// Get upcoming matches (next 7 days)
// ============================================
router.get('/upcoming', async (req: Request, res: Response): Promise<void> => {
    try {
        const { FootballController } = await import('../controllers/football.controller');
        
        // Set query params for next 7 days
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        req.query.from = today.toISOString().split('T')[0];
        req.query.to = nextWeek.toISOString().split('T')[0];
        
        await FootballController.getFixtures(req, res);
    } catch (error: any) {
        logger.error('Get upcoming matches error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ============================================
// POST /api/matches/archive
// Accept finished match archive from client (best-effort, no-op on backend)
// The frontend stores archives in AsyncStorage; this endpoint exists to
// prevent 404 errors. Future: store in a dedicated cache table.
// ============================================
router.post('/archive', async (req: Request, res: Response): Promise<void> => {
    try {
        const body = req.body?.match ?? req.body;
        const fixtureId = parseInt(String(body?.fixture?.id ?? body?.fixtureId ?? ''), 10);
        if (Number.isNaN(fixtureId) || fixtureId <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid fixture id');
            return;
        }

        const { matchCacheService } = await import('../services/match-cache.service');
        if (body?.fixture || body?.teams) {
            await matchCacheService.upsertFixtures([body]);
        }

        const status = body?.fixture?.status?.short ?? body?.status;
        if (['FT', 'AET', 'PEN'].includes(status)) {
            await matchCacheService.handleMatchFinished(fixtureId);
        }

        res.json({ status: 'SUCCESS', message: 'Match archived in cached_fixtures', fixtureId });
    } catch (error) {
        logger.error('Archive endpoint error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Archive failed');
    }
});

router.get('/archive/:matchId', async (req: Request, res: Response): Promise<void> => {
    try {
        const matchIdParam = Array.isArray(req.params.matchId) ? req.params.matchId[0] : req.params.matchId;
        const fixtureId = parseInt(matchIdParam, 10);
        if (Number.isNaN(fixtureId)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid match ID');
            return;
        }

        const row = await prisma.cachedFixture.findUnique({ where: { fixtureId } });
        if (!row) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'Archive not found in backend cache');
            return;
        }

        const { matchCacheService } = await import('../services/match-cache.service');
        res.json({
            status: 'SUCCESS',
            data: matchCacheService.convertDbMatchToApiFormat(row),
        });
    } catch (error) {
        logger.error('Get archive error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Failed to load archive');
    }
});

export default router;
