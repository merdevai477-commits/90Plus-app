import { Expo, ExpoPushMessage, ExpoPushSuccessTicket } from 'expo-server-sdk';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { getRedisClient } from '../lib/redis';
import {
    renderPushTemplate,
    getUserLanguage,
    type SupportedLanguage,
    type PushTemplateKey,
} from './push-templates.service';
import {
    type ExpoPushErrorCode,
    logExpoPushReceipt,
    logExpoPushTicket,
} from '../utils/expo-push-log.util';

// Create a new Expo SDK client
const expo = new Expo();

const RECEIPT_TTL_SECONDS = 60 * 35; // 35 min (Expo receipts available for ~30 min)

/**
 * Handle invalid/expired push tokens by clearing them from DB
 */
async function handleInvalidToken(token: string, reason: ExpoPushErrorCode): Promise<void> {
    try {
        await prisma.user.updateMany({
            where: { expoPushToken: token },
            data: { expoPushToken: null },
        });
        logger.info(`Cleared invalid push token from DB (${reason}): ${token.substring(0, 20)}...`);
    } catch (err) {
        logger.warn('Failed to clear invalid push token from DB:', err);
    }
}

async function handleExpoPushError(
    errorCode: ExpoPushErrorCode,
    pushToken: string | undefined,
    meta: { receiptId?: string; phase: 'ticket' | 'receipt' },
): Promise<'retry' | 'fatal' | 'done'> {
    switch (errorCode) {
        case 'DeviceNotRegistered':
        case 'InvalidRegistration':
            if (pushToken) await handleInvalidToken(pushToken, errorCode);
            return 'done';
        case 'MessageRateExceeded':
            logger.warn(`[EXPO PUSH] ${errorCode} — will retry`, meta);
            return 'retry';
        case 'InvalidCredentials':
        case 'MismatchSenderId':
        case 'InvalidProviderToken':
            logger.error(`[EXPO PUSH] CRITICAL ${errorCode} — check FCM V1 / APNs in Expo Dashboard`, meta);
            try {
                const Sentry = await import('@sentry/node');
                Sentry.captureException(new Error(`Expo push ${errorCode}`), {
                    level: 'fatal',
                    tags: { service: 'push-notifications', errorCode, phase: meta.phase },
                    extra: meta,
                });
            } catch {
                /* non-fatal */
            }
            return 'fatal';
        case 'MessageTooBig':
            logger.error('[EXPO PUSH] MessageTooBig — reduce payload size', meta);
            return 'done';
        case 'Unknown':
        default:
            logger.warn('[EXPO PUSH] Unclassified Expo error', { errorCode, ...meta });
            return 'done';
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
 */
export async function checkPushReceipts(receiptIds: string[]): Promise<void> {
    if (receiptIds.length === 0) return;

    try {
        const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

        for (const chunk of chunks) {
            try {
                const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

                for (const [receiptId, receipt] of Object.entries(receipts)) {
                    const redis = getRedisClient();
                    const storedToken =
                        redis ? await redis.get(`expo:receipt:${receiptId}`) : undefined;
                    const pushTokenPrefix =
                        storedToken && storedToken !== '1'
                            ? `${storedToken.substring(0, 28)}...`
                            : undefined;

                    const errorCode = logExpoPushReceipt(receiptId, receipt, {
                        receiptId,
                        pushTokenPrefix,
                        source: 'checkPushReceipts',
                    });

                    if (receipt.status === 'ok') {
                        continue;
                    }

                    if (receipt.status === 'error' && errorCode) {
                        const tokenForCleanup =
                            storedToken && storedToken !== '1' ? storedToken : undefined;
                        const action = await handleExpoPushError(errorCode, tokenForCleanup, {
                            receiptId,
                            phase: 'receipt',
                        });
                        if (action === 'retry') {
                            throw new Error('MessageRateExceeded');
                        }
                        if (
                            errorCode === 'DeviceNotRegistered' &&
                            !tokenForCleanup
                        ) {
                            logger.warn(
                                `[EXPO PUSH RECEIPT] DeviceNotRegistered receipt ${receiptId} — no token in Redis for cleanup`,
                            );
                        }
                    }
                }
            } catch (chunkErr: unknown) {
                if (chunkErr instanceof Error && chunkErr.message === 'MessageRateExceeded') {
                    throw chunkErr;
                }
                logger.error('Error checking receipt chunk:', chunkErr);
            }
        }

        const redis = getRedisClient();
        if (redis) {
            const pipeline = redis.pipeline();
            for (const id of receiptIds) {
                pipeline.del(`expo:receipt:${id}`);
            }
            await pipeline.exec();
        }
    } catch (err: unknown) {
        logger.error('checkPushReceipts error:', err);
        throw err;
    }
}

export function verifyFCMConfiguration(): void {
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
    channelId?: string;
}

function resolvePushChannelId(
    data?: Record<string, unknown>,
    explicit?: string,
): string {
    if (explicit) return explicit;
    const type = typeof data?.type === 'string' ? data.type : undefined;
    if (!type) return 'default';
    if (type.includes('MATCH')) return 'match-updates';
    if (
        type === 'LIKE' ||
        type === 'COMMENT' ||
        type === 'REPLY' ||
        type === 'MENTION' ||
        type === 'FOLLOW' ||
        type === 'SHARE' ||
        type === 'COMMENT_LIKE'
    ) {
        return 'social';
    }
    return 'default';
}

async function scheduleReceiptCheck(receiptIds: string[]): Promise<void> {
    try {
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
                },
            );
        }
    } catch (err) {
        logger.warn('Failed to schedule receipt check:', err);
    }
}

function processTicketChunk(
    ticketChunk: Awaited<ReturnType<typeof expo.sendPushNotificationsAsync>>,
    tokenForIndex: (index: number) => string | undefined,
    source: 'sendNotification' | 'sendBulkNotifications',
): { receiptIds: string[]; receiptTokenMap: Map<string, string>; hadError: boolean } {
    const receiptIds: string[] = [];
    const receiptTokenMap = new Map<string, string>();
    let hadError = false;

    for (let i = 0; i < ticketChunk.length; i++) {
        const ticket = ticketChunk[i];
        const pushToken = tokenForIndex(i);
        const errorCode = logExpoPushTicket(ticket, {
            pushTokenPrefix: pushToken ? `${pushToken.substring(0, 28)}...` : undefined,
            source,
        });

        if (ticket.status === 'error') {
            hadError = true;
            if (errorCode) {
                void handleExpoPushError(errorCode, pushToken, { phase: 'ticket' });
            }
            continue;
        }

        if ((ticket as ExpoPushSuccessTicket).id) {
            const rid = (ticket as ExpoPushSuccessTicket).id;
            receiptIds.push(rid);
            if (pushToken) {
                receiptTokenMap.set(rid, pushToken);
            }
        }
    }

    return { receiptIds, receiptTokenMap, hadError };
}

export class PushNotificationService {
    static async sendNotification(payload: PushNotificationPayload): Promise<boolean> {
        try {
            if (!Expo.isExpoPushToken(payload.to)) {
                logger.error(`Invalid Expo push token: ${payload.to}`);
                return false;
            }

            let message: ExpoPushMessage;

            if (payload.silent) {
                message = {
                    to: payload.to,
                    data: {
                        ...(payload.data || {}),
                        silent: 'true',
                    },
                    _contentAvailable: true,
                    sound: null,
                    badge: 0,
                    priority: 'normal',
                };
            } else {
                const channelId = resolvePushChannelId(payload.data, payload.channelId);
                message = {
                    to: payload.to,
                    sound: payload.sound || 'default',
                    title: payload.title,
                    body: payload.body,
                    data: payload.data || {},
                    badge: payload.badge,
                    priority: 'high',
                    channelId,
                    ...(payload.threadId ? { threadId: payload.threadId } : {}),
                };
            }

            if (process.env.PUSH_DEBUG_PAYLOAD === 'true' || process.env.NODE_ENV !== 'production') {
                logger.info('EXPO PUSH OUTBOUND', JSON.stringify({
                    to: `${payload.to.substring(0, 28)}...`,
                    sound: message.sound,
                    title: message.title,
                    body: message.body,
                    hasData: !!(message.data && Object.keys(message.data).length > 0),
                    dataKeys: message.data ? Object.keys(message.data) : [],
                    silent: !!payload.silent,
                }));
            }

            const chunks = expo.chunkPushNotifications([message]);
            const allReceiptIds: string[] = [];
            const allReceiptTokenMap = new Map<string, string>();
            let ticketFailed = false;

            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    const { receiptIds, receiptTokenMap, hadError } = processTicketChunk(
                        ticketChunk,
                        () => payload.to,
                        'sendNotification',
                    );
                    if (hadError) ticketFailed = true;
                    allReceiptIds.push(...receiptIds);
                    for (const [k, v] of receiptTokenMap) {
                        allReceiptTokenMap.set(k, v);
                    }
                } catch (error) {
                    logger.error('Error sending push notification chunk:', error);
                    return false;
                }
            }

            if (ticketFailed) {
                return false;
            }

            if (allReceiptIds.length > 0) {
                await storeReceiptIds(allReceiptIds, allReceiptTokenMap);
                await scheduleReceiptCheck(allReceiptIds);
            }

            return true;
        } catch (error) {
            logger.error('Push notification error:', error);
            return false;
        }
    }

    static async sendBulkNotifications(payloads: PushNotificationPayload[]): Promise<{ success: number; failed: number }> {
        const messages: ExpoPushMessage[] = [];
        let failed = 0;

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
                priority: 'high',
                channelId: resolvePushChannelId(payload.data, payload.channelId),
            });
        }

        if (messages.length === 0) {
            return { success: 0, failed };
        }

        const chunks = expo.chunkPushNotifications(messages);
        let success = 0;
        const allReceiptIds: string[] = [];
        const allReceiptTokenMap = new Map<string, string>();

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                const { receiptIds, receiptTokenMap } = processTicketChunk(
                    ticketChunk,
                    (i) => (chunk[i] as ExpoPushMessage).to as string,
                    'sendBulkNotifications',
                );

                for (const ticket of ticketChunk) {
                    if (ticket.status === 'ok') success++;
                    else failed++;
                }

                allReceiptIds.push(...receiptIds);
                for (const [k, v] of receiptTokenMap) {
                    allReceiptTokenMap.set(k, v);
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

    private static async resolveLanguage(opts?: { userId?: string; language?: SupportedLanguage }): Promise<SupportedLanguage> {
        if (opts?.language === 'ar' || opts?.language === 'en') return opts.language;
        if (opts?.userId) {
            try {
                return await getUserLanguage(opts.userId);
            } catch {
                return 'en';
            }
        }
        return 'en';
    }

    static async sendGoalNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number,
        scoringTeam: 'home' | 'away',
        opts?: { userId?: string; language?: SupportedLanguage },
    ): Promise<boolean> {
        const scorer = scoringTeam === 'home' ? homeTeam : awayTeam;
        const language = await this.resolveLanguage(opts);

        const title = renderPushTemplate('goalTitle', language);
        const scorerLine = renderPushTemplate('goalBody', language, {
            player: scorer,
            team: scorer,
            minute: '',
        }).replace(/\s*\(\s*'?\s*\)/, '').trim();
        const scoreLine = `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;
        const body = scorerLine ? `${scorerLine}\n${scoreLine}` : scoreLine;

        return this.sendNotification({
            to: pushToken,
            title,
            body,
            data: {
                type: 'MATCH_GOAL',
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
            },
        });
    }

    static async sendLocalizedNotification(params: {
        pushToken: string;
        userId?: string;
        language?: SupportedLanguage;
        titleKey: PushTemplateKey;
        bodyKey: PushTemplateKey;
        vars?: Record<string, string | number>;
        data?: Record<string, unknown>;
        channelId?: string;
        threadId?: string;
        badge?: number;
    }): Promise<boolean> {
        const language = await this.resolveLanguage({ userId: params.userId, language: params.language });
        const title = renderPushTemplate(params.titleKey, language, params.vars);
        const body = renderPushTemplate(params.bodyKey, language, params.vars);
        return this.sendNotification({
            to: params.pushToken,
            title,
            body,
            data: params.data,
            channelId: params.channelId,
            threadId: params.threadId,
            badge: params.badge,
        });
    }

    static async sendMatchStartNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string,
        opts?: { userId?: string; language?: SupportedLanguage; minutesUntilKickoff?: number },
    ): Promise<boolean> {
        const language = await this.resolveLanguage(opts);
        const title = renderPushTemplate('matchStartTitle', language);
        const body = renderPushTemplate('matchStartBody', language, {
            home: homeTeam,
            away: awayTeam,
            minutes: opts?.minutesUntilKickoff ?? 0,
        });
        return this.sendNotification({
            to: pushToken,
            title,
            body,
            data: {
                type: 'MATCH_START',
                homeTeam,
                awayTeam,
            },
        });
    }

    static async sendMatchEndNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number,
        opts?: { userId?: string; language?: SupportedLanguage },
    ): Promise<boolean> {
        const language = await this.resolveLanguage(opts);
        const title = renderPushTemplate('fulltimeTitle', language);
        const body = renderPushTemplate('fulltimeBody', language, {
            home: homeTeam,
            away: awayTeam,
            homeScore,
            awayScore,
        });
        return this.sendNotification({
            to: pushToken,
            title,
            body,
            data: {
                type: 'MATCH_END',
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
            },
        });
    }

    static async sendHalftimeNotification(
        pushToken: string,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number,
        opts?: { userId?: string; language?: SupportedLanguage },
    ): Promise<boolean> {
        const language = await this.resolveLanguage(opts);
        const title = renderPushTemplate('halftimeTitle', language);
        const body = renderPushTemplate('halftimeBody', language, {
            home: homeTeam,
            away: awayTeam,
            homeScore,
            awayScore,
        });
        return this.sendNotification({
            to: pushToken,
            title,
            body,
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
