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
    FOLLOW = 'FOLLOW',
    LIKE = 'LIKE',
    COMMENT = 'COMMENT',
    REPLY = 'REPLY',
    MENTION = 'MENTION',
    GENERAL = 'GENERAL'
}

export interface CreateNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: string;
    data?: any;
    pushToken?: string | null;
}

export class NotificationService {
    /**
     * Create a notification and optionally send a push notification
     */
    static async createNotification(params: CreateNotificationParams) {
        try {
            const { userId, title, message, type, data, pushToken } = params;

            // 1. Save to database
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    title,
                    message,
                    type: type as any,
                    data: data || {},
                },
            });

            // 2. Send via WebSocket for real-time UI update
            WebSocketService.sendToUser(userId, 'notification', notification);

            // 3. Send push notification if token available
            if (pushToken) {
                await PushNotificationService.sendNotification({
                    to: pushToken,
                    title,
                    body: message,
                    data: {
                        ...data,
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
}
