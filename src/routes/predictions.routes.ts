/**
 * Predictions Routes
 * نظام التوقعات - API Endpoints
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import type { Prediction, User } from '@prisma/client';
import { requireAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Constants
const DAILY_PREDICTION_LIMIT = 10; // الحد الأقصى للتوقعات اليومية (= عدد التذاكر اليومية)
const PREDICTION_COST = 0; // Deprecated — predictions now cost only 1 daily ticket, not coins.
const CORRECT_PREDICTION_REWARD = 10; // coins - مكافأة التوقع الصحيح

/**
 * GET /api/predictions/remaining
 * Get remaining daily predictions for user
 */
router.get('/remaining', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        // ✅ استخدام req.auth.userId من الـ middleware
        const clerkUserId = req.auth?.userId;

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

        const todayPredictions = await prisma.prediction.count({
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
        logger.error('Error getting remaining predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions
 * Submit a new prediction
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        // ✅ استخدام req.auth.userId من الـ middleware
        const clerkUserId = req.auth?.userId;

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

        // Find user (minimal select — full validation happens inside transaction)
        const userExists = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!userExists) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Fix SEC-5: Move coins check, daily limit check, and duplicate check INSIDE the transaction
        // so all 3 operations are atomic — eliminates the race condition where two concurrent
        // requests could both pass the pre-transaction checks and double-deduct coins.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let prediction: Prediction;
        let updatedUser: Pick<User, 'coins'>;
        let todayPredictionsCount = 0;

        try {
            [prediction, updatedUser] = await prisma.$transaction(async (tx) => {
                // Re-read user inside transaction (prevents TOCTOU race)
                const user = await tx.user.findUnique({
                    where: { id: userExists.id },
                    select: { id: true, coins: true }
                });

                if (!user) throw new Error('USER_NOT_FOUND');

                // Predictions no longer cost coins — only a daily ticket.
                // The old INSUFFICIENT_COINS check has been removed.

                // Atomic daily limit check (= ticket check)
                const todayCount = await tx.prediction.count({
                    where: {
                        userId: user.id,
                        createdAt: { gte: today, lt: tomorrow }
                    }
                });
                todayPredictionsCount = todayCount;

                if (todayCount >= DAILY_PREDICTION_LIMIT) {
                    throw new Error('DAILY_LIMIT_REACHED');
                }

                // Atomic duplicate check
                const existing = await tx.prediction.findUnique({
                    where: {
                        userId_apiMatchId: {
                            userId: user.id,
                            apiMatchId: parseInt(apiMatchId)
                        }
                    }
                });

                if (existing) throw new Error('ALREADY_PREDICTED');

                // All checks passed — create prediction atomically (no coin charge).
                const newPrediction = await tx.prediction.create({
                    data: {
                        userId: user.id,
                        apiMatchId: parseInt(apiMatchId),
                        predictionType,
                        coinsSpent: PREDICTION_COST, // = 0
                        isCorrect: null,
                        homeTeam,
                        awayTeam,
                        homeTeamLogo,
                        awayTeamLogo,
                        matchDate: matchDate ? new Date(matchDate) : null,
                        leagueName
                    }
                });

                // No coin deduction — predictions now cost only 1 daily ticket.
                const newUser = { coins: user.coins };

                return [newPrediction, newUser];
            });
        } catch (txError: any) {
            const msg = txError?.message || '';
            if (msg === 'USER_NOT_FOUND') {
                res.status(404).json({ error: 'User not found' });
            } else if (msg === 'DAILY_LIMIT_REACHED') {
                res.status(400).json({ error: 'Daily prediction limit reached', limit: DAILY_PREDICTION_LIMIT });
            } else if (msg === 'ALREADY_PREDICTED') {
                res.status(400).json({ error: 'Already predicted on this match' });
            } else {
                throw txError; // re-throw unexpected errors to outer catch
            }
            return;
        }

        res.json({
            success: true,
            data: {
                prediction,
                newBalance: updatedUser.coins,
                remaining: DAILY_PREDICTION_LIMIT - todayPredictionsCount - 1
            },
            message: 'تم تسجيل توقعك بنجاح! 🎯'
        });
    } catch (error) {
        logger.error('Error creating prediction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/predictions/user
 * Get all predictions for current user
 */
router.get('/user', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        // ✅ استخدام req.auth.userId من الـ middleware
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

        const predictions = await prisma.prediction.findMany({
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
        logger.error('Error getting user predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/predictions/match/:matchId/count
 * Get prediction count for a specific match
 */
router.get('/match/:matchId/count', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure matchId is a string (handle array case)
        const matchIdParam = Array.isArray(req.params.matchId) ? req.params.matchId[0] : req.params.matchId;

        const count = await prisma.prediction.count({
            where: { apiMatchId: parseInt(matchIdParam) }
        });

        // Get breakdown by type
        const breakdown = await prisma.prediction.groupBy({
            by: ['predictionType'],
            where: { apiMatchId: parseInt(matchIdParam) },
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
        logger.error('Error getting match prediction count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/matches/counts
 * Get prediction counts for multiple matches (batch)
 * Fix SEC-2: requireAuth + max 50 matchIds
 */
router.post('/matches/counts', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { matchIds } = req.body;

        if (!matchIds || !Array.isArray(matchIds) || matchIds.length > 50) {
            res.status(400).json({ error: 'matchIds must be an array with at most 50 items' });
            return;
        }

        const counts = await prisma.prediction.groupBy({
            by: ['apiMatchId'],
            where: {
                apiMatchId: { in: matchIds.map((id: any) => parseInt(id)) }
            },
            _count: true,
            orderBy: {
                apiMatchId: 'asc',
            },
            take: 50,
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
        logger.error('Error getting batch prediction counts:', error);
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
        const total = await prisma.prediction.count({
            where: { userId: user.id }
        });

        // Get correct predictions
        const correct = await prisma.prediction.count({
            where: { userId: user.id, isCorrect: true }
        });

        // Get incorrect predictions
        const incorrect = await prisma.prediction.count({
            where: { userId: user.id, isCorrect: false }
        });

        // Get pending (not resolved yet)
        const pending = await prisma.prediction.count({
            where: { userId: user.id, isCorrect: null }
        });

        // Get total coins won from predictions
        const coinsWonResult = await prisma.prediction.aggregate({
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
        logger.error('Error getting prediction stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/resolve/:matchId
 * Manually resolve predictions for a match (admin only)
 * Fix SEC-1: requireAuth + requireAdmin
 */
router.post('/resolve/:matchId', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure matchId is a string (handle array case)
        const matchIdParam = Array.isArray(req.params.matchId) ? req.params.matchId[0] : req.params.matchId;

        // Import the service dynamically to avoid circular dependency
        const { PredictionWatcherService } = await import('../services/prediction-watcher.service');

        const result = await PredictionWatcherService.manualResolve(parseInt(matchIdParam));

        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ success: false, error: result.message });
        }
    } catch (error) {
        logger.error('Error resolving predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/resolve-all
 * Trigger resolution check for all unresolved predictions (admin only)
 * Fix SEC-1: requireAuth + requireAdmin
 */
router.post('/resolve-all', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Import the service dynamically to avoid circular dependency
        const { PredictionWatcherService } = await import('../services/prediction-watcher.service');

        // Get count of unresolved predictions before
        const unresolvedBefore = await prisma.prediction.count({
            where: { isCorrect: null }
        });

        // Trigger the check
        await PredictionWatcherService.checkPredictions();

        // Get count after
        const unresolvedAfter = await prisma.prediction.count({
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
        logger.error('Error resolving all predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/predictions/unresolved
 * Get list of unresolved predictions (admin only)
 * Fix SEC-1: requireAuth + requireAdmin
 */
router.get('/unresolved', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const unresolvedPredictions = await prisma.prediction.findMany({
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
        logger.error('Error getting unresolved predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/predictions/submit
 * Submit a score prediction (for rank page)
 * Used for predicting exact match scores
 */
router.post('/submit', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        // ✅ استخدام req.auth.userId من الـ middleware
        const clerkUserId = req.auth?.userId;

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

        const todayPredictions = await prisma.prediction.count({
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
        const existingPrediction = await prisma.prediction.findUnique({
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
            prisma.prediction.create({
                data: {
                    userId: user.id,
                    apiMatchId: typeof matchId === 'string' ? parseInt(matchId) : matchId,
                    predictionType,
                    coinsSpent: PREDICTION_COST,
                    isCorrect: null, // ✅ Explicitly set to null (pending state)
                    // Fix SEC-3: store scores in dedicated fields, not in team name fields
                    predictedHomeScore: home,
                    predictedAwayScore: away,
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
        logger.error('Error submitting score prediction:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
        });
    }
});

/**
 * GET /api/predictions/leaderboard
 * Get top predictors leaderboard
 */
router.get('/leaderboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Efficient leaderboard: aggregate in DB instead of loading every user's predictions.
        const countsByUserAndState = await prisma.prediction.groupBy({
            by: ['userId', 'isCorrect'],
            _count: true,
        });

        const coinsWonByUser = await prisma.prediction.groupBy({
            by: ['userId'],
            where: { isCorrect: true },
            _sum: { coinsWon: true },
        });

        const statsByUser: Record<
            string,
            { total: number; correct: number; incorrect: number; pending: number; resolved: number; accuracy: number; totalCoinsWon: number }
        > = {};

        for (const row of countsByUserAndState) {
            const userId: string = row.userId;
            if (!statsByUser[userId]) {
                statsByUser[userId] = { total: 0, correct: 0, incorrect: 0, pending: 0, resolved: 0, accuracy: 0, totalCoinsWon: 0 };
            }
            const c = row._count as number;
            statsByUser[userId].total += c;
            if (row.isCorrect === true) statsByUser[userId].correct += c;
            else if (row.isCorrect === false) statsByUser[userId].incorrect += c;
            else statsByUser[userId].pending += c;
        }

        for (const row of coinsWonByUser) {
            const userId: string = row.userId;
            if (!statsByUser[userId]) continue;
            statsByUser[userId].totalCoinsWon = row._sum?.coinsWon || 0;
        }

        const candidates = Object.entries(statsByUser)
            .map(([userId, s]) => {
                const resolved = s.correct + s.incorrect;
                const accuracy = resolved > 0 ? Math.round((s.correct / resolved) * 100) : 0;
                return { userId, stats: { ...s, resolved, accuracy } };
            })
            .filter((x) => x.stats.resolved > 0)
            .sort((a, b) => {
                if (b.stats.accuracy !== a.stats.accuracy) return b.stats.accuracy - a.stats.accuracy;
                return b.stats.correct - a.stats.correct;
            })
            .slice(0, take);

        const userIds = candidates.map((c) => c.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, displayName: true, avatar: true, isVerified: true },
        });

        const usersById = new Map(users.map((u) => [u.id, u]));

        const leaderboard = candidates
            .map((c) => {
                const u = usersById.get(c.userId);
                if (!u) return null;
                return {
                    id: u.id,
                    username: u.username,
                    displayName: u.displayName,
                    avatar: u.avatar,
                    isVerified: u.isVerified,
                    stats: c.stats,
                };
            })
            .filter(Boolean);
        
        res.json({
            success: true,
            data: { leaderboard }
        });
    } catch (error) {
        logger.error('Error getting predictions leaderboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
