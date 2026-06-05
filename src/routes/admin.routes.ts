import { Router, Request, Response } from 'express';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { requireAdmin } from '../middleware/admin.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { StrikeService } from '../services/strike.service';
import { AuditService, AuditAction, AuditTargetType } from '../services/audit.service';
import { suspendUser, autoDeleteContent } from '../services/moderation.service';
import { NotificationService, NotificationType } from '../services/notification.service';
import { UploadAnalyticsService } from '../services/upload-analytics.service';
import { ErrorCode, sendError } from '../constants/errors';
import { notifyUser } from '../services/notify.service';

const router = Router();

/**
 * GET /api/admin/reports
 * List pending reports with filters
 */
router.get('/reports', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, priority, type, limit = '50', offset = '0' } = req.query;

        const where: any = {};

        if (status) {
            where.status = status;
        } else {
            // Default to pending if no status specified
            where.status = 'PENDING';
        }

        if (priority) {
            where.priority = priority;
        }

        if (type) {
            where.type = type;
        }

        const reports = await prisma.report.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
            include: {
                reporter: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                    },
                },
                reportedUser: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                    },
                },
                reportedReel: {
                    select: {
                        id: true,
                        caption: true,
                        isDeleted: true,
                    },
                },
                reportedComment: {
                    select: {
                        id: true,
                        content: true,
                        isDeleted: true,
                    },
                },
                _count: {
                    select: {
                        strikes: true,
                    },
                },
            },
        });

        res.json({
            status: 'SUCCESS',
            data: { reports },
        });
    } catch (error: any) {
        logger.error('Get admin reports error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/admin/reports/:id
 * Get report details
 */
router.get('/reports/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure id is a string (handle array case)
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                reporter: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                    },
                },
                reportedUser: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                    },
                },
                reportedReel: {
                    select: {
                        id: true,
                        caption: true,
                        videoUrl: true,
                        thumbnail: true,
                        isDeleted: true,
                    },
                },
                reportedComment: {
                    select: {
                        id: true,
                        content: true,
                        isDeleted: true,
                    },
                },
                strikes: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                            },
                        },
                    },
                },
                reviewer: {
                    select: {
                        id: true,
                        username: true,
                    },
                },
            },
        });

        if (!report) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'Report not found');
            return;
        }

        res.json({
            status: 'SUCCESS',
            data: { report },
        });
    } catch (error: any) {
        logger.error('Get report details error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/admin/reports/:id/review
 * Review and take action on a report
 */
router.post('/reports/:id/review', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure id is a string (handle array case)
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { action, reason } = req.body;
        const adminUser = (req as any).adminUser;

        if (!action || !['NO_ACTION', 'WARNING', 'CONTENT_REMOVED', 'USER_SUSPENDED', 'USER_BANNED'].includes(action)) {
            sendError(req, res, ErrorCode.VALIDATION, 'Invalid action');
            return;
        }

        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                reportedUser: true,
                reportedReel: true,
                reportedComment: true,
            },
        });

        if (!report) {
            sendError(req, res, ErrorCode.NOT_FOUND, 'Report not found');
            return;
        }

        // Update report status
        await prisma.report.update({
            where: { id },
            data: {
                status: 'REVIEWED',
                reviewedBy: adminUser.id,
                reviewedAt: new Date(),
                action: action as any,
            },
        });

        // Take action based on review decision
        const targetUserId = report.reportedUserId || report.reportedReel?.userId || report.reportedComment?.userId;

        if (action === 'CONTENT_REMOVED') {
            if (report.reportedReelId) {
                await autoDeleteContent(report.reportedReelId, 'reel', reason || report.reason);
            } else if (report.reportedCommentId) {
                await autoDeleteContent(report.reportedCommentId, 'comment', reason || report.reason);
            }
        } else if (action === 'USER_SUSPENDED' && targetUserId) {
            await suspendUser(targetUserId, reason || report.reason, 7);
        } else if (action === 'USER_BANNED' && targetUserId) {
            await prisma.user.update({
                where: { id: targetUserId },
                data: {
                    isBanned: true,
                    bannedAt: new Date(),
                    banReason: reason || report.reason,
                },
            });

            await NotificationService.createNotification({
                userId: targetUserId,
                title: 'تم حظر حسابك',
                message: `تم حظر حسابك نهائياً. السبب: ${reason || report.reason}`,
                type: 'GENERAL',
                data: {
                    reason: reason || report.reason,
                    action: 'BAN',
                },
            });

            await AuditService.logUserSuspended(targetUserId, adminUser.id, reason || report.reason);
        }

        // Create audit log
        await AuditService.log({
            action: AuditAction.ADMIN_REVIEW,
            actorId: adminUser.id,
            targetId: report.id,
            targetType: AuditTargetType.REPORT,
            resource: 'MODERATION',
            reason: reason || report.reason,
            metadata: { action, reportId: report.id },
        });

        // Notify the REPORTER about the outcome — localized template,
        // preference gated, inbox + push + WebSocket.
        const actionTaken = action !== 'NO_ACTION';
        notifyUser({
            userId: report.reporterId,
            type: NotificationType.REPORT_RESOLVED,
            titleKey: 'reportResolvedTitle',
            bodyKey: 'reportResolvedBody',
            data: {
                screen: '/notifications',
                reportId: report.id,
                action,
                actionTaken,
            },
            idempotencyKey: `report-resolved:${report.id}`,
        }).catch((err) => logger.warn('[admin/report] reporter notify failed:', err?.message));

        res.json({
            status: 'SUCCESS',
            message: 'Report reviewed successfully',
        });
    } catch (error: any) {
        logger.error('Review report error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/admin/strikes
 * List user strikes
 */
router.get('/strikes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId, limit = '50', offset = '0' } = req.query;

        const where: any = {};

        if (userId) {
            where.userId = userId;
        }

        const strikes = await prisma.strike.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                    },
                },
                report: {
                    select: {
                        id: true,
                        type: true,
                        status: true,
                    },
                },
            },
        });

        res.json({
            status: 'SUCCESS',
            data: { strikes },
        });
    } catch (error: any) {
        logger.error('Get strikes error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/admin/users/:id/strikes
 * Get strikes for specific user
 */
router.get('/users/:id/strikes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure id is a string (handle array case)
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const strikes = await StrikeService.getUserStrikes(id);
        const strikeCount = await StrikeService.getUserStrikeCount(id);

        res.json({
            status: 'SUCCESS',
            data: {
                strikes,
                strikeCount,
            },
        });
    } catch (error: any) {
        logger.error('Get user strikes error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/admin/users/:id/suspend
 * Manually suspend user
 */
router.post('/users/:id/suspend', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure id is a string (handle array case)
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { reason, durationDays } = req.body;
        const adminUser = (req as any).adminUser;

        if (!reason) {
            sendError(req, res, ErrorCode.VALIDATION, 'Reason is required');
            return;
        }

        await suspendUser(id, reason, durationDays || 7);

        await AuditService.logUserSuspended(id, adminUser.id, reason);

        res.json({
            status: 'SUCCESS',
            message: 'User suspended successfully',
        });
    } catch (error: any) {
        logger.error('Suspend user error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/admin/users/:id/unsuspend
 * Un-suspend user
 */
router.post('/users/:id/unsuspend', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure id is a string (handle array case)
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const adminUser = (req as any).adminUser;

        await prisma.user.update({
            where: { id },
            data: {
                isSuspended: false,
                suspendedUntil: null,
            },
        });

        await NotificationService.createNotification({
            userId: id,
            title: 'تم إلغاء تعليق حسابك',
            message: 'تم إلغاء تعليق حسابك ويمكنك الآن استخدام المنصة بشكل طبيعي',
            type: 'GENERAL',
            data: {
                action: 'UNSUSPEND',
            },
        });

        await AuditService.log({
            action: AuditAction.USER_UNSUSPENDED,
            actorId: adminUser.id,
            targetId: id,
            targetType: AuditTargetType.USER,
            resource: 'MODERATION',
        });

        res.json({
            status: 'SUCCESS',
            message: 'User unsuspended successfully',
        });
    } catch (error: any) {
        logger.error('Unsuspend user error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/admin/users/:username/verify
 * Verify user and grant developer access
 */
router.post('/users/:username/verify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        // Ensure username is a string (handle array case)
        const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
        const adminUser = (req as any).adminUser;

        // Find user by username (case-insensitive)
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    {
                        username: {
                            equals: username,
                            mode: 'insensitive',
                        },
                    },
                    {
                        displayName: {
                            equals: username,
                            mode: 'insensitive',
                        },
                    },
                ],
            },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, `User with username "${username}" not found`);
            return;
        }

        // Update user to verified and developer
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                isDeveloper: true,
            },
        });

        // Create notification for user
        await NotificationService.createNotification({
            userId: user.id,
            title: 'تم توثيق حسابك',
            message: 'تم توثيق حسابك ومنحك صلاحيات المطور',
            type: 'GENERAL',
            data: {
                action: 'VERIFIED',
            },
        });

        // Audit log (using existing action or create new one)
        try {
            await AuditService.log({
                action: AuditAction.USER_SUSPENDED, // Using existing action for now
                actorId: adminUser.id,
                targetId: user.id,
                targetType: AuditTargetType.USER,
                resource: 'MODERATION',
                metadata: {
                    username: user.username,
                    isDeveloper: true,
                    action: 'VERIFIED',
                },
            });
        } catch (auditError) {
            // Continue even if audit log fails
            logger.warn('Failed to create audit log:', auditError);
        }

        logger.info(`User ${username} verified and granted developer access by admin ${adminUser.id}`);

        res.json({
            status: 'SUCCESS',
            message: 'تم توثيق المستخدم ومنحه صلاحيات المطور بنجاح',
            data: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                isVerified: updatedUser.isVerified,
                isDeveloper: updatedUser.isDeveloper,
            },
        });
    } catch (error: any) {
        logger.error('Verify user error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/admin/audit
 * List audit logs with filters
 */
router.get('/audit', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            actorId,
            targetId,
            targetType,
            action,
            startDate,
            endDate,
            limit = '50',
            offset = '0',
        } = req.query;

        const auditLogs = await AuditService.getAuditLogs({
            actorId: actorId as string,
            targetId: targetId as string,
            targetType: targetType as any,
            action: action as any,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
        });

        res.json({
            status: 'SUCCESS',
            data: { auditLogs },
        });
    } catch (error: any) {
        logger.error('Get audit logs error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/admin/notifications/stats
 * Get notification analytics (last 7 days)
 */
router.get('/notifications/stats', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [sentByType, totalSent, totalOpened] = await Promise.all([
            prisma.notification.groupBy({
                by: ['type'],
                where: { createdAt: { gte: since } },
                _count: { id: true },
            }),
            prisma.notification.count({ where: { createdAt: { gte: since } } }),
            (prisma as any).notificationEvent.count({ where: { event: 'OPENED', createdAt: { gte: since } } }),
        ]);

        const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';

        res.json({
            status: 'SUCCESS',
            data: {
                period: '7 days',
                totalSent,
                totalOpened,
                openRate: `${openRate}%`,
                byType: sentByType.map((t: { type: string; _count: { id: number } }) => ({
                    type: t.type,
                    sent: t._count.id,
                })),
            },
        });
    } catch (error: any) {
        logger.error('Notification stats error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/admin/push-debug
 * Forensic push test: DB state + optional send + Expo ticket (admin / isDeveloper only).
 *
 * Body: { clerkUserId?: string, username?: string, title?, body?, send?: boolean }
 */
router.post('/push-debug', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            clerkUserId,
            username,
            title = '90Plus Debug',
            body = 'Testing push notification',
            send = true,
        } = req.body as {
            clerkUserId?: string;
            username?: string;
            title?: string;
            body?: string;
            send?: boolean;
        };

        if (!clerkUserId && !username) {
            sendError(req, res, ErrorCode.VALIDATION, 'clerkUserId or username is required');
            return;
        }

        const user = await prisma.user.findFirst({
            where: clerkUserId ? { clerkUserId } : { username },
            select: {
                id: true,
                username: true,
                clerkUserId: true,
                expoPushToken: true,
                pushNotificationsConsent: true,
                updatedAt: true,
            },
        });

        if (!user) {
            logger.info('[push-debug] User not found', { clerkUserId, username });
            res.json({
                success: false,
                userFound: false,
                user: clerkUserId ?? username,
                hasToken: false,
                consent: null,
                token: null,
                message: 'User not found',
            });
            return;
        }

        const token = user.expoPushToken?.trim() || null;
        const hasToken = !!(token && token.length > 0);

        logger.info('[push-debug] User found', {
            username: user.username,
            clerkUserId: user.clerkUserId,
            hasToken,
            consent: user.pushNotificationsConsent,
            tokenPrefix: token ? `${token.substring(0, 30)}...` : null,
        });

        const baseReport = {
            success: false,
            userFound: true,
            user: user.clerkUserId,
            username: user.username,
            hasToken,
            consent: user.pushNotificationsConsent,
            token: token,
            tokenPrefix: token ? `${token.substring(0, 35)}...` : null,
            updatedAt: user.updatedAt.toISOString(),
            pushAttempted: false,
            ticketStatus: null as string | null,
            ticketId: null as string | null,
            ticketError: null as string | null,
            tickets: null as unknown[] | null,
        };

        if (!hasToken || !token) {
            res.json({
                ...baseReport,
                message: 'No expoPushToken — open app on device, grant notifications, stay signed in',
            });
            return;
        }

        if (!send) {
            res.json({
                ...baseReport,
                success: true,
                message: 'User has token; send=false (dry run)',
            });
            return;
        }

        const payload = {
            to: token,
            title,
            body,
            sound: 'default' as const,
            data: { type: 'DEBUG_TEST', source: 'admin/push-debug' },
            channelId: 'general',
        };

        logger.info('[push-debug] Sending push', {
            clerkUserId: user.clerkUserId,
            title,
            body,
            tokenPrefix: `${token.substring(0, 30)}...`,
        });

        const expo = new Expo();
        const message: ExpoPushMessage = {
            to: payload.to,
            sound: payload.sound,
            title: payload.title,
            body: payload.body,
            data: payload.data,
            priority: 'high',
            channelId: payload.channelId,
        };

        const chunks = expo.chunkPushNotifications([message]);
        const allTickets: unknown[] = [];
        let ticketStatus: string | null = null;
        let ticketId: string | null = null;
        let ticketError: string | null = null;

        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            allTickets.push(...ticketChunk);
            for (const t of ticketChunk) {
                const st = (t as { status?: string }).status;
                if (st === 'ok') {
                    ticketStatus = 'ok';
                    ticketId = (t as { id?: string }).id ?? null;
                } else if (st === 'error') {
                    ticketStatus = 'error';
                    ticketError = (t as { message?: string }).message ?? 'Expo ticket error';
                    const errCode = (t as { details?: { error?: string } }).details?.error;
                    if (errCode) ticketError = `${ticketError} (${errCode})`;
                }
            }
        }

        res.json({
            ...baseReport,
            success: ticketStatus === 'ok',
            pushAttempted: true,
            ticketStatus,
            ticketId,
            ticketError,
            tickets: allTickets,
            outboundMessage: message,
            message:
                ticketStatus === 'ok'
                    ? 'Push ticket ok — check device'
                    : ticketError ?? 'Push failed',
        });
    } catch (error: any) {
        logger.error('Push debug error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/admin/test-notification
 * Send a test push notification to a specific user (by username or userId)
 * Developer/Admin only
 */
router.post('/test-notification', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, title, body } = req.body;

        if (!username) {
            sendError(req, res, ErrorCode.VALIDATION, 'username is required');
            return;
        }

        // Find user
        const user = await prisma.user.findFirst({
            where: { username },
            select: { id: true, username: true, expoPushToken: true, pushNotificationsConsent: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, `User "${username}" not found`);
            return;
        }

        if (!user.expoPushToken) {
            sendError(req, res, ErrorCode.VALIDATION, `User "${username}" has no push token registered. Make sure the app is installed and opened on a physical device.`);
            return;
        }

        const notifTitle = title || '🔔 إشعار تجريبي';
        const notifBody = body || 'الإشعارات تعمل بشكل صحيح على جهازك ✅';

        const notification = await NotificationService.createNotification({
            userId: user.id,
            title: notifTitle,
            message: notifBody,
            type: 'GENERAL',
            pushToken: user.expoPushToken,
            data: { type: 'TEST', test: true },
        });

        logger.info(`✅ Test notification sent to user: ${username} (token: ${user.expoPushToken.substring(0, 30)}...)`);

        res.json({
            status: 'SUCCESS',
            message: `Test notification sent to ${username}`,
            data: {
                notificationId: notification?.id,
                pushToken: user.expoPushToken.substring(0, 30) + '...',
                hasConsent: user.pushNotificationsConsent,
            },
        });
    } catch (error: any) {
        logger.error('Test notification error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/admin/push-audit
 * Push token stats (x-internal-key = CLERK_SECRET_KEY)
 */
router.get('/push-audit', async (req: Request, res: Response): Promise<void> => {
    try {
        const internalKey = req.headers['x-internal-key'] as string;
        const clerkSecretKey = process.env.CLERK_SECRET_KEY;
        if (!internalKey || !clerkSecretKey || internalKey !== clerkSecretKey) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const totalUsers = await prisma.user.count({ where: { isDeleted: false } });
        const withToken = await prisma.user.count({
            where: { isDeleted: false, expoPushToken: { not: null } },
        });
        const withTokenAndConsent = await prisma.user.count({
            where: {
                isDeleted: false,
                expoPushToken: { not: null },
                pushNotificationsConsent: true,
            },
        });
        const consentNoToken = await prisma.user.count({
            where: {
                isDeleted: false,
                pushNotificationsConsent: true,
                OR: [{ expoPushToken: null }, { expoPushToken: '' }],
            },
        });
        const tokenNoConsent = await prisma.user.count({
            where: {
                isDeleted: false,
                expoPushToken: { not: null },
                pushNotificationsConsent: false,
            },
        });

        const formatRows = await prisma.$queryRaw<Array<{ fmt: string; cnt: bigint }>>`
            SELECT
                CASE
                    WHEN "expoPushToken" IS NULL OR "expoPushToken" = '' THEN 'empty'
                    WHEN "expoPushToken" LIKE 'ExponentPushToken[%' THEN 'ExponentPushToken[...]'
                    WHEN "expoPushToken" LIKE 'ExpoPushToken[%' THEN 'ExpoPushToken[...]'
                    ELSE 'other_format'
                END AS fmt,
                COUNT(*)::bigint AS cnt
            FROM users
            WHERE "isDeleted" = false
            GROUP BY 1
            ORDER BY cnt DESC
        `;

        const sample = await prisma.user.findMany({
            where: { isDeleted: false, expoPushToken: { not: null } },
            select: {
                username: true,
                expoPushToken: true,
                pushNotificationsConsent: true,
                clerkUserId: true,
                updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
        });

        const recentNotifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: { id: true, type: true, createdAt: true },
        });

        res.json({
            status: 'SUCCESS',
            data: {
                counts: {
                    totalUsers,
                    expoPushTokenNotNull: withToken,
                    tokenAndConsentTrue: withTokenAndConsent,
                    consentTrueNoToken: consentNoToken,
                    tokenNoConsent: tokenNoConsent,
                },
                tokenFormats: formatRows.map((r) => ({ format: r.fmt, count: Number(r.cnt) })),
                sampleUsersWithToken: sample,
                recentNotifications: {
                    count: recentNotifications.length,
                    note: 'Inbox rows only — Expo ticket/receipt results are NOT persisted in DB.',
                    byType: recentNotifications.reduce<Record<string, number>>((acc, n) => {
                        acc[n.type] = (acc[n.type] || 0) + 1;
                        return acc;
                    }, {}),
                },
            },
        });
    } catch (error: any) {
        logger.error('Push audit error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * POST /api/admin/send-test-push
 * Send a test push notification using Clerk Secret Key as auth (no JWT needed)
 * Used for quick testing from terminal.
 * Set rawExpo: true in body to return full Expo ticket + receipt JSON (waits ~15s).
 */
router.post('/send-test-push', async (req: Request, res: Response): Promise<void> => {
    try {
        // Auth via Clerk Secret Key in header
        const internalKey = req.headers['x-internal-key'] as string;
        const clerkSecretKey = process.env.CLERK_SECRET_KEY;

        if (!internalKey || !clerkSecretKey || internalKey !== clerkSecretKey) {
            sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
            return;
        }

        const { username, clerkUserId, title, body, rawExpo } = req.body;

        if (!username && !clerkUserId) {
            sendError(req, res, ErrorCode.VALIDATION, 'username or clerkUserId is required');
            return;
        }

        const user = await prisma.user.findFirst({
            where: clerkUserId ? { clerkUserId } : { username },
            select: { id: true, username: true, expoPushToken: true, pushNotificationsConsent: true },
        });

        if (!user) {
            sendError(req, res, ErrorCode.NOT_FOUND, `User not found`);
            return;
        }

        if (!user.expoPushToken) {
            sendError(req, res, ErrorCode.VALIDATION, `No push token for "${user.username}". Open the app on a physical device first.`, { data: { username: user.username, clerkUserId, hasPushToken: false, pushNotificationsConsent: user.pushNotificationsConsent } });
            return;
        }

        const notifTitle = title || '🔔 إشعار تجريبي';
        const notifBody = body || 'الإشعارات تعمل بشكل صحيح ✅';

        if (rawExpo) {
            const { Expo } = await import('expo-server-sdk');
            const expo = new Expo();
            const token = user.expoPushToken;
            const message: ExpoPushMessage = {
                to: token,
                sound: 'default',
                title: notifTitle,
                body: notifBody,
                data: { type: 'TEST', source: 'admin/send-test-push', rawExpo: true },
                priority: 'high',
                channelId: 'general',
            };
            const chunks = expo.chunkPushNotifications([message]);
            const allTickets: unknown[] = [];
            const receiptIds: string[] = [];
            for (const chunk of chunks) {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                allTickets.push(...ticketChunk);
                for (const t of ticketChunk) {
                    if ((t as { status?: string }).status === 'ok' && (t as { id?: string }).id) {
                        receiptIds.push((t as { id: string }).id);
                    }
                }
            }
            let receipts: Record<string, unknown> = {};
            if (receiptIds.length > 0) {
                await new Promise((r) => setTimeout(r, 15_000));
                const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
                for (const rc of receiptChunks) {
                    const part = await expo.getPushNotificationReceiptsAsync(rc);
                    receipts = { ...receipts, ...part };
                }
            }
            res.json({
                status: 'SUCCESS',
                data: {
                    username: user.username,
                    pushNotificationsConsent: user.pushNotificationsConsent,
                    expoPushToken: token,
                    ticketResponse: allTickets,
                    receiptResponse: receipts,
                },
            });
            return;
        }

        const notification = await NotificationService.createNotification({
            userId: user.id,
            title: notifTitle,
            message: notifBody,
            type: 'GENERAL',
            pushToken: user.expoPushToken,
            data: { type: 'TEST', test: true },
        });

        logger.info(`✅ Test push sent to: ${username}`);

        res.json({
            status: 'SUCCESS',
            message: `Push notification sent to ${username}`,
            data: {
                notificationId: notification?.id,
                pushTokenPreview: user.expoPushToken.substring(0, 35) + '...',
                hasConsent: user.pushNotificationsConsent,
            },
        });
    } catch (error: any) {
        logger.error('Send test push error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

/**
 * GET /api/admin/uploads/stats  (Fix 12)
 * Upload analytics for last 7 days
 */
router.get('/uploads/stats', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const stats = await UploadAnalyticsService.getStats(days);
        res.json({ status: 'SUCCESS', data: stats });
    } catch (error: any) {
        logger.error('Upload stats error:', error);
        sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
    }
});

export default router;

