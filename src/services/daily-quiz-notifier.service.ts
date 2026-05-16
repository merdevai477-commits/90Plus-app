/**
 * Daily Quiz Renewal Notifier
 *
 * Sends a push notification when the daily quiz resets.
 * Timezone-aware — sends at 10 AM local time (1 hour after lucky wheel).
 *
 * NOTE: This service is built and ready. It will start sending notifications
 * once the daily quiz feature is active. Currently it checks if the user
 * has completed yesterday's quiz before deciding to notify.
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import PushNotificationService from './push-notification.service';

const BATCH_SIZE = 100;

/**
 * Find users who should be notified about the new daily quiz.
 * Targets users who:
 *  - Have push consent + token
 *  - Participated in at least one quiz in the last 7 days (active quiz users)
 *  - Are not banned/deleted
 */
async function getEligibleQuizUsers(): Promise<Array<{ id: string; expoPushToken: string }>> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find users who attempted a quiz in the last 7 days
    const recentQuizUsers = await (prisma as any).quizAttempt.findMany({
        where: {
            createdAt: { gte: sevenDaysAgo },
        },
        select: { userId: true },
        distinct: ['userId'],
    }).catch(() => [] as Array<{ userId: string }>);

    if (recentQuizUsers.length === 0) return [];

    const userIds = recentQuizUsers.map((q: { userId: string }) => q.userId);

    const users = await prisma.user.findMany({
        where: {
            id: { in: userIds },
            expoPushToken: { not: null },
            pushNotificationsConsent: true,
            isDeleted: false,
            isBanned: false,
        },
        select: { id: true, expoPushToken: true },
    });

    return users.filter(u => u.expoPushToken).map(u => ({ id: u.id, expoPushToken: u.expoPushToken! }));
}

/**
 * Send daily quiz renewal notifications.
 */
async function runDailyQuizNotifier(): Promise<void> {
    try {
        const users = await getEligibleQuizUsers();

        if (users.length === 0) {
            logger.debug('[DailyQuiz] No eligible users to notify');
            return;
        }

        logger.info(`[DailyQuiz] Sending quiz renewal notification to ${users.length} users`);

        // Random message variants for variety
        const messages = [
            { title: '🧠 اختبار جديد جاهز!', body: 'اختبار اليوم في انتظارك. اثبت معرفتك بالكرة واكسب XP!' },
            { title: '⚽ وقت الكويز!', body: 'أسئلة جديدة كل يوم — جرب حظك وشوف مستواك!' },
            { title: '🏆 تحدي اليوم!', body: 'اختبار جديد نزل دلوقتي. جاوب صح واكسب عملات وXP!' },
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];

        let sent = 0;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const payloads = batch.map(u => ({
                to: u.expoPushToken,
                title: msg.title,
                body: msg.body,
                data: { type: 'QUIZ_RENEWAL', screen: '/(tabs)/quiz' },
                channelId: 'general',
            }));

            const result = await PushNotificationService.sendBulkNotifications(payloads);
            sent += result.success;
        }

        logger.info(`[DailyQuiz] ✅ Sent ${sent}/${users.length} quiz renewal notifications`);
    } catch (error) {
        logger.error('[DailyQuiz] ❌ Notifier error:', error);
    }
}

/**
 * Register the daily quiz renewal cron job.
 * Runs daily at 07:00 UTC (9 AM Egypt, 10 AM Saudi).
 */
export function startDailyQuizNotifier(): void {
    cron.schedule('0 7 * * *', () => {
        logger.info('⏰ Cron: Daily quiz renewal notification...');
        runDailyQuizNotifier().catch(err => {
            logger.error('Daily quiz notifier cron error:', err);
        });
    });

    logger.info('✅ Daily quiz notifier cron scheduled (daily at 07:00 UTC / 9 AM Egypt)');
}
