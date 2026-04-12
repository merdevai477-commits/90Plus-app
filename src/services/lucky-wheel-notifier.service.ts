import Bull, { Queue } from 'bull';
import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import PushNotificationService from './push-notification.service';

const BATCH_SIZE = 100;
const REDIS_DEDUP_KEY_PREFIX = 'lucky-wheel-notified:';

interface LuckyWheelBatchJob {
    userIds: string[];
    date: string; // YYYY-MM-DD
}

let luckyWheelQueue: Queue<LuckyWheelBatchJob> | null = null;

function getLuckyWheelQueue(): Queue<LuckyWheelBatchJob> | null {
    if (luckyWheelQueue) return luckyWheelQueue;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('⚠️ REDIS_URL not set - lucky wheel notifier queue disabled');
        return null;
    }

    luckyWheelQueue = new Bull<LuckyWheelBatchJob>('lucky-wheel-notifications', { redis: redisUrl });

    luckyWheelQueue.process(async (job) => {
        const { userIds, date } = job.data;
        logger.info(`🎡 Processing lucky wheel batch: ${userIds.length} users for ${date}`);

        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
                expoPushToken: { not: null },
                pushNotificationsConsent: true,
            },
            select: { id: true, expoPushToken: true },
        });

        const payloads = users
            .filter(u => u.expoPushToken)
            .map(u => ({
                to: u.expoPushToken!,
                title: '🎡 عجلة الحظ جاهزة!',
                body: 'حظك النهارده ينتظرك، العب دلوقتي!',
                data: { type: 'LUCKY_WHEEL', screen: '/notifications' },
            }));

        if (payloads.length > 0) {
            const result = await PushNotificationService.sendBulkNotifications(payloads);
            logger.info(`🎡 Lucky wheel batch sent: ${result.success} success, ${result.failed} failed`);
        }
    });

    luckyWheelQueue.on('failed', (job, err) => {
        logger.error(`Lucky wheel job ${job.id} failed:`, err.message);
    });

    luckyWheelQueue.on('error', (err) => {
        logger.warn('Lucky wheel queue error:', err);
    });

    return luckyWheelQueue;
}

/**
 * Run the daily lucky wheel notification job.
 * Queries eligible users and batches them into Bull jobs.
 */
async function runDailyLuckyWheelNotifier(): Promise<void> {
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const redisKey = `${REDIS_DEDUP_KEY_PREFIX}${dateKey}`;

    try {
        // Check Redis dedup to prevent double-send on same day
        const { getRedisClient } = await import('../lib/redis');
        const redis = getRedisClient();
        if (redis) {
            const alreadyRan = await redis.get(redisKey);
            if (alreadyRan) {
                logger.info(`🎡 Lucky wheel notifier already ran today (${dateKey}), skipping`);
                return;
            }
        }

        logger.info(`🎡 Starting daily lucky wheel notifier for ${dateKey}`);

        // Start of today in Cairo time (UTC+2 / UTC+3 DST)
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);

        // Find eligible users:
        // - pushNotificationsConsent = true
        // - expoPushToken not null
        // - notificationPreferences.luckyWheel = true (or no prefs = default true)
        // - lastDailySpin < today (wheel available)
        const eligibleUsers = await prisma.user.findMany({
            where: {
                pushNotificationsConsent: true,
                expoPushToken: { not: null },
                isDeleted: false,
                isBanned: false,
                isSuspended: false,
                OR: [
                    { lastDailySpin: null },
                    { lastDailySpin: { lt: startOfToday } },
                ],
            },
            select: { id: true },
        });

        // Filter by luckyWheel preference (post-query to avoid Prisma type issues)
        const prefs = await (prisma as any).notificationPreferences.findMany({
            where: { userId: { in: eligibleUsers.map((u: { id: string }) => u.id), }, luckyWheel: false },
            select: { userId: true },
        });
        const optedOutIds = new Set(prefs.map((p: { userId: string }) => p.userId));
        const filteredUsers = eligibleUsers.filter((u: { id: string }) => !optedOutIds.has(u.id));

        if (filteredUsers.length === 0) {
            logger.info('🎡 No eligible users for lucky wheel notification');
            return;
        }

        logger.info(`🎡 Found ${filteredUsers.length} eligible users`);

        const q = getLuckyWheelQueue();
        const userIds = filteredUsers.map((u: { id: string }) => u.id);

        // Batch into groups of BATCH_SIZE
        for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
            const batch = userIds.slice(i, i + BATCH_SIZE);
            if (q) {
                await q.add(
                    { userIds: batch, date: dateKey },
                    {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 2000 },
                        removeOnComplete: true,
                        removeOnFail: 50,
                    }
                );
            } else {
                // Fallback: process in-process if no Redis
                const users = await prisma.user.findMany({
                    where: { id: { in: batch }, expoPushToken: { not: null } },
                    select: { id: true, expoPushToken: true },
                });
                const payloads = users.filter(u => u.expoPushToken).map(u => ({
                    to: u.expoPushToken!,
                    title: '🎡 عجلة الحظ جاهزة!',
                    body: 'حظك النهارده ينتظرك، العب دلوقتي!',
                    data: { type: 'LUCKY_WHEEL', screen: '/notifications' },
                }));
                if (payloads.length > 0) {
                    await PushNotificationService.sendBulkNotifications(payloads);
                }
            }
        }

        // Mark as ran today in Redis (TTL 25 hours)
        if (redis) {
            await redis.setex(redisKey, 25 * 60 * 60, '1');
        }

        logger.info(`🎡 Lucky wheel notifier queued ${eligibleUsers.length} users in ${Math.ceil(eligibleUsers.length / BATCH_SIZE)} batches`);
    } catch (error) {
        logger.error('❌ Lucky wheel notifier error:', error);
    }
}

/**
 * Register the daily lucky wheel cron job.
 * Runs at 09:00 Cairo time (Africa/Cairo = UTC+2 / UTC+3 DST).
 * node-cron uses server local time, so we use UTC 07:00 (UTC+2) as safe default.
 * Set TZ=Africa/Cairo in Railway env for accurate scheduling.
 */
export function startLuckyWheelNotifier(): void {
    // 09:00 Cairo = 07:00 UTC (winter) / 06:00 UTC (summer)
    // With TZ=Africa/Cairo set on server, "0 9 * * *" works correctly
    cron.schedule('0 9 * * *', () => {
        logger.info('⏰ Cron: Running daily lucky wheel notifier...');
        runDailyLuckyWheelNotifier().catch(err => {
            logger.error('Lucky wheel cron error:', err);
        });
    }, {
        timezone: 'Africa/Cairo',
    });

    logger.info('✅ Lucky wheel notifier cron scheduled (daily at 09:00 Cairo time)');
}
