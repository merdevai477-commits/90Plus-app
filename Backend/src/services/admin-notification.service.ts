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

            const title = `تنبيه إدارة: ${this.getPriorityLabel(params.priority)}`;
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
                message: `بلاغ عالي الأولوية: ${reportType} - Report ID: ${reportId}`,
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
                message: `${contentType === 'reel' ? 'فيديو' : 'تعليق'} وصل إلى ${reportCount} بلاغات - ID: ${contentId}`,
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
                message: `مستخدم وصل إلى ${strikeCount} تحذيرات - User ID: ${userId}`,
                metadata: {
                    userId,
                    strikeCount,
                },
            });
        }
    }

    /**
     * Get priority label in Arabic
     */
    private static getPriorityLabel(priority: ReportPriority): string {
        const labels: Record<ReportPriority, string> = {
            LOW: 'أولوية منخفضة',
            MEDIUM: 'أولوية متوسطة',
            HIGH: 'أولوية عالية',
            CRITICAL: 'أولوية حرجة',
        };

        return labels[priority] || priority;
    }
}

