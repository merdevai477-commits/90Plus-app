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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
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
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        const count = await prisma.notification.count({
            where: { userId: user.id, isRead: false },
        });

        res.json({ status: 'SUCCESS', data: { count } });
    } catch (error: any) {
        logger.error('Get unread count error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        if (!clerkUserId) { res.status(401).json({ status: 'ERROR', message: 'Unauthorized' }); return; }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) { res.status(404).json({ status: 'ERROR', message: 'User not found' }); return; }

        const prefs = await (prisma as any).notificationPreferences.upsert({
            where: { userId: user.id },
            create: { userId: user.id },
            update: {},
        });

        res.json({ status: 'SUCCESS', data: { preferences: prefs } });
    } catch (error: any) {
        logger.error('Get notification preferences error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        if (!clerkUserId) { res.status(401).json({ status: 'ERROR', message: 'Unauthorized' }); return; }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) { res.status(404).json({ status: 'ERROR', message: 'User not found' }); return; }

        const allowedFields = [
            'matchGoals', 'matchStart', 'matchEnd', 'matchHalftime', 'leagueMatches',
            'socialFollow', 'socialLike', 'socialComment', 'socialReply', 'socialMention',
            'predictionResults', 'luckyWheel', 'gifts',
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        await prisma.notification.updateMany({
            where: { userId: user.id, isRead: false },
            data: { isRead: true },
        });

        res.json({ status: 'SUCCESS', message: 'تم قراءة جميع الإشعارات' });
    } catch (error: any) {
        logger.error('Mark all as read error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        await prisma.notification.deleteMany({ where: { userId: user.id } });

        res.json({ status: 'SUCCESS', message: 'تم مسح جميع الإشعارات' });
    } catch (error: any) {
        logger.error('Clear all notifications error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const { fixtureId, matchTime, homeTeam, awayTeam, homeTeamLogo, awayTeamLogo, leagueName } = req.body ?? {};
        const parsedFixtureId = Number.parseInt(String(fixtureId), 10);

        if (!Number.isFinite(parsedFixtureId) || !matchTime || !homeTeam || !awayTeam) {
            res.status(400).json({
                status: 'ERROR',
                message: 'fixtureId, matchTime, homeTeam and awayTeam are required',
            });
            return;
        }

        const matchDate = new Date(matchTime);
        if (Number.isNaN(matchDate.getTime())) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid matchTime' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * DELETE /api/notifications/match-subscribe/:fixtureId
 */
router.delete('/match-subscribe/:fixtureId', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const fixtureIdParam = Array.isArray(req.params.fixtureId) ? req.params.fixtureId[0] : req.params.fixtureId;
        const parsedFixtureId = Number.parseInt(fixtureIdParam, 10);
        if (!Number.isFinite(parsedFixtureId)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid fixtureId' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
            data: { fixtureIds: rows.map((r) => r.apiMatchId) },
        });
    } catch (error: any) {
        logger.error('Match subscriptions fetch error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        if (!clerkUserId) { res.status(401).json({ status: 'ERROR', message: 'Unauthorized' }); return; }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true },
        });
        if (!user) { res.status(404).json({ status: 'ERROR', message: 'User not found' }); return; }

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
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

export default router;
