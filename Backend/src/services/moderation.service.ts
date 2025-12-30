import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { StrikeService, StrikeType } from './strike.service';
import { NotificationService } from './notification.service';
import { ReportPriority } from '@prisma/client';

const CONTENT_AUTO_DELETE_THRESHOLD = 5;
const USER_SUSPENSION_THRESHOLD = 10;
const ADMIN_ALERT_THRESHOLD = 8; // Alert admins when user reaches 8 strikes (before suspension)

/**
 * Check if a report is a duplicate (same user reporting same content within 24 hours)
 */
export async function checkDuplicateReport(params: {
    reporterId: string;
    reportedReelId?: string;
    reportedCommentId?: string;
}): Promise<boolean> {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const existingReport = await prisma.report.findFirst({
            where: {
                reporterId: params.reporterId,
                reportedReelId: params.reportedReelId || null,
                reportedCommentId: params.reportedCommentId || null,
                createdAt: {
                    gte: twentyFourHoursAgo,
                },
            },
        });

        return !!existingReport;
    } catch (error) {
        logger.error('Error checking duplicate report:', error);
        return false;
    }
}

/**
 * Calculate report priority based on various factors
 */
export async function calculateReportPriority(params: {
    reportType: string;
    reportedReelId?: string;
    reportedCommentId?: string;
    reportedUserId?: string;
}): Promise<ReportPriority> {
    try {
        let priority: ReportPriority = 'MEDIUM';

        // High priority report types
        if (params.reportType === 'HARASSMENT' || params.reportType === 'COPYRIGHT') {
            priority = 'HIGH';
        }

        // Check number of reports on same content
        const reportCount = await prisma.report.count({
            where: {
                reportedReelId: params.reportedReelId || undefined,
                reportedCommentId: params.reportedCommentId || undefined,
                status: { not: 'REJECTED' },
            },
        });

        if (reportCount >= 3) {
            priority = 'HIGH';
        }
        if (reportCount >= 5) {
            priority = 'CRITICAL';
        }

        // Check if reported user has strikes (higher priority)
        if (params.reportedUserId) {
            const userStrikeCount = await StrikeService.getUserStrikeCount(params.reportedUserId);
            if (userStrikeCount >= 3) {
                priority = priority === 'MEDIUM' ? 'HIGH' : 'CRITICAL';
            }
        }

        return priority;
    } catch (error) {
        logger.error('Error calculating report priority:', error);
        return 'MEDIUM';
    }
}

/**
 * Auto-delete content (reel or comment)
 */
export async function autoDeleteContent(
    contentId: string,
    contentType: 'reel' | 'comment',
    reason: string
) {
    try {
        if (contentType === 'reel') {
            const reel = await prisma.reel.findUnique({
                where: { id: contentId },
                select: { id: true, userId: true },
            });

            if (!reel || reel.isDeleted) {
                return;
            }

            await prisma.reel.update({
                where: { id: contentId },
                data: {
                    isDeleted: true,
                    deletedAt: new Date(),
                },
            });

            // Notify content owner
            await NotificationService.createNotification({
                userId: reel.userId,
                title: 'تم حذف المحتوى',
                message: `تم حذف فيديوك تلقائياً بسبب: ${reason}`,
                type: 'GENERAL',
                data: {
                    reelId: contentId,
                    reason,
                    action: 'AUTO_DELETE',
                },
            });

            logger.info(`Auto-deleted reel: ${contentId}`);
        } else {
            const comment = await prisma.comment.findUnique({
                where: { id: contentId },
                select: { id: true, userId: true },
            });

            if (!comment || comment.isDeleted) {
                return;
            }

            await prisma.comment.update({
                where: { id: contentId },
                data: {
                    isDeleted: true,
                    deletedAt: new Date(),
                },
            });

            // Log audit
            const { AuditService, AuditTargetType } = await import('./audit.service');
            await AuditService.logContentDeleted(contentId, AuditTargetType.COMMENT, 'SYSTEM', reason);

            // Notify comment owner
            await NotificationService.createNotification({
                userId: comment.userId,
                title: 'تم حذف التعليق',
                message: `تم حذف تعليقك تلقائياً بسبب: ${reason}`,
                type: 'GENERAL',
                data: {
                    commentId: contentId,
                    reason,
                    action: 'AUTO_DELETE',
                },
            });

            logger.info(`Auto-deleted comment: ${contentId}`);
        }
    } catch (error) {
        logger.error('Error auto-deleting content:', error);
        throw error;
    }
}

/**
 * Suspend a user
 */
export async function suspendUser(userId: string, reason: string, durationDays: number = 7) {
    try {
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + durationDays);

        await prisma.user.update({
            where: { id: userId },
            data: {
                isSuspended: true,
                suspendedUntil,
            },
        });

        // Notify user
        await NotificationService.createNotification({
            userId,
            title: 'تم تعليق حسابك',
            message: `تم تعليق حسابك حتى ${suspendedUntil.toLocaleDateString('ar-EG')}. السبب: ${reason}`,
            type: 'GENERAL',
            data: {
                reason,
                suspendedUntil: suspendedUntil.toISOString(),
                action: 'SUSPENSION',
            },
        });

        logger.info(`User suspended: ${userId} until ${suspendedUntil.toISOString()}`);
    } catch (error) {
        logger.error('Error suspending user:', error);
        throw error;
    }
}

/**
 * Process a report: create strike, check thresholds, take actions
 */
export async function processReport(reportId: string) {
    try {
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                reportedUser: true,
                reportedReel: true,
                reportedComment: true,
            },
        });

        if (!report || report.status !== 'PENDING') {
            return;
        }

        // Determine target user
        const targetUserId =
            report.reportedUserId ||
            report.reportedReel?.userId ||
            report.reportedComment?.userId;

        if (!targetUserId) {
            logger.warn(`Report ${reportId} has no target user`);
            return;
        }

        // Map report type to strike type
        const strikeType = StrikeService.mapReportTypeToStrikeType(report.type);

        // Create strike
        const strike = await StrikeService.addStrike({
            userId: targetUserId,
            reportId: report.id,
            reportedReelId: report.reportedReelId || undefined,
            reportedCommentId: report.reportedCommentId || undefined,
            strikeType,
            reason: report.reason,
        });

        // Log strike creation
        const { AuditService } = await import('./audit.service');
        await AuditService.logStrikeCreated(strike.id, report.id, targetUserId);

        // Check thresholds
        const contentType = report.reportedReelId ? 'reel' : report.reportedCommentId ? 'comment' : undefined;
        const contentId = report.reportedReelId || report.reportedCommentId || undefined;

        const thresholds = await StrikeService.checkThresholds(
            targetUserId,
            contentId,
            contentType as 'reel' | 'comment'
        );

        // Auto-delete content if threshold reached
        if (thresholds.contentThresholdReached && contentId && contentType) {
            await autoDeleteContent(contentId, contentType, report.reason);
        }

        // Suspend user if threshold reached
        if (thresholds.userThresholdReached) {
            await suspendUser(targetUserId, `وصلت إلى ${thresholds.userStrikeCount} تحذيرات`);
        }

        // Alert admins if user is approaching suspension threshold
        if (thresholds.userStrikeCount >= ADMIN_ALERT_THRESHOLD && thresholds.userStrikeCount < USER_SUSPENSION_THRESHOLD) {
            const { AdminNotificationService } = await import('./admin-notification.service');
            await AdminNotificationService.alertUserStrikeThreshold(targetUserId, thresholds.userStrikeCount);
        }

        return {
            strike,
            thresholds,
        };
    } catch (error) {
        logger.error('Error processing report:', error);
        throw error;
    }
}

