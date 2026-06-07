/**
 * Notification Routes
 *
 * Fix 4: Route registration order corrected.
 * All static/named paths MUST be registered before parameterised /:id routes,
 * otherwise Express matches e.g. "read-all" as the :id param.
 *
 * Correct order (static first, then parameterised):
 *  1.  GET    /                    – list notifications
 *  2.  GET    /unread-count        ← MUST be before /:id
 *  3.  GET    /preferences         ← MUST be before /:id
 *  4.  PUT    /preferences         ← MUST be before /:id/read
 *  5.  PUT    /read-all            ← MUST be before /:id/read
 *  6.  DELETE /clear-all           ← MUST be before /:id
 *  7.  GET    /:id                 – parameterised routes start here
 *  8.  PUT    /:id/read
 *  9.  DELETE /:id
 * 10.  POST   /:id/opened
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { verifyNotificationOwnership } from '../middleware/ownership.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

// ─── 1. GET / ─────────────────────────────────────────────────────────────────

/**
 * GET /api/notifications
 * Get user notifications (paginated)
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const { limit = '20', offset = '0' } = req.query;
        const take = Number.parseInt(limit as string, 10);
        const skip = Number.parseInt(offset as string, 10);

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: Number.isFinite(take) ? take : 20,
                skip: Number.isFinite(skip) ? skip : 0,
                select: {
                    id: true,
                    type: true,
                    title: true,
                    message: true,
                    isRead: true,
                    data: true,
                    createdAt: true,
                },
            }),
            prisma.notification.count({ where: { userId: user.id } }),
        ]);

        res.json({
            status: 'SUCCESS',
            data: {
                notifications,
                pagination: {
                    total,
                    limit: Number.isFinite(take) ? take : 20,
                    offset: Number.isFinite(skip) ? skip : 0,
                    hasMore: (Number.isFinite(skip) ? skip : 0) + notifications.length < total,
                },
            },
        });
    } catch (error: any) {
        logger.error('Get notifications error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── 2. GET /unread-count ─────────────────────────────────────────────────────

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const count = await prisma.notification.count({
            where: { userId: user.id, isRead: false },
        });

        res.json({ status: 'SUCCESS', data: { count } });
    } catch (error: any) {
        logger.error('Get unread count error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── 3. GET /preferences ─────────────────────────────────────────────────────

/**
 * GET /api/notifications/preferences
 * Get notification preferences for current user
 */
router.get('/preferences', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

        const prefs = await (prisma as any).notificationPreferences.upsert({
            where: { userId: user.id },
            create: { userId: user.id },
            update: {},
        });

        res.json({ status: 'SUCCESS', data: { preferences: prefs } });
    } catch (error: any) {
        logger.error('Get notification preferences error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── 4. PUT /preferences ─────────────────────────────────────────────────────

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

        const allowedFields = [
            // Match events
            'matchGoals', 'matchStart', 'matchEnd', 'matchHalftime',
            'matchCards', 'matchSubs', 'matchVar', 'matchLineups', 'leagueMatches',
            // Social
            'socialFollow', 'socialLike', 'socialComment', 'socialReply', 'socialMention', 'socialShare',
            // Predictions / rewards / lifecycle
            'predictionResults', 'luckyWheel', 'gifts', 'dailyQuiz', 'cooldown',
            'levelUp', 'reportUpdates', 'avatarUpload', 'videoProcessed', 'leaderboard',
            // Opt-in AI coach
            'aiCoach',
        ];

        const updateData: Record<string, boolean> = {};
        for (const field of allowedFields) {
            if (typeof req.body[field] === 'boolean') {
                updateData[field] = req.body[field];
            }
        }

        const prefs = await (prisma as any).notificationPreferences.upsert({
            where: { userId: user.id },
            create: { userId: user.id, ...updateData },
            update: updateData,
        });

        res.json({ status: 'SUCCESS', data: { preferences: prefs } });
    } catch (error: any) {
        logger.error('Update notification preferences error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── 5. PUT /read-all ─────────────────────────────────────────────────────────

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        await prisma.notification.updateMany({
            where: { userId: user.id, isRead: false },
            data: { isRead: true },
        });

        res.json({ status: 'SUCCESS', message: 'تم قراءة جميع الإشعارات' });
    } catch (error: any) {
        logger.error('Mark all as read error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── 6. DELETE /clear-all ────────────────────────────────────────────────────

/**
 * DELETE /api/notifications/clear-all
 * Delete all notifications for user
 */
router.delete('/clear-all', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        await prisma.notification.deleteMany({ where: { userId: user.id } });

        res.json({ status: 'SUCCESS', message: 'تم مسح جميع الإشعارات' });
    } catch (error: any) {
        logger.error('Clear all notifications error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── 6.5 Match notification subscriptions ───────────────────────────────────
// MUST come before the /:id routes below — otherwise DELETE /:id would
// swallow DELETE /match-subscribe/:fixtureId (Express segment-matching).
//
// Lets the user "bell" a fixture on the matches screen. Persists in FavoriteMatch
// so the existing MatchWatcherService sees it, AND schedules a dedicated Bull
// delayed job that fires a push notification at kick-off time.

/**
 * POST /api/notifications/match-subscribe
 * Body: { fixtureId: number, matchTime: string(ISO), homeTeam, awayTeam,
 *         homeTeamLogo?, awayTeamLogo?, leagueName? }
 */
router.post('/match-subscribe', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const { fixtureId, matchTime, homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, leagueName } = req.body ?? {};
        const parsedFixtureId = Number.parseInt(String(fixtureId), 10);

        if (!Number.isFinite(parsedFixtureId) || !matchTime || !homeTeam || !awayTeam) {
            sendError(
                req,
                res,
                ErrorCode.VALIDATION,
                'fixtureId, matchTime, homeTeam and awayTeam are required',
            );
            return;
        }

        const matchDate = new Date(matchTime);
        if (Number.isNaN(matchDate.getTime())) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid matchTime');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        const subscription = await prisma.favoriteMatch.upsert({
            where: { userId_apiMatchId: { userId: user.id, apiMatchId: parsedFixtureId } },
            update: {
                matchDate,
                homeTeam: String(homeTeam),
                awayTeam: String(awayTeam),
                homeTeamLogo: homeTeamLogo ? String(homeTeamLogo) : null,
                awayTeamLogo: awayTeamLogo ? String(awayTeamLogo) : null,
                leagueName: leagueName ? String(leagueName) : null,
                // Re-arming after a previous notification means the user must have
                // re-subscribed for a re-scheduled fixture (e.g. postponed).
                notifiedStart: false,
                // Re-baseline on re-subscribe so mid-match bell does not replay old events.
                lastHomeScore: null,
                lastAwayScore: null,
                lastStatus: null,
            },
            create: {
                userId: user.id,
                apiMatchId: parsedFixtureId,
                matchDate,
                homeTeam: String(homeTeam),
                awayTeam: String(awayTeam),
                homeTeamLogo: homeTeamLogo ? String(homeTeamLogo) : null,
                awayTeamLogo: awayTeamLogo ? String(awayTeamLogo) : null,
                leagueName: leagueName ? String(leagueName) : null,
            },
        });

        // Schedule the delayed push. Safe if Redis is down (returns silently).
        try {
            const { scheduleMatchStartReminder } = await import('../queues/match-start-reminder.queue');
            await scheduleMatchStartReminder({
                userId: user.id,
                fixtureId: parsedFixtureId,
                homeTeam: String(homeTeam),
                awayTeam: String(awayTeam),
                matchDate: matchDate.toISOString(),
            });
        } catch (err) {
            logger.warn('[match-subscribe] failed to schedule reminder:', err);
        }

        res.json({
            status: 'SUCCESS',
            data: {
                fixtureId: parsedFixtureId,
                subscribed: true,
                subscriptionId: subscription.id,
            },
        });
    } catch (error: any) {
        logger.error('Match subscribe error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * DELETE /api/notifications/match-subscribe/:fixtureId
 */
router.delete('/match-subscribe/:fixtureId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const fixtureIdParam = Array.isArray(req.params.fixtureId) ? req.params.fixtureId[0] : req.params.fixtureId;
        const parsedFixtureId = Number.parseInt(fixtureIdParam, 10);
        if (!Number.isFinite(parsedFixtureId)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid fixtureId');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Idempotent delete — missing record is not an error.
        await prisma.favoriteMatch.deleteMany({
            where: { userId: user.id, apiMatchId: parsedFixtureId },
        });

        try {
            const { cancelMatchStartReminder } = await import('../queues/match-start-reminder.queue');
            await cancelMatchStartReminder(user.id, parsedFixtureId);
        } catch (err) {
            logger.warn('[match-subscribe] failed to cancel reminder:', err);
        }

        res.json({
            status: 'SUCCESS',
            data: { fixtureId: parsedFixtureId, subscribed: false },
        });
    } catch (error: any) {
        logger.error('Match unsubscribe error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/notifications/match-subscriptions
 * Returns the set of fixtureIds the current user is subscribed to. Used by
 * the Matches screen to hydrate the bell state on mount.
 */
router.get('/match-subscriptions', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
            return;
        }

        // Only return future or live matches — past ones are noise for the UI.
        const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h back to cover live matches
        const rows = await prisma.favoriteMatch.findMany({
            where: { userId: user.id, matchDate: { gte: cutoff } },
            select: { apiMatchId: true },
            take: 500,
        });

        res.json({
            status: 'SUCCESS',
            data: { fixtureIds: rows.map((r: { apiMatchId: number }) => r.apiMatchId) },
        });
    } catch (error: any) {
        logger.error('Match subscriptions fetch error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── 7–10. Parameterised /:id routes (MUST come last) ────────────────────────

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 * ✅ ZERO TRUST: Ownership verified by middleware
 */
router.put('/:id/read', requireAuth, verifyNotificationOwnership, async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });

        res.json({ status: 'SUCCESS', message: 'تم قراءة الإشعار' });
    } catch (error: any) {
        logger.error('Mark as read error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 * ✅ ZERO TRUST: Ownership verified by middleware
 */
router.delete('/:id', requireAuth, verifyNotificationOwnership, async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        await prisma.notification.delete({ where: { id } });

        res.json({ status: 'SUCCESS', message: 'تم حذف الإشعار' });
    } catch (error: any) {
        logger.error('Delete notification error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/notifications/:id/opened
 * Track notification open event
 * ✅ ZERO TRUST: Ownership verified by middleware
 */
router.post('/:id/opened', requireAuth, verifyNotificationOwnership, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

        await (prisma as any).notificationEvent.create({
            data: {
                notificationId: id,
                userId: user.id,
                event: 'OPENED',
            },
        });

        res.json({ status: 'SUCCESS' });
    } catch (error: any) {
        logger.error('Track notification open error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

// ─── TEST: Send test push notification to current user ───────────────────────
/**
 * POST /api/notifications/test-push
 * Sends a test push notification to the current user (Developer only).
 * Body: { type?: string } — optional notification type to test
 */
router.post('/test-push', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, expoPushToken: true, pushNotificationsConsent: true, isDeveloper: true },
        });
        if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }
        if (!user.isDeveloper) { sendError(req, res, ErrorCode.AUTHORIZATION, 'Developer access only'); return; }

        if (!user.expoPushToken) {
            sendError(req, res, ErrorCode.VALIDATION, 'No push token registered. Open the app on a real device first.');
            return;
        }

        const { type = 'all' } = req.body;

        const tests: Array<{ type: string; title: string; body: string; data: any }> = [];

        if (type === 'all' || type === 'prediction_ticket') {
            tests.push({
                type: 'PREDICTION_TICKET_RENEWAL',
                title: '🎟️ تذاكرك اتجددت!',
                body: 'عندك 10 تذاكر توقع جديدة. توقع نتيجة المباريات واكسب عملات! ⚽',
                data: { type: 'PREDICTION_TICKET_RENEWAL', screen: '/(tabs)/matches' },
            });
        }
        if (type === 'all' || type === 'cooldown_avatar') {
            tests.push({
                type: 'COOLDOWN_EXPIRED',
                title: '📸 غيّر صورتك!',
                body: 'الكولداون خلص — تقدر تغير صورة بروفايلك دلوقتي!',
                data: { type: 'COOLDOWN_EXPIRED', cooldownType: 'avatar', screen: '/(tabs)/profile' },
            });
        }
        if (type === 'all' || type === 'cooldown_reel') {
            tests.push({
                type: 'COOLDOWN_EXPIRED',
                title: '🎬 ارفع فيديو جديد!',
                body: 'تقدر ترفع فيديو جديد دلوقتي. شارك موهبتك مع الجمهور!',
                data: { type: 'COOLDOWN_EXPIRED', cooldownType: 'reel', screen: '/(tabs)/profile' },
            });
        }
        if (type === 'all' || type === 'quiz_renewal') {
            tests.push({
                type: 'QUIZ_RENEWAL',
                title: '🧠 اختبار جديد جاهز!',
                body: 'اختبار اليوم في انتظارك. اثبت معرفتك بالكرة واكسب XP!',
                data: { type: 'QUIZ_RENEWAL', screen: '/(tabs)/quiz' },
            });
        }
        if (type === 'all' || type === 'lucky_wheel') {
            tests.push({
                type: 'LUCKY_WHEEL',
                title: '🎡 عجلة الحظ جاهزة!',
                body: 'حظك النهارده ينتظرك، العب دلوقتي!',
                data: { type: 'LUCKY_WHEEL', screen: '/(tabs)/Home', openLuckyWheel: 'true' },
            });
        }
        if (type === 'all' || type === 'match_goal') {
            tests.push({
                type: 'MATCH_UPDATE',
                title: '⚽ هدف!',
                body: 'الأهلي سجل! الأهلي 1 - 0 الزمالك',
                data: { type: 'MATCH_GOAL', matchId: 99999, screen: '/(tabs)/matches' },
            });
        }
        if (type === 'all' || type === 'prediction_result') {
            tests.push({
                type: 'PREDICTION_RESULT',
                title: '🎯 توقع صحيح!',
                body: 'تهانينا! توقعك كان صحيحاً 🎉\nالأهلي vs الزمالك\n+10 تذاكر',
                data: { type: 'PREDICTION_RESULT', isCorrect: true, screen: '/(tabs)/matches' },
            });
        }
        if (type === 'all' || type === 're_engagement') {
            tests.push({
                type: 'RE_ENGAGEMENT',
                title: '⚽ الكرة بتنادي عليك!',
                body: 'رجع التطبيق وشوف أحدث مباريات وتوقعات النهارده 🔥',
                data: { type: 'RE_ENGAGEMENT', screen: '/(tabs)/Home' },
            });
        }

        // Send all test notifications
        const { default: PushNotificationService } = await import('../services/push-notification.service');
        const results = await Promise.allSettled(
            tests.map(t => PushNotificationService.sendNotification({
                to: user.expoPushToken!,
                title: t.title,
                body: t.body,
                data: t.data,
                channelId: 'general',
            }))
        );

        const success = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        res.json({
            status: 'SUCCESS',
            message: `Sent ${success} test notifications (${failed} failed)`,
            data: { sent: tests.map(t => t.type), success, failed },
        });
    } catch (error: any) {
        logger.error('Test push error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

export default router;
