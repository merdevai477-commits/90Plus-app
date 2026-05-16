/**
 * Cooldown Expiry Notifier Service
 *
 * Proactively notifies users when their cooldowns expire:
 *  - Avatar change cooldown (7 days)
 *  - Cover change cooldown (15 days)
 *  - Reel upload cooldown (1 day)
 *  - Username change cooldown (15 days)
 *
 * Runs every hour and checks for users whose cooldowns expired within the last hour.
 * Uses Redis dedup to prevent sending duplicate notifications.
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import PushNotificationService from './push-notification.service';

const BATCH_SIZE = 50;

// Cooldown durations (must match profile.routes.ts)
const COOLDOWNS = {
    avatar: { days: 7, field: 'lastAvatarChange' as const, title: '📸 غيّر صورتك!', body: 'الكولداون خلص — تقدر تغير صورة بروفايلك دلوقتي!' },
    cover: { days: 15, field: 'lastCoverChange' as const, title: '🖼️ غيّر الغلاف!', body: 'تقدر تغير صورة الغلاف دلوقتي. اختار صورة جديدة!' },
    reel: { days: 1, field: 'lastReelUpload' as const, title: '🎬 ارفع فيديو جديد!', body: 'تقدر ترفع فيديو جديد دلوقتي. شارك موهبتك مع الجمهور!' },
    username: { days: 15, field: 'lastUsernameChange' as const, title: '✏️ غيّر اسمك!', body: 'تقدر تغير اسم المستخدم دلوقتي.' },
};

type CooldownType = keyof typeof COOLDOWNS;

/**
 * Find users whose cooldown expired within the last hour (± 5 min buffer).
 */
async function getUsersWithExpiredCooldown(type: CooldownType): Promise<Array<{ id: string; expoPushToken: string }>> {
    const config = COOLDOWNS[type];
    const cooldownMs = config.days * 24 * 60 * 60 * 1000;
    
    // The cooldown expired within the last 65 minutes (1 hour + 5 min buffer)
    const now = Date.now();
    const expiryWindowStart = new Date(now - cooldownMs - 65 * 60 * 1000);
    const expiryWindowEnd = new Date(now - cooldownMs);

    const whereClause: any = {
        [config.field]: {
            gte: expiryWindowStart,
            lte: expiryWindowEnd,
        },
        expoPushToken: { not: null },
        pushNotificationsConsent: true,
        isDeleted: false,
        isBanned: false,
    };

    const users = await prisma.user.findMany({
        where: whereClause,
        select: { id: true, expoPushToken: true },
    });

    return users.filter(u => u.expoPushToken).map(u => ({ id: u.id, expoPushToken: u.expoPushToken! }));
}

/**
 * Send cooldown expiry notifications with Redis dedup.
 */
async function notifyCooldownExpiry(type: CooldownType): Promise<number> {
    const config = COOLDOWNS[type];
    const users = await getUsersWithExpiredCooldown(type);

    if (users.length === 0) return 0;

    // Redis dedup — prevent sending twice for the same cooldown expiry
    let redis: any = null;
    try {
        const { getRedisClient } = await import('../lib/redis');
        redis = getRedisClient();
    } catch { /* Redis not available — skip dedup */ }

    const dateKey = new Date().toISOString().split('T')[0];
    const eligibleUsers: typeof users = [];

    for (const user of users) {
        const dedupKey = `cooldown-notified:${type}:${user.id}:${dateKey}`;
        if (redis) {
            const alreadySent = await redis.get(dedupKey);
            if (alreadySent) continue;
        }
        eligibleUsers.push(user);
    }

    if (eligibleUsers.length === 0) return 0;

    let sent = 0;
    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
        const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
        const payloads = batch.map(u => ({
            to: u.expoPushToken,
            title: config.title,
            body: config.body,
            data: { type: 'COOLDOWN_EXPIRED', cooldownType: type, screen: '/(tabs)/profile' },
            channelId: 'general',
        }));

        const result = await PushNotificationService.sendBulkNotifications(payloads);
        sent += result.success;
    }

    // Mark as notified in Redis (TTL = cooldown days, so we don't notify again until next expiry)
    if (redis) {
        const pipeline = redis.pipeline();
        for (const user of eligibleUsers) {
            const dedupKey = `cooldown-notified:${type}:${user.id}:${dateKey}`;
            pipeline.setex(dedupKey, config.days * 24 * 60 * 60, '1');
        }
        await pipeline.exec();
    }

    return sent;
}

/**
 * Run all cooldown expiry checks.
 */
async function runCooldownExpiryNotifier(): Promise<void> {
    try {
        let totalSent = 0;

        for (const type of Object.keys(COOLDOWNS) as CooldownType[]) {
            const sent = await notifyCooldownExpiry(type);
            if (sent > 0) {
                logger.info(`[CooldownExpiry] Sent ${sent} ${type} cooldown expiry notifications`);
            }
            totalSent += sent;
        }

        if (totalSent > 0) {
            logger.info(`[CooldownExpiry] ✅ Total sent: ${totalSent}`);
        } else {
            logger.debug('[CooldownExpiry] No cooldowns expired in the last hour');
        }
    } catch (error) {
        logger.error('[CooldownExpiry] ❌ Notifier error:', error);
    }
}

/**
 * Register the cooldown expiry cron job.
 * Runs every hour at minute 30 (offset from lucky wheel at minute 0).
 */
export function startCooldownExpiryNotifier(): void {
    cron.schedule('30 * * * *', () => {
        logger.info('⏰ Cron: Cooldown expiry check...');
        runCooldownExpiryNotifier().catch(err => {
            logger.error('Cooldown expiry notifier cron error:', err);
        });
    });

    logger.info('✅ Cooldown expiry notifier cron scheduled (hourly at :30)');
}
