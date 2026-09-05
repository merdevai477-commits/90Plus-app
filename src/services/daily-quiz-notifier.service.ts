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
import { notifyUsers } from './notify.service';
import { NotificationType } from './notification.service';
import { type PushTemplateKey } from './push-templates.service';

const BATCH_SIZE = 100;

/** ISO date (YYYY-MM-DD) used to dedupe idempotency keys per day. */
function isoDateUTC(): string {
    return new Date().toISOString().slice(0, 10);
}

export const QUIZ_ATTEMPT_ACTIVE_WINDOW_DAYS = 7;

/** QuizAttempt has `completedAt`, not `createdAt` (BACKEND-2V). */
export function quizAttemptActiveSinceWhere(since: Date) {
    return { completedAt: { gte: since } };
}

/**
 * Distinct user ids with a completed quiz attempt in the active window.
 * Throws on Prisma/schema errors so the cron cannot swallow them as "nobody to notify".
 */
export async function findRecentQuizAttemptUserIds(since: Date): Promise<string[]> {
    try {
        const recentQuizUsers = await prisma.quizAttempt.findMany({
            where: quizAttemptActiveSinceWhere(since),
            select: { userId: true },
            distinct: ['userId'],
        });
        return recentQuizUsers.map((q) => q.userId);
    } catch (error) {
        logger.error('[DailyQuiz] QuizAttempt lookup failed (will not skip notifications silently):', error);
        throw error;
    }
}

/**
 * Find users who should be notified about the new daily quiz.
 * Targets users who:
 *  - Have push consent + token
 *  - Participated in at least one quiz in the last 7 days (active quiz users)
 *  - Are not banned/deleted
 */
export async function getEligibleQuizUsers(): Promise<Array<{ id: string; expoPushToken: string; settings: unknown }>> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - QUIZ_ATTEMPT_ACTIVE_WINDOW_DAYS);

    const userIds = await findRecentQuizAttemptUserIds(sevenDaysAgo);

    if (userIds.length === 0) return [];

    const users = await prisma.user.findMany({
        where: {
            id: { in: userIds },
            expoPushToken: { not: null },
            pushNotificationsConsent: true,
            isDeleted: false,
            isBanned: false,
        },
        select: { id: true, expoPushToken: true, settings: true },
    });

    return users
        .filter(u => u.expoPushToken)
        .map(u => ({ id: u.id, expoPushToken: u.expoPushToken!, settings: u.settings }));
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

        logger.info(`[DailyQuiz] Dispatching quiz renewal notifications to ${users.length} users`);

        // Pick a variant per run for cohesion. The variant's title/body keys
        // are localized per-user inside notifyUser based on user.settings.language.
        const variants: Array<{ title: PushTemplateKey; body: PushTemplateKey }> = [
            { title: 'dailyQuizRenewedTitle', body: 'dailyQuizRenewedBody' },
            { title: 'dailyQuizReadyTitle', body: 'dailyQuizReadyBody' },
            { title: 'dailyQuizTimeTitle', body: 'dailyQuizTimeBody' },
            { title: 'dailyQuizChallengeTitle', body: 'dailyQuizChallengeBody' },
        ];
        const variant = variants[Math.floor(Math.random() * variants.length)];

        const today = isoDateUTC();
        const payloads = users.map((u) => ({
            userId: u.id,
            type: NotificationType.DAILY_QUIZ_RENEWED,
            titleKey: variant.title,
            bodyKey: variant.body,
            data: { screen: '/(tabs)/quiz' },
            // One push + one inbox row per user per day.
            idempotencyKey: `daily-quiz-renewed:${u.id}:${today}`,
        }));

        const result = await notifyUsers(payloads, { concurrency: BATCH_SIZE / 4 });
        logger.info(
            `[DailyQuiz] ✅ Sent ${result.delivered}/${users.length} renewal notifications ` +
            `(suppressed=${result.suppressed}, failed=${result.failed})`,
        );
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
