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
        const apiMatchId = parseInt(req.params.matchId);
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
        const apiMatchId = parseInt(req.params.matchId);

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
        const apiMatchId = parseInt(req.params.matchId);

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

export default router;
