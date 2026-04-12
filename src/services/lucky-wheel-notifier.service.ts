import Bull, { Queue } from 'bull';
import cron from 'node-cron';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import PushNotificationService from './push-notification.service';

const BATCH_SIZE = 100;

// UTC offsets where it's currently 9 AM local time
// e.g. if UTC is 07:00, then UTC+2 users (Egypt, Palestine, Syria) are at 09:00
function getUTCOffsetsFor9AM(): number[] {
    const utcHour = new Date().getUTCHours();
    // offset = 9 - utcHour  (e.g. UTC=7 → offset=+2)
    const offset = 9 - utcHour;
    // Also include offset-1 and offset+1 to catch DST edge cases
    return [offset - 1, offset, offset + 1];
}

// Map UTC offset (in hours) to list of timezone names
// Covers Middle East, North Africa, Europe, Americas
const TIMEZONE_OFFSET_MAP: Record<string, string[]> = {
    '-12': ['Etc/GMT+12'],
    '-11': ['Pacific/Midway'],
    '-10': ['Pacific/Honolulu'],
    '-9':  ['America/Anchorage'],
    '-8':  ['America/Los_Angeles', 'America/Vancouver'],
    '-7':  ['America/Denver', 'America/Phoenix'],
    '-6':  ['America/Chicago', 'America/Mexico_City'],
    '-5':  ['America/New_York', 'America/Toronto', 'America/Bogota'],
    '-4':  ['America/Halifax', 'America/Caracas'],
    '-3':  ['America/Sao_Paulo', 'America/Argentina/Buenos_Aires'],
    '-2':  ['Etc/GMT+2'],
    '-1':  ['Atlantic/Azores'],
    '0':   ['Europe/London', 'Africa/Casablanca', 'Africa/Abidjan'],
    '1':   ['Europe/Paris', 'Europe/Berlin', 'Africa/Algiers', 'Africa/Tunis'],
    '2':   ['Africa/Cairo', 'Asia/Jerusalem', 'Europe/Athens', 'Africa/Tripoli', 'Asia/Beirut', 'Asia/Damascus', 'Asia/Amman'],
    '3':   ['Asia/Riyadh', 'Asia/Baghdad', 'Africa/Nairobi', 'Europe/Moscow'],
    '4':   ['Asia/Dubai', 'Asia/Muscat'],
    '5':   ['Asia/Karachi', 'Asia/Tashkent'],
    '5.5': ['Asia/Kolkata'],
    '6':   ['Asia/Dhaka'],
    '7':   ['Asia/Bangkok', 'Asia/Jakarta'],
    '8':   ['Asia/Shanghai', 'Asia/Singapore', 'Asia/Kuala_Lumpur'],
    '9':   ['Asia/Tokyo', 'Asia/Seoul'],
    '10':  ['Australia/Sydney', 'Pacific/Guam'],
    '11':  ['Pacific/Noumea'],
    '12':  ['Pacific/Auckland'],
};

interface LuckyWheelBatchJob {
    userIds: string[];
    date: string;
}

let luckyWheelQueue: Queue<LuckyWheelBatchJob> | null = null;

function getLuckyWheelQueue(): Queue<LuckyWheelBatchJob> | null {
    if (luckyWheelQueue) return luckyWheelQueue;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

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
                data: { type: 'LUCKY_WHEEL', screen: '/(tabs)/Home', openLuckyWheel: 'true' },
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
 * Runs every hour.
 * Sends lucky wheel notification only to users where it's currently 9 AM in their timezone.
 * Uses Redis per-user dedup key (TTL 23h) to prevent double-send.
 */
async function runHourlyLuckyWheelNotifier(): Promise<void> {
    const utcOffsets = getUTCOffsetsFor9AM();
    const dateKey = new Date().toISOString().split('T')[0];

    logger.info(`🎡 Lucky wheel hourly check - targeting UTC offsets: ${utcOffsets.join(', ')}`);

    try {
        const { getRedisClient } = await import('../lib/redis');
        const redis = getRedisClient();
        // Get timezones that match current 9 AM window
        const targetTimezones: string[] = [];
        for (const offset of utcOffsets) {
            const tzList = TIMEZONE_OFFSET_MAP[String(offset)];
            if (tzList) targetTimezones.push(...tzList);
        }

        if (targetTimezones.length === 0) {
            logger.debug('🎡 No timezones match 9 AM window this hour');
            return;
        }

        // Start of today UTC (for lastDailySpin comparison)
        const startOfTodayUTC = new Date();
        startOfTodayUTC.setUTCHours(0, 0, 0, 0);

        // Get eligible users (country-based timezone matching)
        const eligibleUsers = await prisma.user.findMany({
            where: {
                pushNotificationsConsent: true,
                expoPushToken: { not: null },
                isDeleted: false,
                isBanned: false,
                isSuspended: false,
                OR: [
                    { lastDailySpin: null },
                    { lastDailySpin: { lt: startOfTodayUTC } },
                ],
            },
            select: { id: true, country: true },
        });

        if (eligibleUsers.length === 0) return;

        // Filter by luckyWheel preference
        const optedOut = await (prisma as any).notificationPreferences.findMany({
            where: {
                userId: { in: eligibleUsers.map((u: { id: string }) => u.id) },
                luckyWheel: false,
            },
            select: { userId: true },
        });
        const optedOutIds = new Set(optedOut.map((p: { userId: string }) => p.userId));

        // Filter users by timezone match + not opted out
        // Users without country get the notification (default to Middle East window)
        const targetUsers = eligibleUsers.filter((u: { id: string; country: string | null }) => {
            if (optedOutIds.has(u.id)) return false;
            if (!u.country) {
                // No country set - send during UTC+2 window (Egypt/Palestine/Syria)
                return utcOffsets.includes(2);
            }
            // Check if user's country timezone matches current 9 AM window
            return targetTimezones.some(tz => tz.toLowerCase().includes(u.country!.toLowerCase().replace(' ', '_')))
                || isCountryInOffsets(u.country, utcOffsets);
        });

        if (targetUsers.length === 0) {
            logger.debug('🎡 No users match 9 AM window this hour');
            return;
        }

        // Dedup: filter out users already notified today
        const finalUsers: string[] = [];
        for (const user of targetUsers) {
            const dedupKey = `lucky-wheel-sent:${user.id}:${dateKey}`;
            if (redis) {
                const alreadySent = await redis.get(dedupKey);
                if (alreadySent) continue;
            }
            finalUsers.push(user.id);
        }

        if (finalUsers.length === 0) {
            logger.debug('🎡 All matching users already notified today');
            return;
        }

        logger.info(`🎡 Sending lucky wheel to ${finalUsers.length} users (9 AM in their timezone)`);

        const q = getLuckyWheelQueue();

        for (let i = 0; i < finalUsers.length; i += BATCH_SIZE) {
            const batch = finalUsers.slice(i, i + BATCH_SIZE);
            if (q) {
                await q.add(
                    { userIds: batch, date: dateKey },
                    { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50 }
                );
            } else {
                const users = await prisma.user.findMany({
                    where: { id: { in: batch }, expoPushToken: { not: null } },
                    select: { id: true, expoPushToken: true },
                });
                const payloads = users.filter(u => u.expoPushToken).map(u => ({
                    to: u.expoPushToken!,
                    title: '🎡 عجلة الحظ جاهزة!',
                    body: 'حظك النهارده ينتظرك، العب دلوقتي!',
                    data: { type: 'LUCKY_WHEEL', screen: '/(tabs)/Home', openLuckyWheel: 'true' },
                }));
                if (payloads.length > 0) await PushNotificationService.sendBulkNotifications(payloads);
            }
        }

        // Mark users as notified today (TTL 23 hours)
        if (redis) {
            const pipeline = redis.pipeline();
            for (const userId of finalUsers) {
                pipeline.setex(`lucky-wheel-sent:${userId}:${dateKey}`, 23 * 60 * 60, '1');
            }
            await pipeline.exec();
        }

    } catch (error) {
        logger.error('❌ Lucky wheel hourly notifier error:', error);
    }
}

/**
 * Simple country → UTC offset mapping for common countries
 */
function isCountryInOffsets(country: string, offsets: number[]): boolean {
    const countryOffsetMap: Record<string, number> = {
        'egypt': 2, 'مصر': 2,
        'palestine': 2, 'فلسطين': 2,
        'syria': 2, 'سوريا': 3,
        'jordan': 2, 'الأردن': 2,
        'lebanon': 2, 'لبنان': 2,
        'libya': 2, 'ليبيا': 2,
        'israel': 2,
        'iraq': 3, 'العراق': 3,
        'saudi arabia': 3, 'السعودية': 3,
        'uae': 4, 'الإمارات': 4,
        'kuwait': 3, 'الكويت': 3,
        'qatar': 3, 'قطر': 3,
        'bahrain': 3, 'البحرين': 3,
        'oman': 4, 'عُمان': 4,
        'yemen': 3, 'اليمن': 3,
        'morocco': 0, 'المغرب': 0,
        'algeria': 1, 'الجزائر': 1,
        'tunisia': 1, 'تونس': 1,
        'sudan': 3, 'السودان': 3,
        'uk': 0, 'united kingdom': 0,
        'france': 1, 'germany': 1, 'spain': 1, 'italy': 1,
        'usa': -5, 'united states': -5,
        'canada': -5,
        'turkey': 3, 'تركيا': 3,
    };

    const offset = countryOffsetMap[country.toLowerCase()];
    return offset !== undefined && offsets.includes(offset);
}

/**
 * Register the lucky wheel cron job.
 * Runs every hour and sends to users where it's 9 AM in their timezone.
 * No TZ env variable needed - works globally automatically.
 */
export function startLuckyWheelNotifier(): void {
    cron.schedule('0 * * * *', () => {
        logger.info('⏰ Cron: Lucky wheel hourly timezone check...');
        runHourlyLuckyWheelNotifier().catch(err => {
            logger.error('Lucky wheel cron error:', err);
        });
    });

    logger.info('✅ Lucky wheel notifier cron scheduled (hourly, timezone-aware, 9 AM local)');
}
