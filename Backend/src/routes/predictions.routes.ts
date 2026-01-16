/**
 * Predictions Routes
 * نظام التوقعات - API Endpoints
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/clerk.middleware';

const router = Router();

// Constants
const DAILY_PREDICTION_LIMIT = 10; // الحد الأقصى للتوقعات اليومية
const PREDICTION_COST = 5; // coins - تكلفة كل توقع
const CORRECT_PREDICTION_REWARD = 10; // coins - مكافأة التوقع الصحيح

/**
 * GET /api/predictions/remaining
 * Get remaining daily predictions for user
 */
router.get('/remaining', async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.headers['x-clerk-user-id'] as string;

        if (!clerkUserId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Get today's predictions count
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayPredictions = await (prisma as any).prediction.count({
            where: {
                userId: user.id,
                createdAt: {
                    gte: today,
                    lt: tomorrow
                }
            }
        });

        const remaining = Math.max(0, DAILY_PREDICTION_LIMIT - todayPredictions);

        res.json({
            success: true,
            data: {
                remaining,
                total: DAILY_PREDICTION_LIMIT,
                used: todayPredictions,
                coins: user.coins,
                predictionCost: PREDICTION_COST
            }
        });
    } catch (error) {
        console.error('Error getting remaining predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions
 * Submit a new prediction
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.headers['x-clerk-user-id'] as string;

        if (!clerkUserId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { apiMatchId, predictionType, homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, matchDate, leagueName } = req.body;

        if (!apiMatchId || !predictionType) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        if (!['home', 'draw', 'away'].includes(predictionType)) {
            res.status(400).json({ error: 'Invalid prediction type' });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Check if user has enough coins
        if (user.coins < PREDICTION_COST) {
            res.status(400).json({
                error: 'Insufficient coins',
                required: PREDICTION_COST,
                current: user.coins
            });
            return;
        }

        // Check daily limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayPredictions = await (prisma as any).prediction.count({
            where: {
                userId: user.id,
                createdAt: {
                    gte: today,
                    lt: tomorrow
                }
            }
        });

        if (todayPredictions >= DAILY_PREDICTION_LIMIT) {
            res.status(400).json({
                error: 'Daily prediction limit reached',
                limit: DAILY_PREDICTION_LIMIT
            });
            return;
        }

        // Check if already predicted on this match
        const existingPrediction = await (prisma as any).prediction.findUnique({
            where: {
                userId_apiMatchId: {
                    userId: user.id,
                    apiMatchId: parseInt(apiMatchId)
                }
            }
        });

        if (existingPrediction) {
            res.status(400).json({ error: 'Already predicted on this match' });
            return;
        }

        // Create prediction and deduct coins in transaction
        const [prediction, updatedUser] = await prisma.$transaction([
            (prisma as any).prediction.create({
                data: {
                    userId: user.id,
                    apiMatchId: parseInt(apiMatchId),
                    predictionType,
                    coinsSpent: PREDICTION_COST,
                    homeTeam,
                    awayTeam,
                    homeTeamLogo,
                    awayTeamLogo,
                    matchDate: matchDate ? new Date(matchDate) : null,
                    leagueName
                }
            }),
            prisma.user.update({
                where: { id: user.id },
                data: { coins: { decrement: PREDICTION_COST } },
                select: { coins: true }
            }),
            prisma.coinTransaction.create({
                data: {
                    userId: user.id,
                    amount: -PREDICTION_COST,
                    type: 'PREDICTION' as any,
                    description: `توقع على مباراة ${homeTeam || 'Home'} vs ${awayTeam || 'Away'}`
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                prediction,
                newBalance: updatedUser.coins,
                remaining: DAILY_PREDICTION_LIMIT - todayPredictions - 1
            },
            message: 'تم تسجيل توقعك بنجاح! 🎯'
        });
    } catch (error) {
        console.error('Error creating prediction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/predictions/user
 * Get all predictions for current user
 */
router.get('/user', async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.headers['x-clerk-user-id'] as string;

        if (!clerkUserId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const predictions = await (prisma as any).prediction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Group by match for frontend consumption
        const predictionsMap: { [key: number]: any } = {};
        predictions.forEach((p: any) => {
            predictionsMap[p.apiMatchId] = {
                id: p.id,
                prediction: {
                    type: p.predictionType,
                    homeScore: 0,
                    awayScore: 0
                },
                coinsSpent: p.coinsSpent,
                coinsWon: p.coinsWon,
                isCorrect: p.isCorrect,
                createdAt: p.createdAt
            };
        });

        res.json({
            success: true,
            data: {
                predictions,
                predictionsMap
            }
        });
    } catch (error) {
        console.error('Error getting user predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/predictions/match/:matchId/count
 * Get prediction count for a specific match
 */
router.get('/match/:matchId/count', async (req: Request, res: Response): Promise<void> => {
    try {
        const { matchId } = req.params;

        const count = await (prisma as any).prediction.count({
            where: { apiMatchId: parseInt(matchId) }
        });

        // Get breakdown by type
        const breakdown = await (prisma as any).prediction.groupBy({
            by: ['predictionType'],
            where: { apiMatchId: parseInt(matchId) },
            _count: true
        });

        const stats = {
            total: count,
            home: 0,
            draw: 0,
            away: 0
        };

        breakdown.forEach((b: any) => {
            if (b.predictionType === 'home') stats.home = b._count;
            if (b.predictionType === 'draw') stats.draw = b._count;
            if (b.predictionType === 'away') stats.away = b._count;
        });

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting match prediction count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/matches/counts
 * Get prediction counts for multiple matches (batch)
 */
router.post('/matches/counts', async (req: Request, res: Response): Promise<void> => {
    try {
        const { matchIds } = req.body;

        if (!matchIds || !Array.isArray(matchIds)) {
            res.status(400).json({ error: 'matchIds array required' });
            return;
        }

        const counts = await (prisma as any).prediction.groupBy({
            by: ['apiMatchId'],
            where: {
                apiMatchId: { in: matchIds.map((id: any) => parseInt(id)) }
            },
            _count: true
        });

        const countsMap: { [key: number]: number } = {};
        counts.forEach((c: any) => {
            countsMap[c.apiMatchId] = c._count;
        });

        // Fill in zeros for matches with no predictions
        matchIds.forEach((id: any) => {
            if (!countsMap[id]) countsMap[id] = 0;
        });

        res.json({
            success: true,
            data: countsMap
        });
    } catch (error) {
        console.error('Error getting batch prediction counts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/predictions/stats
 * Get prediction statistics for user (correct, incorrect, total)
 */
router.get('/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Get total predictions
        const total = await (prisma as any).prediction.count({
            where: { userId: user.id }
        });

        // Get correct predictions
        const correct = await (prisma as any).prediction.count({
            where: { userId: user.id, isCorrect: true }
        });

        // Get incorrect predictions
        const incorrect = await (prisma as any).prediction.count({
            where: { userId: user.id, isCorrect: false }
        });

        // Get pending (not resolved yet)
        const pending = await (prisma as any).prediction.count({
            where: { userId: user.id, isCorrect: null }
        });

        // Get total coins won from predictions
        const coinsWonResult = await (prisma as any).prediction.aggregate({
            where: { userId: user.id, isCorrect: true },
            _sum: { coinsWon: true }
        });
        const totalCoinsWon = coinsWonResult._sum.coinsWon || 0;

        // Calculate accuracy
        const resolved = correct + incorrect;
        const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0;

        res.json({
            success: true,
            data: {
                total,
                correct,
                incorrect,
                pending,
                accuracy,
                resolved,
                totalCoinsWon // ✅ Added total coins won
            }
        });
    } catch (error) {
        console.error('Error getting prediction stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/resolve/:matchId
 * Manually resolve predictions for a match (admin/debug)
 */
router.post('/resolve/:matchId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { matchId } = req.params;
        
        // Import the service dynamically to avoid circular dependency
        const { PredictionWatcherService } = await import('../services/prediction-watcher.service');
        
        const result = await PredictionWatcherService.manualResolve(parseInt(matchId));
        
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ success: false, error: result.message });
        }
    } catch (error) {
        console.error('Error resolving predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/resolve-all
 * Trigger resolution check for all unresolved predictions (admin/debug)
 */
router.post('/resolve-all', async (req: Request, res: Response): Promise<void> => {
    try {
        // Import the service dynamically to avoid circular dependency
        const { PredictionWatcherService } = await import('../services/prediction-watcher.service');
        
        // Get count of unresolved predictions before
        const unresolvedBefore = await (prisma as any).prediction.count({
            where: { isCorrect: null }
        });
        
        // Trigger the check
        await PredictionWatcherService.checkPredictions();
        
        // Get count after
        const unresolvedAfter = await (prisma as any).prediction.count({
            where: { isCorrect: null }
        });
        
        const resolved = unresolvedBefore - unresolvedAfter;
        
        res.json({ 
            success: true, 
            message: `Checked ${unresolvedBefore} unresolved predictions, resolved ${resolved}`,
            data: {
                unresolvedBefore,
                unresolvedAfter,
                resolved
            }
        });
    } catch (error) {
        console.error('Error resolving all predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/predictions/unresolved
 * Get list of unresolved predictions (admin/debug)
 */
router.get('/unresolved', async (req: Request, res: Response): Promise<void> => {
    try {
        const unresolvedPredictions = await (prisma as any).prediction.findMany({
            where: { isCorrect: null },
            select: {
                id: true,
                apiMatchId: true,
                predictionType: true,
                homeTeam: true,
                awayTeam: true,
                matchDate: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        // Group by match
        const matchIds = [...new Set(unresolvedPredictions.map((p: any) => p.apiMatchId))];

        res.json({
            success: true,
            data: {
                totalUnresolved: unresolvedPredictions.length,
                uniqueMatches: matchIds.length,
                matchIds,
                predictions: unresolvedPredictions
            }
        });
    } catch (error) {
        console.error('Error getting unresolved predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/submit
 * Submit a score prediction (for rank page)
 * Used for predicting exact match scores
 */
router.post('/submit', async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.headers['x-clerk-user-id'] as string;

        if (!clerkUserId) {
            res.status(401).json({ 
                success: false,
                error: 'Unauthorized',
                message: 'يجب تسجيل الدخول لإرسال التوقعات' 
            });
            return;
        }

        const { matchId, homeScore, awayScore } = req.body;

        // Validation
        if (!matchId || homeScore === undefined || awayScore === undefined) {
            res.status(400).json({ 
                success: false,
                error: 'Missing required fields',
                message: 'يرجى إدخال جميع البيانات المطلوبة' 
            });
            return;
        }

        // Validate scores are numbers
        const home = parseInt(homeScore);
        const away = parseInt(awayScore);

        if (isNaN(home) || isNaN(away)) {
            res.status(400).json({ 
                success: false,
                error: 'Invalid scores',
                message: 'يرجى إدخال أرقام صحيحة' 
            });
            return;
        }

        // Validate score range (0-20)
        if (home < 0 || away < 0 || home > 20 || away > 20) {
            res.status(400).json({ 
                success: false,
                error: 'Invalid score range',
                message: 'النتيجة يجب أن تكون بين 0 و 20' 
            });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            res.status(404).json({ 
                success: false,
                error: 'User not found',
                message: 'المستخدم غير موجود' 
            });
            return;
        }

        // Check if user has enough coins
        if (user.coins < PREDICTION_COST) {
            res.status(400).json({
                success: false,
                error: 'Insufficient coins',
                message: `تحتاج إلى ${PREDICTION_COST} عملة لإرسال توقع`,
                required: PREDICTION_COST,
                current: user.coins
            });
            return;
        }

        // Check daily limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayPredictions = await (prisma as any).prediction.count({
            where: {
                userId: user.id,
                createdAt: {
                    gte: today,
                    lt: tomorrow
                }
            }
        });

        if (todayPredictions >= DAILY_PREDICTION_LIMIT) {
            res.status(400).json({
                success: false,
                error: 'Daily prediction limit reached',
                message: `لقد وصلت إلى الحد اليومي (${DAILY_PREDICTION_LIMIT} توقعات)`,
                limit: DAILY_PREDICTION_LIMIT
            });
            return;
        }

        // Check if already predicted on this match
        const existingPrediction = await (prisma as any).prediction.findUnique({
            where: {
                userId_apiMatchId: {
                    userId: user.id,
                    apiMatchId: typeof matchId === 'string' ? parseInt(matchId) : matchId
                }
            }
        });

        if (existingPrediction) {
            res.status(400).json({ 
                success: false,
                error: 'Already predicted',
                message: 'لقد أرسلت توقعاً لهذه المباراة بالفعل' 
            });
            return;
        }

        // Determine prediction type based on scores
        let predictionType: string;
        if (home > away) {
            predictionType = 'home';
        } else if (away > home) {
            predictionType = 'away';
        } else {
            predictionType = 'draw';
        }

        // Create prediction and deduct coins in transaction
        const [prediction, updatedUser] = await prisma.$transaction([
            (prisma as any).prediction.create({
                data: {
                    userId: user.id,
                    apiMatchId: typeof matchId === 'string' ? parseInt(matchId) : matchId,
                    predictionType,
                    coinsSpent: PREDICTION_COST,
                    // Store the exact score prediction in a JSON field or separate columns
                    // For now, using homeTeam/awayTeam fields to store scores
                    homeTeam: `Score: ${home}`,
                    awayTeam: `Score: ${away}`,
                }
            }),
            prisma.user.update({
                where: { id: user.id },
                data: { coins: { decrement: PREDICTION_COST } },
                select: { coins: true }
            }),
            prisma.coinTransaction.create({
                data: {
                    userId: user.id,
                    amount: -PREDICTION_COST,
                    type: 'PREDICTION' as any,
                    description: `توقع نتيجة المباراة: ${home}-${away}`
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                prediction: {
                    id: prediction.id,
                    matchId: prediction.apiMatchId,
                    homeScore: home,
                    awayScore: away,
                    predictionType,
                    coinsSpent: PREDICTION_COST,
                    createdAt: prediction.createdAt
                },
                newBalance: updatedUser.coins,
                remaining: DAILY_PREDICTION_LIMIT - todayPredictions - 1
            },
            message: '🎯 تم إرسال توقعك بنجاح!'
        });
    } catch (error) {
        console.error('Error submitting score prediction:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.' 
        });
    }
});

export default router;
