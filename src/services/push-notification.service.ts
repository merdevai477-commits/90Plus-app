import { Expo, ExpoPushMessage, ExpoPushSuccessTicket } from 'expo-server-sdk';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { getRedisClient } from '../lib/redis';

// Create a new Expo SDK client
const expo = new Expo();

const RECEIPT_TTL_SECONDS = 60 * 35; // 35 min (Expo receipts available for ~30 min)

/**
 * Handle invalid/expired push tokens by clearing them from DB
 */
async function handleInvalidToken(token: string): Promise<void> {
    try {
        await prisma.user.updateMany({
            where: { expoPushToken: token },
            data: { expoPushToken: null },
        });
        logger.info(`Cleared invalid push token from DB: ${token.substring(0, 20)}...`);
    } catch (err) {
        logger.warn('Failed to clear invalid push token from DB:', err);
    }
}

/**
 * Store receipt IDs in Redis for later checking
 */
async function storeReceiptIds(receiptIds: string[], tokenMap?: Map<string, string>): Promise<void> {
    const redis = getRedisClient();
    if (!redis || receiptIds.length === 0) return;
    try {
        const pipeline = redis.pipeline();
        for (const id of receiptIds) {
            // Store receipt ID with optional token mapping for cleanup on DeviceNotRegistered
            const value = tokenMap?.get(id) || '1';
            pipeline.setex(`expo:receipt:${id}`, RECEIPT_TTL_SECONDS, value);
        }
        await pipeline.exec();
    } catch (err) {
        logger.warn('Failed to store receipt IDs in Redis:', err);
    }
}

/**
 * Check Expo push receipts for a batch of receipt IDs.
 * Called by Bull job 30 seconds after sending.
 * Handles DeviceNotRegistered, MessageRateExceeded, InvalidCredentials.
 */
export async function checkPushReceipts(receiptIds: string[]): Promise<void> {
    if (receiptIds.length === 0) return;

    try {
        // Expo allows max 300 receipt IDs per request
        const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

        for (const chunk of chunks) {
            try {
                const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

                for (const [receiptId, receipt] of Object.entries(receipts)) {
                    if (receipt.status === 'error') {
                        const errCode = (receipt as any).details?.error;
                        logger.warn(`Receipt error [${receiptId}]: ${receipt.message} (${errCode})`);

                        if (errCode === 'DeviceNotRegistered') {
                            // Retrieve the push token stored with this receipt ID
                            const redis = getRedisClient();
                            if (redis) {
                                const storedToken = await redis.get(`expo:receipt:${receiptId}`);
                                if (storedToken && storedToken !== '1') {
                                    await handleInvalidToken(storedToken);
                                } else {
                                    logger.warn(`DeviceNotRegistered receipt: ${receiptId} - no token stored for cleanup`);
                                }
                            }
                        } else if (errCode === 'MessageRateExceeded') {
                            logger.warn(`MessageRateExceeded for receipt ${receiptId} - will retry`);
                            throw new Error('MessageRateExceeded');
                        } else if (errCode === 'InvalidCredentials') {
                            logger.error('CRITICAL: Invalid Expo push credentials. Check FCM/APNs setup in Expo Dashboard.', {
                                receiptId,
                                error: receipt.message,
                            });
                            // Fix 9: Capture to Sentry so the team is alerted immediately
                            try {
                                const Sentry = await import('@sentry/node');
                                Sentry.captureException(
                                    new Error(`Expo push InvalidCredentials: ${receipt.message}`),
                                    {
                                        level: 'fatal',
                                        tags: { service: 'push-notifications', errorCode: 'InvalidCredentials' },
                                        extra: { receiptId, message: receipt.message },
                                    },
                                );
                            } catch (sentryErr) {
                                logger.warn('Failed to send InvalidCredentials alert to Sentry:', sentryErr);
                            }
                        }
                    }
                }
            } catch (chunkErr: any) {
                if (chunkErr.message === 'MessageRateExceeded') throw chunkErr;
                logger.error('Error checking receipt chunk:', chunkErr);
            }
        }

        // Clean up processed receipt IDs from Redis
        const redis = getRedisClient();
        if (redis) {
            const pipeline = redis.pipeline();
            for (const id of receiptIds) {
                pipeline.del(`expo:receipt:${id}`);
            }
            await pipeline.exec();
        }
    } catch (err: any) {
        logger.error('checkPushReceipts error:', err);
        throw err; // Re-throw so Bull retries
    }
}

/**
 * FCM V1 startup verification check.
 * Logs a warning if FCM credentials are not configured in Expo Dashboard.
 *
 * To add FCM V1:
 * 1. Go to https://console.firebase.google.com → Project Settings → Service Accounts
 * 2. Generate new private key → download JSON
 * 3. Go to https://expo.dev → Project → Credentials → Android
 * 4. Add FCM V1 service account key → upload the JSON
 * 5. Rebuild your Android app with: eas build --platform android
 */
export function verifyFCMConfiguration(): void {
    // Expo SDK handles FCM internally via the service account key set in Expo Dashboard.
    // We can't check it at runtime directly, but we log a reminder on startup.
    const hasRedis = !!process.env.REDIS_URL;
    if (!hasRedis) {
        logger.warn('⚠️  REDIS_URL not set - receipt checking disabled. Push delivery errors may go undetected.');
    }
    logger.info('ℹ️  FCM V1: Ensure service account key is uploaded to Expo Dashboard → Credentials → Android.');
    logger.info('ℹ️  APNs: Ensure .p8 key is uploaded to Expo Dashboard → Credentials → iOS.');
}

export interface PushNotificationPayload {
    to: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    badge?: number;
    threadId?: string;
    silent?: boolean;
    channelId?: string; // Android notification channel
}

/**
 * Schedule a Bull job to check receipts after 30 seconds
 */
async function scheduleReceiptCheck(receiptIds: string[]): Promise<void> {
    try {
        // Dynamic import to avoid circular dependency
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const receiptModule = require('../queues/receipt.queue');
        const q = receiptModule.getReceiptQueue();
        if (q) {
            await q.add(
                { receiptIds },
                {
                    delay: 30 * 1000,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 60000 },
                    removeOnComplete: true,
                    removeOnFail: 100,
                }
            );
        }
    } catch (err) {
        logger.warn('Failed to schedule receipt check:', err);
    }
}

export class PushNotificationService {
    /**
     * Send a single push notification
     */
    static async sendNotification(payload: PushNotificationPayload): Promise<boolean> {
        try {
            // Check if the push token is valid
            if (!Expo.isExpoPushToken(payload.to)) {
                logger.error(`Invalid Expo push token: ${payload.to}`);
                return false;
            }

            let message: ExpoPushMessage;

            if (payload.silent) {
                // Silent / data-only notification
                // iOS: contentAvailable:true wakes the app in background, no alert shown
                // Android: omit title & body entirely → FCM treats it as data-only message
                message = {
                    to: payload.to,
                    // No title, no body, no sound → pure data message on both platforms
                    data: {
                        ...(payload.data || {}),
                        silent: 'true', // string 'true' for Android FCM data payload compatibility
                    },
                    // iOS-specific: wake app in background
                    _contentAvailable: true,
                    // Suppress all UI
                    sound: null,
                    badge: 0,
                    priority: 'normal', // Android: normal priority = no heads-up notification
                };
            } else {
                message = {
                    to: payload.to,
                    sound: payload.sound || 'default',
                    title: payload.title,
                    body: payload.body,
                    data: payload.data || {},
                    badge: payload.badge,
                    ...(payload.threadId ? { threadId: payload.threadId } : {}),
                    ...(payload.channelId ? { channelId: payload.channelId } : {}),
                };
            }

            const chunks = expo.chunkPushNotifications([message]);
            const receiptIds: string[] = [];
            const receiptTokenMap = new Map<string, string>(); // receiptId → pushToken

            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    logger.info('Push notification sent:', ticketChunk);

                    for (const ticket of ticketChunk) {
                        if ((ticket as any).status === 'error') {
                            const errCode = (ticket as any).details?.error;
                            logger.error('Push notification error:', (ticket as any).message, errCode);
                            if (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials') {
                                await handleInvalidToken(payload.to);
                            }
                            if (errCode === 'InvalidCredentials') {
                                try {
                                    const Sentry = await import('@sentry/node');
                                    Sentry.captureException(
                                        new Error(`Expo push InvalidCredentials (ticket): ${(ticket as any).message}`),
                                        {
                                            level: 'fatal',
                                            tags: { service: 'push-notifications', errorCode: 'InvalidCredentials' },
                                        },
                                    );
                                } catch { /* non-fatal */ }
                            }
                            return false;
                        }
                        if ((ticket as ExpoPushSuccessTicket).id) {
                            const rid = (ticket as ExpoPushSuccessTicket).id;
                            receiptIds.push(rid);
                            receiptTokenMap.set(rid, payload.to);
                        }
                    }
                } catch (error) {
                    logger.error('Error sending push notification chunk:', error);
                    return false;
                }
            }

            if (receiptIds.length > 0) {
                await storeReceiptIds(receiptIds, receiptTokenMap);
                await scheduleReceiptCheck(receiptIds);
            }

            return true;
        } catch (error) {
            logger.error('Push notification error:', error);
            return false;
        }
    }

    /**
     * Send push notifications to multiple users
     */
    static async sendBulkNotifications(payloads: PushNotificationPayload[]): Promise<{ success: number; failed: number }> {
        const messages: ExpoPushMessage[] = [];
        let failed = 0;

        // Filter valid tokens and create messages
        for (const payload of payloads) {
            if (!Expo.isExpoPushToken(payload.to)) {
                logger.warn(`Skipping invalid token: ${payload.to}`);
                failed++;
                continue;
            }

            messages.push({
                to: payload.to,
                sound: payload.sound || 'default',
                title: payload.title,
                body: payload.body,
                data: payload.data || {},
                badge: payload.badge,
            });
        }

        if (messages.length === 0) {
            return { success: 0, failed };
        }

        // Chunk and send
        const chunks = expo.chunkPushNotifications(messages);
        let success = 0;
        const allReceiptIds: string[] = [];
        const allReceiptTokenMap = new Map<string, string>();

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                
                for (let i = 0; i < ticketChunk.length; i++) {
                    const ticket = ticketChunk[i];
                    const originalToken = (chunk[i] as ExpoPushMessage).to as string;

                    if ((ticket as any).status === 'ok') {
                        success++;
                        if ((ticket as ExpoPushSuccessTicket).id) {
                            const rid = (ticket as ExpoPushSuccessTicket).id;
                            allReceiptIds.push(rid);
                            allReceiptTokenMap.set(rid, originalToken);
                        }
                    } else {
                        failed++;
                        const errCode = (ticket as any).details?.error;
                        logger.error('Push error:', (ticket as any).message, errCode);
                        if (errCode === 'DeviceNotRegistered' || errCode === 'InvalidCredentials') {
                            if (originalToken) await handleInvalidToken(originalToken);
                        }
                    }
                }
            } catch (error) {
                logger.error('Chunk send error:', error);
                failed += chunk.length;
            }
        }

        if (allReceiptIds.length > 0) {
            await storeReceiptIds(allReceiptIds, allReceiptTokenMap);
            await scheduleReceiptCheck(allReceiptIds);
        }

        return { success, failed };
    }

    /**
     * Send a silent background notification (content-available: 1)
     * Used to trigger cache invalidation on the client without showing UI
     */
    static async sendSilentNotification(params: {
        pushToken: string;
        type: 'MATCH_UPDATE' | 'SCORE_UPDATE' | 'NOTIFICATION_COUNT';
        data?: Record<string, any>;
    }): Promise<boolean> {
        return this.sendNotification({
            to: params.pushToken,
            title: '',
            body: '',
            silent: true,
            data: {
                ...params.data,
                type: params.type,
                silent: true,
            },
        });
    }

    /**
     * Send match goal notification
     */
    static async sendGoalNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number,
        scoringTeam: 'home' | 'away'
    ): Promise<boolean> {
        const scorer = scoringTeam === 'home' ? homeTeam : awayTeam;
        
        return this.sendNotification({
            to: pushToken,
            title: '⚽ هدف!',
            body: `${scorer} سجل! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,
            data: {
                type: 'MATCH_GOAL',
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
            },
        });
    }

    /**
     * Send match start notification
     */
    static async sendMatchStartNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string
    ): Promise<boolean> {
        return this.sendNotification({
            to: pushToken,
            title: '🏟️ بدأت المباراة!',
            body: `${homeTeam} vs ${awayTeam} - المباراة بدأت الآن`,
            data: {
                type: 'MATCH_START',
                homeTeam,
                awayTeam,
            },
        });
    }

    /**
     * Send match end notification
     */
    static async sendMatchEndNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number
    ): Promise<boolean> {
        let result = 'تعادل';
        if (homeScore > awayScore) result = `فوز ${homeTeam}`;
        else if (awayScore > homeScore) result = `فوز ${awayTeam}`;

        return this.sendNotification({
            to: pushToken,
            title: '🏁 انتهت المباراة!',
            body: `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} | ${result}`,
            data: {
                type: 'MATCH_END',
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
            },
        });
    }

    /**
     * Send halftime notification
     */
    static async sendHalftimeNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number
    ): Promise<boolean> {
        return this.sendNotification({
            to: pushToken,
            title: '⏸️ نهاية الشوط الأول',
            body: `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,
            data: {
                type: 'MATCH_HALFTIME',
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
            },
        });
    }
}

export default PushNotificationService;
