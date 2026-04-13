import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebSocketService } from './websocket.service';
import PushNotificationService from './push-notification.service';

export enum NotificationType {
    MATCH_UPDATE = 'MATCH_UPDATE',
    MATCH_GOAL = 'MATCH_GOAL',
    MATCH_START = 'MATCH_START',
    MATCH_END = 'MATCH_END',
    MATCH_HALFTIME = 'MATCH_HALFTIME',
    PREDICTION_RESULT = 'PREDICTION_RESULT',
    FOLLOW = 'FOLLOW',
    LIKE = 'LIKE',
    COMMENT = 'COMMENT',
    REPLY = 'REPLY',
    MENTION = 'MENTION',
    GIFT = 'GIFT',
    VIDEO_PROCESSED = 'VIDEO_PROCESSED',
    REPORT_RESOLVED = 'REPORT_RESOLVED',
    MILESTONE = 'MILESTONE',
    COIN_MILESTONE = 'COIN_MILESTONE',
    GENERAL = 'GENERAL'
}

export interface NotificationActor {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
}

export interface CreateNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: string;
    data?: any;
    actor?: NotificationActor;
    pushToken?: string | null;
    threadId?: string;
    channelId?: string; // Android notification channel
}

/**
 * Get notification preferences for a user (with defaults if not set)
 * Uses raw query to avoid Prisma client type issues before regeneration
 */
async function getUserPreferences(userId: string) {
    try {
        const result = await (prisma as any).notificationPreferences.upsert({
            where: { userId },
            create: { userId },
            update: {},
        });
        return result;
    } catch {
        return null; // fail open - send notification if prefs unavailable
    }
}

/**
 * Feature 6: Auto-assign Android channelId based on notification type.
 * This enables Android notification grouping per category.
 */
function resolveChannelId(type: string, explicitChannelId?: string): string {
    if (explicitChannelId) return explicitChannelId;
    switch (type) {
        case 'LIKE':
        case 'COMMENT':
        case 'REPLY':
        case 'MENTION':
        case 'FOLLOW':
            return 'social';
        case 'MATCH_UPDATE':
        case 'MATCH_GOAL':
        case 'MATCH_START':
        case 'MATCH_END':
        case 'MATCH_HALFTIME':
            return 'match-updates';
        case 'VIDEO_PROCESSED':
            return 'general';
        case 'GIFT':
        case 'COIN_MILESTONE':
        case 'MILESTONE':
            return 'general';
        default:
            return 'general';
    }
}

export class NotificationService {
    /**
     * Create a notification and optionally send a push notification
     */
    static async createNotification(params: CreateNotificationParams) {
        try {
            const { userId, title, message, type, data, actor, pushToken, threadId, channelId } = params;

            // Ensure actor info is included in data
            const notificationData = {
                ...(data || {}),
                ...(actor ? {
                    actorId: actor.id,
                    actorUsername: actor.username,
                    actorDisplayName: actor.displayName || actor.username,
                    actorAvatar: actor.avatar || null,
                } : {}),
            };

            // 1. Save to database
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    title,
                    message,
                    type: type as any,
                    data: notificationData,
                },
            });

            // 2. Send via WebSocket for real-time UI update
            WebSocketService.sendToUser(userId, 'notification', {
                ...notification,
                data: notificationData,
            });

            // 3. Send push notification (auto-resolve token + consent if not provided)
            let effectivePushToken = pushToken ?? null;
            if (!effectivePushToken) {
                try {
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { expoPushToken: true, pushNotificationsConsent: true },
                    });
                    if (user?.pushNotificationsConsent && user.expoPushToken) {
                        effectivePushToken = user.expoPushToken;
                    }
                } catch (err) {
                    logger.warn('Failed to resolve push token for user:', { userId, err });
                }
            }

            if (effectivePushToken) {
                await PushNotificationService.sendNotification({
                    to: effectivePushToken,
                    title,
                    body: message,
                    ...(threadId ? { threadId } : {}),
                    channelId: resolveChannelId(type, channelId),
                    data: {
                        ...notificationData,
                        notificationId: notification.id,
                    },
                });
            }

            return notification;
        } catch (error) {
            logger.error('Error creating notification:', error);
            return null;
        }
    }

    /**
     * Create a social notification with actor info automatically fetched
     */
    static async createSocialNotification(params: {
        userId: string;
        actorId: string;
        title: string;
        message: string;
        type: string;
        data?: any;
        pushToken?: string | null;
    }) {
        try {
            // Fetch actor info
            const actor = await prisma.user.findUnique({
                where: { id: params.actorId },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true,
                },
            });

            if (!actor) {
                logger.error(`Actor not found: ${params.actorId}`);
                return null;
            }

            // Build threadId for iOS notification grouping
            const reelId = params.data?.reelId;
            const threadId = reelId
                ? `${params.userId}-${reelId}`
                : `${params.userId}-social`;

            return this.createNotification({
                ...params,
                threadId,
                actor: {
                    id: actor.id,
                    username: actor.username,
                    displayName: actor.displayName,
                    avatar: actor.avatar,
                },
            });
        } catch (error) {
            logger.error('Error creating social notification:', error);
            return null;
        }
    }
    static async createGoalNotification(
        userId: string,
        pushToken: string | null,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number,
        scoringTeam: 'home' | 'away',
        matchId: number
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchGoals) return null;

        const scorer = scoringTeam === 'home' ? homeTeam : awayTeam;
        const title = '⚽ هدف!';
        const message = `${scorer} سجل! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            channelId: 'match-updates',
            data: {
                type: 'MATCH_GOAL',
                matchId,
                fixtureId: matchId,
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
                scoringTeam
            }
        });
    }

    /**
     * Create match start notification
     */
    static async createMatchStartNotification(
        userId: string,
        pushToken: string | null,
        homeTeam: string,
        awayTeam: string,
        matchId: number
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchStart) return null;

        const title = '🏟️ بدأت المباراة!';
        const message = `${homeTeam} vs ${awayTeam} - المباراة بدأت الآن`;

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            data: {
                type: 'MATCH_START',
                matchId,
                fixtureId: matchId,
                homeTeam,
                awayTeam
            }
        });
    }

    /**
     * Create halthtime notification
     */
    static async createHalftimeNotification(
        userId: string,
        pushToken: string | null,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number,
        matchId: number
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchHalftime) return null;

        const title = '⏸️ نهاية الشوط الأول';
        const message = `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} (HT)`;

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            data: {
                type: 'MATCH_HALFTIME',
                matchId,
                fixtureId: matchId,
                homeTeam,
                awayTeam,
                homeScore,
                awayScore
            }
        });
    }

    /**
     * Create match end notification
     */
    static async createMatchEndNotification(
        userId: string,
        pushToken: string | null,
        homeTeam: string,
        awayTeam: string,
        homeScore: number,
        awayScore: number,
        matchId: number
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchEnd) return null;

        const title = '🏁 انتهت المباراة!';
        let result = 'تعادل';
        if (homeScore > awayScore) result = `فوز ${homeTeam}`;
        else if (awayScore > homeScore) result = `فوز ${awayTeam}`;

        const message = `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} | ${result}`;

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            data: {
                type: 'MATCH_END',
                matchId,
                fixtureId: matchId,
                homeTeam,
                awayTeam,
                homeScore,
                awayScore
            }
        });
    }

    /**
     * Send prediction result notification
     * ✅ NEW: Notify users about their prediction results
     */
    static async sendPredictionResultNotification(
        userId: string,
        isCorrect: boolean,
        matchInfo: string,
        coinsWon: number
    ) {
        try {
            const [user, prefs] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { expoPushToken: true, pushNotificationsConsent: true },
                }),
                getUserPreferences(userId),
            ]);

            if (prefs && !prefs.predictionResults) return null;

            const title = isCorrect ? '🎯 توقع صحيح!' : '❌ توقع خاطئ';
            const message = isCorrect
                ? `تهانينا! توقعك كان صحيحاً 🎉\n${matchInfo}\n+${coinsWon} تذاكر`
                : `للأسف توقعك كان خاطئاً\n${matchInfo}\nجرب حظك في المباراة الجاية! 🎯`;

            return this.createNotification({
                userId,
                pushToken: (user?.pushNotificationsConsent && user?.expoPushToken) ? user.expoPushToken : null,
                title,
                message,
                type: NotificationType.PREDICTION_RESULT,
                data: {
                    type: 'PREDICTION_RESULT',
                    isCorrect,
                    matchInfo,
                    coinsWon,
                    screen: '/(tabs)/matches',
                }
            });
        } catch (error) {
            logger.error('Error sending prediction result notification:', error);
            return null;
        }
    }
}
