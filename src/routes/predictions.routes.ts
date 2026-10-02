/**
 * Predictions Routes
 * نظام التوقعات - API Endpoints
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import type { Prediction } from '@prisma/client';
import { requireAuth, optionalAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { responseCacheMiddleware, clearResponseCache } from '../middleware/responseCache.middleware';
import { getBlockRelation } from '../services/block.service';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';
import {
    getKingDailyMatches,
    getKingLeaderboard,
    KingPredictionError,
    upsertKingPrediction,
    type KingMode,
    type KingPeriod,
} from '../services/king-prediction.service';

const router = Router();

interface ProfilePredictionRow {
  id: string;
  apiMatchId: number;
  predictionType: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  matchDate: string | null;
  leagueName: string | null;
  isCorrect: boolean | null;
  coinsWon: number | null;
  coinsSpent: number;
  createdAt: string;
  source: 'match';
}

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

        const {
            apiMatchId,
            predictionType,
            homeTeam,
            awayTeam,
            homeTeamLogo,
            awayTeamLogo,
            matchDate,
            leagueName,
            predictedHomeScore,
            predictedAwayScore,
        } = req.body;

        const parsedMatchId = parseInt(String(apiMatchId), 10);
        if (!apiMatchId || Number.isNaN(parsedMatchId) || parsedMatchId <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid apiMatchId', {
                field: 'apiMatchId',
            });
            return;
        }

        const hasScoreline = predictedHomeScore !== undefined && predictedHomeScore !== null
            && predictedAwayScore !== undefined && predictedAwayScore !== null;
        const home = hasScoreline ? parseInt(String(predictedHomeScore), 10) : null;
        const away = hasScoreline ? parseInt(String(predictedAwayScore), 10) : null;
        if (hasScoreline && (
            home == null || away == null || Number.isNaN(home) || Number.isNaN(away)
            || home < 0 || away < 0 || home > 20 || away > 20
        )) {
            sendError(req, res, ErrorCode.VALIDATION, 'النتيجة يجب أن تكون بين 0 و 20', {
                reason: 'INVALID_SCORE_RANGE',
                min: 0,
                max: 20,
            });
            return;
        }

        if (!hasScoreline && !predictionType) {
            sendError(req, res, ErrorCode.VALIDATION, 'Missing predictionType', {
                required: ['predictionType'],
            });
            return;
        }

        if (!hasScoreline && !['home', 'draw', 'away'].includes(predictionType)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid prediction type', {
                field: 'predictionType',
                allowed: ['home', 'draw', 'away'],
            });
            return;
        }

        let saved;
        try {
            saved = await upsertKingPrediction({
                clerkUserId,
                apiMatchId: parsedMatchId,
                mode: hasScoreline ? 'exact' : 'winner',
                predictionType: hasScoreline ? undefined : predictionType,
                homeScore: home ?? undefined,
                awayScore: away ?? undefined,
                homeTeam,
                awayTeam,
                homeTeamLogo,
                awayTeamLogo,
                matchDate,
                leagueName,
                dailyLimit: DAILY_PREDICTION_LIMIT,
                coinsSpent: PREDICTION_COST,
            });
        } catch (txError: unknown) {
            if (txError instanceof KingPredictionError) {
                if (txError.reason === 'USER_NOT_FOUND') {
                    sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
                } else if (txError.reason === 'DAILY_LIMIT_REACHED') {
                    sendError(req, res, ErrorCode.RATE_LIMIT, 'Daily prediction limit reached', {
                        reason: 'DAILY_LIMIT_REACHED',
                        limit: DAILY_PREDICTION_LIMIT,
                    });
                } else if (txError.reason === 'MATCH_STARTED' || txError.reason === 'ALREADY_RESOLVED') {
                    sendError(req, res, ErrorCode.CONFLICT, 'Predictions are closed for this match', {
                        reason: txError.reason,
                        matchId: String(apiMatchId),
                    });
                }
                return;
            }
            throw txError;
        }

        // Drop the cached GET /user before responding, so the screen reload
        // that follows this save cannot read the previous list.
        await clearResponseCache('/predictions/user').catch((err) => {
            logger.warn('Failed to invalidate /predictions/user cache:', err);
        });

        res.json({
            success: true,
            data: {
                prediction: saved.prediction,
                newBalance: saved.coins,
                remaining: saved.remaining,
                updated: saved.updated,
            },
            message: saved.updated ? 'تم تحديث توقعك' : 'تم تسجيل توقعك بنجاح! 🎯'
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
            take: 50,
        });

        const regularRows: ProfilePredictionRow[] = predictions.map((p) => ({
            id: p.id,
            apiMatchId: p.apiMatchId,
            predictionType: p.predictionType,
            homeTeam: p.homeTeam,
            awayTeam: p.awayTeam,
            homeTeamLogo: p.homeTeamLogo,
            awayTeamLogo: p.awayTeamLogo,
            matchDate: p.matchDate?.toISOString() ?? null,
            leagueName: p.leagueName,
            isCorrect: p.isCorrect,
            coinsWon: p.coinsWon,
            coinsSpent: p.coinsSpent,
            createdAt: p.createdAt.toISOString(),
            source: 'match',
        }));

        // Group by match for frontend consumption
        const predictionsMap: { [key: number]: any } = {};
        predictions.forEach((p: any) => {
            predictionsMap[p.apiMatchId] = {
                id: p.id,
                prediction: {
                    type: p.predictionType,
                    homeScore: p.predictedHomeScore ?? 0,
                    awayScore: p.predictedAwayScore ?? 0,
                },
                predictedHomeScore: p.predictedHomeScore,
                predictedAwayScore: p.predictedAwayScore,
                coinsSpent: p.coinsSpent,
                coinsWon: p.coinsWon,
                isCorrect: p.isCorrect,
                createdAt: p.createdAt
            };
        });

        res.json({
            success: true,
            data: {
                predictions: regularRows,
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

        res.json({
            success: true,
            data: await buildPredictionStatsForUser(user.id),
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

        const regularRows: ProfilePredictionRow[] = predictions.map((p) => ({
            id: p.id,
            apiMatchId: p.apiMatchId,
            predictionType: p.predictionType,
            homeTeam: p.homeTeam,
            awayTeam: p.awayTeam,
            homeTeamLogo: p.homeTeamLogo,
            awayTeamLogo: p.awayTeamLogo,
            matchDate: p.matchDate?.toISOString() ?? null,
            leagueName: p.leagueName,
            isCorrect: p.isCorrect,
            coinsWon: p.coinsWon,
            coinsSpent: p.coinsSpent,
            createdAt: p.createdAt.toISOString(),
            source: 'match',
        }));

        res.json({
            success: true,
            data: {
                stats,
                predictions: regularRows,
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

        const parsedMatchId = typeof matchId === 'string' ? parseInt(matchId, 10) : Number(matchId);
        if (!Number.isFinite(parsedMatchId) || parsedMatchId <= 0) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid matchId', { field: 'matchId' });
            return;
        }

        let saved;
        try {
            saved = await upsertKingPrediction({
                clerkUserId,
                apiMatchId: parsedMatchId,
                mode: 'exact',
                homeScore: home,
                awayScore: away,
                dailyLimit: DAILY_PREDICTION_LIMIT,
                coinsSpent: PREDICTION_COST,
            });
        } catch (txError: unknown) {
            if (txError instanceof KingPredictionError) {
                if (txError.reason === 'USER_NOT_FOUND') {
                    sendError(req, res, ErrorCode.NOT_FOUND, 'المستخدم غير موجود');
                } else if (txError.reason === 'DAILY_LIMIT_REACHED') {
                    sendError(req, res, ErrorCode.RATE_LIMIT, `لقد وصلت إلى الحد اليومي (${DAILY_PREDICTION_LIMIT} توقعات)`, {
                        reason: 'DAILY_LIMIT_REACHED',
                        limit: DAILY_PREDICTION_LIMIT,
                    });
                } else {
                    sendError(req, res, ErrorCode.CONFLICT, 'لا يمكن تعديل التوقع بعد بداية المباراة', {
                        reason: txError.reason,
                        matchId: String(matchId),
                    });
                }
                return;
            }
            throw txError;
        }

        await clearResponseCache('/predictions/user').catch((err) => {
            logger.warn('Failed to invalidate /predictions/user cache:', err);
        });

        res.json({
            success: true,
            data: {
                prediction: {
                    id: saved.prediction.id,
                    matchId: saved.prediction.apiMatchId,
                    homeScore: home,
                    awayScore: away,
                    predictionType: saved.prediction.predictionType,
                    coinsSpent: saved.prediction.coinsSpent,
                    createdAt: saved.prediction.createdAt
                },
                newBalance: saved.coins,
                remaining: saved.remaining,
                updated: saved.updated,
            },
            message: saved.updated ? 'تم تحديث توقعك' : '🎯 تم إرسال توقعك بنجاح!'
        });
    } catch (error) {
        logger.error('Error submitting score prediction:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
    }
});

/**
 * GET /api/predictions/king/matches?date=YYYY-MM-DD
 * The day's top 10 matches for King of the Game / King of Results.
 */
router.get('/king/matches', async (req: Request, res: Response): Promise<void> => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : undefined;
        const matches = await getKingDailyMatches(date);
        res.json({ success: true, data: matches });
    } catch (error) {
        logger.error('Error getting king matches:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/predictions/leaderboard
 * Get top predictors leaderboard
 */
router.get('/leaderboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const mode = req.query.mode;
        const period = req.query.period;
        if (
            (mode === 'winner' || mode === 'exact')
            && (period === 'week' || period === 'all')
        ) {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
                return;
            }
            const take = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 50);
            const data = await getKingLeaderboard({
                clerkUserId,
                mode: mode as KingMode,
                period: period as KingPeriod,
                limit: take,
            });
            res.json({ success: true, data });
            return;
        }

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
