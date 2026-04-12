import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';

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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        if (isNaN(apiMatchId)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid match ID' });
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
            res.status(400).json({ status: 'ERROR', message: 'Match already in favorites' });
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

        res.json({
            status: 'SUCCESS',
            message: 'Match added to favorites',
            data: { favorite },
        });
    } catch (error: any) {
        logger.error('Add favorite match error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Failed to add favorite' });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        if (isNaN(apiMatchId)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid match ID' });
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
        res.status(500).json({ status: 'ERROR', message: 'Failed to remove favorite' });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
        res.status(500).json({ status: 'ERROR', message: 'Failed to get favorites' });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
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
        res.status(500).json({ status: 'ERROR', message: 'Failed to check favorite' });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        if (!token) {
            res.status(400).json({ status: 'ERROR', message: 'Push token is required' });
            return;
        }

        // Validate Expo push token format before saving
        const { Expo } = await import('expo-server-sdk');
        if (!Expo.isExpoPushToken(token)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid Expo push token format' });
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
        res.status(500).json({ status: 'ERROR', message: 'Failed to register push token' });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

export default router;
