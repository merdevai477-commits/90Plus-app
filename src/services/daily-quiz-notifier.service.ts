/**
 * Daily Quiz Renewal Notifier
 *
 * Sends a push when the daily pack for "today" (UTC) is ready. Cron: 07:00 UTC
 * (09:00 Egypt / 10:00 Saudi) — same calendar day as UTC for the MENA audience.
 *
 * Eligibility (inferred from the original feature, not the dead QuizAttempt table):
 *  - File header: notify people who recently played the daily quiz.
 *  - Original query: 7-day "active" window, not a single yesterday-only cut.
 *  - Copy: "new quiz is live / waiting" — skip anyone who already finished
 *    today's pack.
 *  - UserDailyQuizSession rows are created on open/prefetch with answeredCount 0,
 *    so opening the Quiz tab is NOT participation. Require answeredCount > 0
 *    or completedAt.
 *
 * QuizAttempt is unused for the live daily quiz (no creates, zero production
 * rows). Do not point this cron at that model.
 */

import cron from 'node-cron';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { notifyUsers } from './notify.service';
import { NotificationType } from './notification.service';
import { type PushTemplateKey } from './push-templates.service';

const BATCH_SIZE = 100;

/** Rolling packDate window, matching the original 7-day active-user heuristic. */
export const QUIZ_SESSION_ACTIVE_WINDOW_DAYS = 7;

/** ISO date (YYYY-MM-DD) used to dedupe idempotency keys per day. */
function isoDateUTC(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

export function utcCalendarDate(now: Date): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addUtcCalendarDays(date: Date, days: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function quizNotifierWindow(now: Date = new Date()): {
    today: Date;
    yesterday: Date;
    windowStart: Date;
} {
    const today = utcCalendarDate(now);
    return {
        today,
        yesterday: addUtcCalendarDays(today, -1),
        windowStart: addUtcCalendarDays(today, -QUIZ_SESSION_ACTIVE_WINDOW_DAYS),
    };
}

/**
 * Prisma `where` for UserDailyQuizSession: played a pack in the last 7 UTC
 * pack days (excluding today), and has not already completed today's pack.
 */
export function dailyQuizSessionEligibilityWhere(
    now: Date = new Date(),
): Prisma.UserDailyQuizSessionWhereInput {
    const { today, yesterday, windowStart } = quizNotifierWindow(now);
    return {
        packDate: { gte: windowStart, lte: yesterday },
        OR: [
            { completedAt: { not: null } },
            { answeredCount: { gt: 0 } },
        ],
        user: {
            dailyQuizSessions: {
                none: {
                    packDate: today,
                    completedAt: { not: null },
                },
            },
        },
    };
}

/**
 * Distinct user ids who should get the "new daily quiz" ping.
 * Throws on Prisma/schema errors so the cron cannot swallow them as "nobody to notify".
 */
/** Pure eligibility check for unit fixtures — keep in lockstep with `dailyQuizSessionEligibilityWhere`. */
export function sessionQualifiesForDailyQuizPing(
    session: {
        packDate: Date;
        completedAt: Date | null;
        answeredCount: number;
    },
    options: { now?: Date; alreadyCompletedToday: boolean },
): boolean {
    if (options.alreadyCompletedToday) return false;
    const { yesterday, windowStart } = quizNotifierWindow(options.now ?? new Date());
    const pack = utcCalendarDate(session.packDate);
    if (pack < windowStart || pack > yesterday) return false;
    return session.completedAt != null || session.answeredCount > 0;
}

export async function findRecentDailyQuizUserIds(now: Date = new Date()): Promise<string[]> {
    try {
        const rows = await prisma.userDailyQuizSession.findMany({
            where: dailyQuizSessionEligibilityWhere(now),
            select: { userId: true },
            distinct: ['userId'],
        });
        return rows.map((row) => row.userId);
    } catch (error) {
        logger.error(
            '[DailyQuiz] UserDailyQuizSession lookup failed (will not skip notifications silently):',
            error,
        );
        throw error;
    }
}

/**
 * Find users who should be notified about the new daily quiz.
 * Targets users who:
 *  - Played a daily pack in the last 7 UTC pack days (answered or completed)
 *  - Have not already completed today's pack
 *  - Have push consent + token
 *  - Are not banned/deleted
 *
 * Preference gating (`NotificationPreferences.dailyQuiz`) is applied later
 * inside notifyUsers — not duplicated here.
 */
export async function getEligibleQuizUsers(
    now: Date = new Date(),
): Promise<Array<{ id: string; expoPushToken: string; settings: unknown }>> {
    const userIds = await findRecentDailyQuizUserIds(now);

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
        .filter((u) => u.expoPushToken)
        .map((u) => ({ id: u.id, expoPushToken: u.expoPushToken!, settings: u.settings }));
}

export type DailyQuizNotifierResult = {
    eligible: number;
    dryRun: boolean;
    delivered?: number;
    suppressed?: number;
    failed?: number;
};

/**
 * Send daily quiz renewal notifications.
 * `dryRun` identifies candidates and returns without calling Expo/inbox.
 */
export async function runDailyQuizNotifier(options?: {
    dryRun?: boolean;
    now?: Date;
}): Promise<DailyQuizNotifierResult> {
    const now = options?.now ?? new Date();
    const dryRun = options?.dryRun === true;

    try {
        const users = await getEligibleQuizUsers(now);

        if (users.length === 0) {
            logger.info('[DailyQuiz] No eligible users to notify');
            return { eligible: 0, dryRun };
        }

        if (dryRun) {
            logger.info(`[DailyQuiz] dry-run: ${users.length} eligible user(s), no push sent`);
            return { eligible: users.length, dryRun: true };
        }

        logger.info(`[DailyQuiz] Dispatching quiz renewal notifications to ${users.length} users`);

        const variants: Array<{ title: PushTemplateKey; body: PushTemplateKey }> = [
            { title: 'dailyQuizRenewedTitle', body: 'dailyQuizRenewedBody' },
            { title: 'dailyQuizReadyTitle', body: 'dailyQuizReadyBody' },
            { title: 'dailyQuizTimeTitle', body: 'dailyQuizTimeBody' },
            { title: 'dailyQuizChallengeTitle', body: 'dailyQuizChallengeBody' },
        ];
        const variant = variants[Math.floor(Math.random() * variants.length)];

        const today = isoDateUTC(now);
        const payloads = users.map((u) => ({
            userId: u.id,
            type: NotificationType.DAILY_QUIZ_RENEWED,
            titleKey: variant.title,
            bodyKey: variant.body,
            data: { screen: '/(tabs)/quiz' },
            idempotencyKey: `daily-quiz-renewed:${u.id}:${today}`,
        }));

        const result = await notifyUsers(payloads, { concurrency: BATCH_SIZE / 4 });
        logger.info(
            `[DailyQuiz] ✅ Sent ${result.delivered}/${users.length} renewal notifications ` +
            `(suppressed=${result.suppressed}, failed=${result.failed})`,
        );
        return {
            eligible: users.length,
            dryRun: false,
            delivered: result.delivered,
            suppressed: result.suppressed,
            failed: result.failed,
        };
    } catch (error) {
        logger.error('[DailyQuiz] ❌ Notifier error:', error);
        throw error;
    }
}

/**
 * Register the daily quiz renewal cron job.
 * Runs daily at 07:00 UTC (9 AM Egypt, 10 AM Saudi).
 */
export function startDailyQuizNotifier(): void {
    cron.schedule('0 7 * * *', () => {
        logger.info('⏰ Cron: Daily quiz renewal notification...');
        runDailyQuizNotifier().catch((err) => {
            logger.error('Daily quiz notifier cron error:', err);
        });
    });

    logger.info('✅ Daily quiz notifier cron scheduled (daily at 07:00 UTC / 9 AM Egypt)');
}
