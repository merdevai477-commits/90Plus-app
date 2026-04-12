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
}

export class NotificationService {
    /**
     * Create a notification and optionally send a push notification
     */
    static async createNotification(params: CreateNotificationParams) {
        try {
            const { userId, title, message, type, data, actor, pushToken } = params;

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

            return this.createNotification({
                ...params,
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

    /**
     * Create goal notification
     */
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
        const scorer = scoringTeam === 'home' ? homeTeam : awayTeam;
        const title = '⚽ هدف!';
        const message = `${scorer} سجل! ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            data: {
                type: 'MATCH_GOAL',
                matchId,
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
            // Get user's push token + consent
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { expoPushToken: true, pushNotificationsConsent: true },
            });

            const title = isCorrect ? '🎯 توقع صحيح!' : '❌ توقع خاطئ';
            const message = isCorrect
                ? `تهانينا! توقعك كان صحيحاً 🎉\n${matchInfo}\n+${coinsWon} تذاكر`
                : `للأسف، توقعك لم يكن صحيحاً\n${matchInfo}\nحظ أفضل المرة القادمة!`;

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
                }
            });
        } catch (error) {
            logger.error('Error sending prediction result notification:', error);
            return null;
        }
    }
}
