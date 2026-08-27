import Bull, { Queue } from 'bull';
import cron from 'node-cron';
import prisma from '../lib/prisma';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import { notifyUsers } from './notify.service';
import { NotificationType } from './notification.service';

const BATCH_SIZE = 100;

// UTC offsets where it's currently 9 AM local time
// e.g. if UTC is 07:00, then UTC+2 users (Egypt, Palestine, Syria) are at 09:00
// Target hours to send the lucky wheel reminder locally to the user
const TARGET_HOURS = [9, 15, 21]; // 9 AM, 3 PM, 9 PM (approx every 8 waking hours)

function getActiveOffsets(): { targetHour: number, offset: number }[] {
    const utcHour = new Date().getUTCHours();
    const active: { targetHour: number, offset: number }[] = [];
    
    for (const h of TARGET_HOURS) {
        let offset = h - utcHour;
        if (offset > 14) offset -= 24;
        if (offset < -12) offset += 24;
        active.push({ targetHour: h, offset });
        // Include edges
        active.push({ targetHour: h, offset: offset - 1 });
        active.push({ targetHour: h, offset: offset + 1 });
    }
    return active;
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

    luckyWheelQueue = new Bull<LuckyWheelBatchJob>('lucky-wheel-notifications', {
        createClient: bullCreateClient(redisUrl),
    });

    luckyWheelQueue.process(async (job) => {
        const { userIds, date } = job.data;
        logger.info(`🎡 Processing lucky wheel batch: ${userIds.length} users for ${date}`);

        // notifyUsers handles preference gating, inbox row creation,
        // WebSocket fan-out, and the push delivery in one shot.
        const result = await notifyUsers(
            userIds.map((userId) => ({
                userId,
                type: NotificationType.LUCKY_WHEEL_RENEWED,
                titleKey: 'luckyWheelRenewedTitle',
                bodyKey: 'luckyWheelRenewedBody',
                data: { screen: '/notifications', openLuckyWheel: 'true' },
                idempotencyKey: `lucky-wheel-renewed:${userId}:${date}`,
            })),
            { concurrency: 20 },
        );

        logger.info(
            `🎡 Lucky wheel batch sent: delivered=${result.delivered} ` +
            `suppressed=${result.suppressed} failed=${result.failed}`,
        );
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
 * Sends lucky wheel notification to users where it's currently 9 AM, 3 PM, or 9 PM in their timezone.
 * Uses Redis per-user dedup key to prevent double-send for the SAME target hour.
 */
async function runHourlyLuckyWheelNotifier(): Promise<void> {
    const activeOffsetsRows = getActiveOffsets();
    const dateKey = new Date().toISOString().split('T')[0];

    logger.info(`🎡 Lucky wheel hourly check - targeting local hours: ${TARGET_HOURS.join(', ')}`);

    try {
        const { getRedisClient } = await import('../lib/redis');
        const redis = getRedisClient();
        
        // Map of targetHour -> array of timezones matching
        const hourTargetMap = new Map<number, { timezones: string[], offsets: number[] }>();
        
        for (const row of activeOffsetsRows) {
            if (!hourTargetMap.has(row.targetHour)) {
                hourTargetMap.set(row.targetHour, { timezones: [], offsets: [] });
            }
            const data = hourTargetMap.get(row.targetHour)!;
            data.offsets.push(row.offset);
            
            const tzList = TIMEZONE_OFFSET_MAP[String(row.offset)];
            if (tzList) data.timezones.push(...tzList);
        }

        // Start of today UTC (for lastDailySpin comparison)
        const startOfTodayUTC = new Date();
        startOfTodayUTC.setUTCHours(0, 0, 0, 0);

        // Get eligible users who haven't spun today
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

        const targetSchedules: { userId: string, targetHour: number }[] = [];

        for (const user of eligibleUsers) {
            if (optedOutIds.has(user.id)) continue;
            
            let matchedHour: number | null = null;
            
            if (!user.country) {
                // No country set - assume UTC+2 (Egypt, etc.)
                for (const [hour, data] of hourTargetMap.entries()) {
                    if (data.offsets.includes(2)) { matchedHour = hour; break; }
                }
            } else {
                for (const [hour, data] of hourTargetMap.entries()) {
                    const countryClean = user.country.toLowerCase().replace(' ', '_');
                    const matchTz = data.timezones.some(tz => tz.toLowerCase().includes(countryClean));
                    const matchOffset = isCountryInOffsets(user.country, data.offsets);
                    if (matchTz || matchOffset) {
                        matchedHour = hour;
                        break;
                    }
                }
            }
            
            if (matchedHour !== null) {
                targetSchedules.push({ userId: user.id, targetHour: matchedHour });
            }
        }

        if (targetSchedules.length === 0) {
            logger.debug('🎡 No users match notification windows this hour');
            return;
        }

        // Dedup: filter out users already notified for THIS target hour today
        const finalUsers: string[] = [];
        const dedupKeysToSet: string[] = [];
        
        for (const schedule of targetSchedules) {
            const dedupKey = `lucky-wheel-sent:${schedule.userId}:${dateKey}:${schedule.targetHour}`;
            if (redis) {
                const alreadySent = await redis.get(dedupKey);
                if (alreadySent) continue;
            }
            finalUsers.push(schedule.userId);
            dedupKeysToSet.push(dedupKey);
        }

        if (finalUsers.length === 0) return;

        logger.info(`🎡 Sending lucky wheel to ${finalUsers.length} users for their local notification window`);

        const q = getLuckyWheelQueue();

        for (let i = 0; i < finalUsers.length; i += BATCH_SIZE) {
            const batch = finalUsers.slice(i, i + BATCH_SIZE);
            if (q) {
                await q.add(
                    { userIds: batch, date: dateKey },
                    { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50 }
                );
            } else {
                // Fallback path (no Bull queue): notify directly.
                await notifyUsers(
                    batch.map((userId) => ({
                        userId,
                        type: NotificationType.LUCKY_WHEEL_RENEWED,
                        titleKey: 'luckyWheelRenewedTitle',
                        bodyKey: 'luckyWheelRenewedBody',
                        data: { screen: '/notifications', openLuckyWheel: 'true' },
                        idempotencyKey: `lucky-wheel-renewed:${userId}:${dateKey}`,
                    })),
                    { concurrency: 20 },
                );
            }
        }

        // Mark users as notified for this specific window today (TTL 23 hours)
        if (redis && dedupKeysToSet.length > 0) {
            const pipeline = redis.pipeline();
            for (const key of dedupKeysToSet) {
                pipeline.setex(key, 23 * 60 * 60, '1');
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
