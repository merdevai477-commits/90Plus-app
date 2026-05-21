/**
 * Prediction Ticket Renewal Notifier
 *
 * Sends a daily push notification to users when their prediction tickets reset.
 * Tickets reset at midnight UTC — this service runs at 8 AM local time
 * (timezone-aware, same pattern as lucky-wheel-notifier).
 *
 * Only notifies users who:
 *  - Have push consent + token
 *  - Have the `predictionResults` preference enabled
 *  - Are not banned/deleted
 *  - Haven't already used all tickets today (meaning they're likely interested)
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import PushNotificationService from './push-notification.service';
import {
    renderPushTemplate,
    readLanguageFromSettings,
} from './push-templates.service';

const DAILY_PREDICTION_LIMIT = 10;
const BATCH_SIZE = 100;

/**
 * Find users who should be notified about ticket renewal.
 * Criteria: have push token, consent, not banned, and used at least 1 prediction yesterday.
 */
async function getEligibleUsers(): Promise<Array<{ id: string; expoPushToken: string; settings: unknown }>> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    // Users who made at least one prediction yesterday (they'll care about renewal)
    const usersWithPredictions = await prisma.prediction.findMany({
        where: {
            createdAt: { gte: yesterday, lte: endOfYesterday },
        },
        select: { userId: true },
        distinct: ['userId'],
    });

    if (usersWithPredictions.length === 0) return [];

    const userIds = usersWithPredictions.map(p => p.userId);

    // Filter to those with push tokens and consent
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

    // Filter out users who opted out of prediction notifications
    const optedOut = await (prisma as any).notificationPreferences.findMany({
        where: {
            userId: { in: users.map(u => u.id) },
            predictionResults: false,
        },
        select: { userId: true },
    });
    const optedOutIds = new Set(optedOut.map((p: { userId: string }) => p.userId));

    return users
        .filter(u => !optedOutIds.has(u.id) && u.expoPushToken)
        .map(u => ({ id: u.id, expoPushToken: u.expoPushToken!, settings: u.settings }));
}

/**
 * Send prediction ticket renewal notifications in batches.
 */
async function runPredictionTicketNotifier(): Promise<void> {
    try {
        const users = await getEligibleUsers();

        if (users.length === 0) {
            logger.debug('[PredictionTickets] No eligible users to notify');
            return;
        }

        logger.info(`[PredictionTickets] Sending renewal notification to ${users.length} users`);

        let sent = 0;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const payloads = batch.map(u => {
                const lang = readLanguageFromSettings(u.settings);
                return {
                    to: u.expoPushToken,
                    title: renderPushTemplate('predictionTicketRenewalTitle', lang),
                    body: renderPushTemplate('predictionTicketRenewalBody', lang, {
                        count: DAILY_PREDICTION_LIMIT,
                    }),
                    data: { type: 'PREDICTION_TICKET_RENEWAL', screen: '/(tabs)/matches' },
                    channelId: 'general',
                };
            });

            const result = await PushNotificationService.sendBulkNotifications(payloads);
            sent += result.success;
        }

        logger.info(`[PredictionTickets] ✅ Sent ${sent}/${users.length} ticket renewal notifications`);
    } catch (error) {
        logger.error('[PredictionTickets] ❌ Notifier error:', error);
    }
}

/**
 * Register the prediction ticket renewal cron job.
 * Runs daily at 06:00 UTC (8 AM Egypt time).
 */
export function startPredictionTicketNotifier(): void {
    cron.schedule('0 6 * * *', () => {
        logger.info('⏰ Cron: Prediction ticket renewal notification...');
        runPredictionTicketNotifier().catch(err => {
            logger.error('Prediction ticket notifier cron error:', err);
        });
    });

    logger.info('✅ Prediction ticket notifier cron scheduled (daily at 06:00 UTC / 8 AM Egypt)');
}
