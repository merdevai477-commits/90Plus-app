/**
 * Predictions Routes
 * نظام التوقعات - API Endpoints
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import type { Prediction, User } from '@prisma/client';
import { requireAuth, optionalAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { responseCacheMiddleware, clearResponseCache } from '../middleware/responseCache.middleware';
import { getBlockRelation } from '../services/block.service';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

// Constants
const DAILY_PREDICTION_LIMIT = 10; // الحد الأقصى للتوقعات اليومية (= عدد التذاكر اليومية)
const PREDICTION_COST = 0; // Deprecated — predictions now cost only 1 daily ticket, not coins.
const CORRECT_PREDICTION_REWARD = 10; // coins - مكافأة التوقع الصحيح

/**
 * GET /api/predictions/remaining
 * Get remaining daily predictions for user
 */
router.get('/remaining', requireAuth, responseCacheMiddleware({ ttl: 30 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        // ✅ استخدام req.auth.userId من الـ middleware
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
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
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const { apiMatchId, predictionType, homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, matchDate, leagueName } = req.body;

        const parsedMatchId = parseInt(String(apiMatchId), 10);
        if (!apiMatchId || Number.isNaN(parsedMatchId) || parsedMatchId <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid apiMatchId', {
                field: 'apiMatchId',
            });
            return;
        }

        if (!predictionType) {
            sendError(req, res, ErrorCode.VALIDATION, 'Missing predictionType', {
                required: ['predictionType'],
            });
            return;
        }

        if (!['home', 'draw', 'away'].includes(predictionType)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid prediction type', {
                field: 'predictionType',
                allowed: ['home', 'draw', 'away'],
            });
            return;
        }

        // Find user (minimal select — full validation happens inside transaction)
        const userExists = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!userExists) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
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
                            apiMatchId: parsedMatchId
                        }
                    }
                });

                if (existing) throw new Error('ALREADY_PREDICTED');

                // All checks passed — create prediction atomically (no coin charge).
                const newPrediction = await tx.prediction.create({
                    data: {
                        userId: user.id,
                        apiMatchId: parsedMatchId,
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
                sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            } else if (msg === 'DAILY_LIMIT_REACHED') {
                sendError(req, res, ErrorCode.RATE_LIMIT, 'Daily prediction limit reached', {
                    reason: 'DAILY_LIMIT_REACHED',
                    limit: DAILY_PREDICTION_LIMIT,
                });
            } else if (msg === 'ALREADY_PREDICTED') {
                sendError(req, res, ErrorCode.CONFLICT, 'Already predicted on this match', {
                    reason: 'ALREADY_PREDICTED',
                    matchId: String(apiMatchId),
                });
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

        // Invalidate the per-user predictions cache so the next GET /user
        // reflects this new prediction immediately (30s TTL would otherwise
        // leave the UI out of sync after optimistic write).
        clearResponseCache('/predictions/user').catch((err) => {
            logger.warn('Failed to invalidate /predictions/user cache:', err);
        });
    } catch (error) {
        logger.error('Error creating prediction:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/predictions/user
 * Get all predictions for current user
 */
router.get('/user', requireAuth, responseCacheMiddleware({ ttl: 30 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        // ✅ استخدام req.auth.userId من الـ middleware
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
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
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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
            sendError(req, res, ErrorCode.VALIDATION, 'matchIds must be an array with at most 50 items', {
                field: 'matchIds',
                max: 50,
            });
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
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/predictions/stats
 * Get prediction statistics for user (correct, incorrect, total)
 */
router.get('/stats', requireAuth, responseCacheMiddleware({ ttl: 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // ✅ Single round-trip aggregation (was 5 separate count + 1 aggregate)
        // groupBy returns the count for each isCorrect value (true/false/null)
        // in one query — turns ~6× DB round trips into 2 (groupBy + aggregate).
        const [grouped, coinsAgg] = await Promise.all([
            prisma.prediction.groupBy({
                by: ['isCorrect'],
                where: { userId: user.id },
                _count: { _all: true },
            }),
            prisma.prediction.aggregate({
                where: { userId: user.id, isCorrect: true },
                _sum: { coinsWon: true },
            }),
        ]);

        let correct = 0;
        let incorrect = 0;
        let pending = 0;
        for (const row of grouped) {
            const c = row._count._all || 0;
            if (row.isCorrect === true) correct = c;
            else if (row.isCorrect === false) incorrect = c;
            else pending = c;
        }

        const total = correct + incorrect + pending;
        const resolved = correct + incorrect;
        const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0;
        const totalCoinsWon = coinsAgg._sum.coinsWon || 0;

        res.json({
            success: true,
            data: {
                total,
                correct,
                incorrect,
                pending,
                accuracy,
                resolved,
                totalCoinsWon,
            }
        });
    } catch (error) {
        logger.error('Error getting prediction stats:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

async function buildPredictionStatsForUser(userId: string) {
    const [grouped, coinsAgg] = await Promise.all([
        prisma.prediction.groupBy({
            by: ['isCorrect'],
            where: { userId },
            _count: { _all: true },
        }),
        prisma.prediction.aggregate({
            where: { userId, isCorrect: true },
            _sum: { coinsWon: true },
        }),
    ]);

    let correct = 0;
    let incorrect = 0;
    let pending = 0;
    for (const row of grouped) {
        const c = row._count._all || 0;
        if (row.isCorrect === true) correct = c;
        else if (row.isCorrect === false) incorrect = c;
        else pending = c;
    }

    const total = correct + incorrect + pending;
    const resolved = correct + incorrect;
    const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0;
    const totalCoinsWon = coinsAgg._sum.coinsWon || 0;

    return { total, correct, incorrect, pending, accuracy, resolved, totalCoinsWon };
}

const EMPTY_PUBLIC_PREDICTIONS = {
    stats: {
        total: 0,
        correct: 0,
        incorrect: 0,
        pending: 0,
        accuracy: 0,
        resolved: 0,
        totalCoinsWon: 0,
    },
    predictions: [] as Prediction[],
};

/**
 * GET /api/predictions/public/:username
 * Public prediction stats + recent history for another user's profile
 */
router.get('/public/:username', optionalAuth, responseCacheMiddleware({ ttl: 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const usernameParam = (Array.isArray(req.params.username) ? req.params.username[0] : req.params.username)?.trim() || '';
        if (!usernameParam) {
            sendError(req, res, ErrorCode.VALIDATION, 'Username is required');
            return;
        }

        const targetUser = await prisma.user.findFirst({
            where: {
                username: { equals: usernameParam, mode: 'insensitive' },
            },
            select: { id: true, username: true },
        });

        if (!targetUser) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const requestingClerkUserId = req.auth?.userId;
        if (requestingClerkUserId) {
            const viewer = await prisma.user.findUnique({
                where: { clerkUserId: requestingClerkUserId },
                select: { id: true },
            });
            if (viewer) {
                const blockStatus = await getBlockRelation(viewer.id, targetUser.id);
                if (blockStatus.blockedByMe || blockStatus.blockedMe) {
                    res.json({ success: true, data: EMPTY_PUBLIC_PREDICTIONS });
                    return;
                }
            }
        }

        const [stats, predictions] = await Promise.all([
            buildPredictionStatsForUser(targetUser.id),
            prisma.prediction.findMany({
                where: { userId: targetUser.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
                select: {
                    id: true,
                    apiMatchId: true,
                    predictionType: true,
                    homeTeam: true,
                    awayTeam: true,
                    homeTeamLogo: true,
                    awayTeamLogo: true,
                    matchDate: true,
                    leagueName: true,
                    isCorrect: true,
                    coinsWon: true,
                    coinsSpent: true,
                    createdAt: true,
                },
            }),
        ]);

        res.json({
            success: true,
            data: {
                stats,
                predictions,
            },
        });
    } catch (error) {
        logger.error('Error getting public user predictions:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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
            sendError(req, res, ErrorCode.VALIDATION, result.message);
        }
    } catch (error) {
        logger.error('Error resolving predictions:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
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
            sendError(req, res, ErrorCode.AUTHENTICATION, 'يجب تسجيل الدخول لإرسال التوقعات');
            return;
        }

        const { matchId, homeScore, awayScore } = req.body;

        // Validation
        if (!matchId || homeScore === undefined || awayScore === undefined) {
            sendError(req, res, ErrorCode.VALIDATION, 'يرجى إدخال جميع البيانات المطلوبة', {
                required: ['matchId', 'homeScore', 'awayScore'],
            });
            return;
        }

        // Validate scores are numbers
        const home = parseInt(homeScore);
        const away = parseInt(awayScore);

        if (isNaN(home) || isNaN(away)) {
            sendError(req, res, ErrorCode.VALIDATION, 'يرجى إدخال أرقام صحيحة', {
                reason: 'INVALID_SCORES',
            });
            return;
        }

        // Validate score range (0-20)
        if (home < 0 || away < 0 || home > 20 || away > 20) {
            sendError(req, res, ErrorCode.VALIDATION, 'النتيجة يجب أن تكون بين 0 و 20', {
                reason: 'INVALID_SCORE_RANGE',
                min: 0,
                max: 20,
            });
            return;
        }

        const user = await prisma.user.findFirst({
            where: { clerkUserId },
            select: { id: true, coins: true }
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'المستخدم غير موجود');
            return;
        }

        // Check if user has enough coins
        if (user.coins < PREDICTION_COST) {
            sendError(req, res, ErrorCode.VALIDATION, `تحتاج إلى ${PREDICTION_COST} عملة لإرسال توقع`, {
                reason: 'INSUFFICIENT_COINS',
                required: PREDICTION_COST,
                current: user.coins,
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
            sendError(req, res, ErrorCode.RATE_LIMIT, `لقد وصلت إلى الحد اليومي (${DAILY_PREDICTION_LIMIT} توقعات)`, {
                reason: 'DAILY_LIMIT_REACHED',
                limit: DAILY_PREDICTION_LIMIT,
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
            sendError(req, res, ErrorCode.CONFLICT, 'لقد أرسلت توقعاً لهذه المباراة بالفعل', {
                reason: 'ALREADY_PREDICTED',
                matchId: String(matchId),
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

        clearResponseCache('/predictions/user').catch((err) => {
            logger.warn('Failed to invalidate /predictions/user cache:', err);
        });
    } catch (error) {
        logger.error('Error submitting score prediction:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
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
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

export default router;
