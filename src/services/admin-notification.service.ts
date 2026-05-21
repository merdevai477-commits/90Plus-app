import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import { ReportPriority } from '@prisma/client';

export class AdminNotificationService {
    /**
     * Get all admin users (isDeveloper = true)
     */
    static async getAdminUsers() {
        try {
            const admins = await prisma.user.findMany({
                where: { isDeveloper: true },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    expoPushToken: true,
                },
            });

            return admins;
        } catch (error) {
            logger.error('Error getting admin users:', error);
            throw error;
        }
    }

    /**
     * Alert all admins about a moderation event
     */
    static async alertAdmins(params: {
        priority: ReportPriority;
        message: string;
        reportId?: string;
        metadata?: Record<string, any>;
    }) {
        try {
            const admins = await this.getAdminUsers();

            if (admins.length === 0) {
                logger.warn('No admin users found to alert');
                return;
            }

            const title = `Moderation alert: ${this.getPriorityLabel(params.priority)}`;
            const notificationData = {
                type: 'MODERATION_ALERT',
                priority: params.priority,
                reportId: params.reportId,
                ...params.metadata,
            };

            // Send notifications to all admins
            const notificationPromises = admins.map((admin) =>
                NotificationService.createNotification({
                    userId: admin.id,
                    title,
                    message: params.message,
                    type: 'MODERATION_ALERT',
                    data: notificationData,
                    pushToken: admin.expoPushToken || null,
                })
            );

            await Promise.all(notificationPromises);

            logger.info(`Alerted ${admins.length} admins about: ${params.message}`);
        } catch (error) {
            logger.error('Error alerting admins:', error);
            // Don't throw - admin alerting failures shouldn't break the main flow
        }
    }

    /**
     * Alert admins about high-priority report
     */
    static async alertHighPriorityReport(reportId: string, priority: ReportPriority, reportType: string) {
        if (priority === 'HIGH' || priority === 'CRITICAL') {
            await this.alertAdmins({
                priority,
                message: `High priority report: ${reportType} - Report ID: ${reportId}`,
                reportId,
                metadata: {
                    reportType,
                },
            });
        }
    }

    /**
     * Alert admins about content reaching threshold (3+ reports)
     */
    static async alertContentThreshold(contentId: string, contentType: 'reel' | 'comment', reportCount: number) {
        if (reportCount >= 3) {
            await this.alertAdmins({
                priority: 'HIGH',
                message: `${contentType === 'reel' ? 'Reel' : 'Comment'} reached ${reportCount} reports - ID: ${contentId}`,
                metadata: {
                    contentId,
                    contentType,
                    reportCount,
                },
            });
        }
    }

    /**
     * Alert admins about user reaching strike threshold (8 strikes)
     */
    static async alertUserStrikeThreshold(userId: string, strikeCount: number) {
        if (strikeCount >= 8) {
            await this.alertAdmins({
                priority: 'HIGH',
                message: `User reached ${strikeCount} strikes - User ID: ${userId}`,
                metadata: {
                    userId,
                    strikeCount,
                },
            });
        }
    }

    /**
     * Alert admins about user report (Apple Guideline 1.2 requirement)
     */
    static async notifyUserReport(params: {
        reportId: string;
        reporterUsername: string;
        reportedUsername: string;
        reportType: string;
        reason: string;
    }) {
        try {
            await this.alertAdmins({
                priority: 'MEDIUM',
                message: `New user report: ${params.reportedUsername}\nReason: ${params.reason}`,
                reportId: params.reportId,
                metadata: {
                    reporterUsername: params.reporterUsername,
                    reportedUsername: params.reportedUsername,
                    reportType: params.reportType,
                    reason: params.reason,
                },
            });

            logger.info(`Admin notified about user report: ${params.reportId}`);
        } catch (error) {
            logger.error('Error notifying admins about user report:', error);
            // Don't throw - notification failures shouldn't break the main flow
        }
    }

    /**
     * Get priority label (English; admin-only audience)
     */
    private static getPriorityLabel(priority: ReportPriority): string {
        const labels: Record<ReportPriority, string> = {
            LOW: 'Low priority',
            MEDIUM: 'Medium priority',
            HIGH: 'High priority',
            CRITICAL: 'Critical priority',
        };

        return labels[priority] || priority;
    }
}

