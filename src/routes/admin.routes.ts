import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/admin.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { StrikeService } from '../services/strike.service';
import { AuditService, AuditAction, AuditTargetType } from '../services/audit.service';
import { AdminNotificationService } from '../services/admin-notification.service';
import { suspendUser, autoDeleteContent } from '../services/moderation.service';
import { NotificationService } from '../services/notification.service';

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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(404).json({ status: 'ERROR', message: 'Report not found' });
            return;
        }

        res.json({
            status: 'SUCCESS',
            data: { report },
        });
    } catch (error: any) {
        logger.error('Get report details error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(400).json({ status: 'ERROR', message: 'Invalid action' });
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
            res.status(404).json({ status: 'ERROR', message: 'Report not found' });
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

        res.json({
            status: 'SUCCESS',
            message: 'Report reviewed successfully',
        });
    } catch (error: any) {
        logger.error('Review report error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(400).json({ status: 'ERROR', message: 'Reason is required' });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(404).json({
                status: 'ERROR',
                message: `User with username "${username}" not found`,
            });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
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
            res.status(400).json({ status: 'ERROR', message: 'username is required' });
            return;
        }

        // Find user
        const user = await prisma.user.findFirst({
            where: { username },
            select: { id: true, username: true, expoPushToken: true, pushNotificationsConsent: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: `User "${username}" not found` });
            return;
        }

        if (!user.expoPushToken) {
            res.status(400).json({
                status: 'ERROR',
                message: `User "${username}" has no push token registered. Make sure the app is installed and opened on a physical device.`,
            });
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
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

export default router;

