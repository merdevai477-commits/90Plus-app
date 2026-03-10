import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { logger } from '../utils/logger';

// Create a new Expo SDK client
const expo = new Expo();

export interface PushNotificationPayload {
    to: string; // Expo Push Token
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    badge?: number;
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

            const message: ExpoPushMessage = {
                to: payload.to,
                sound: payload.sound || 'default',
                title: payload.title,
                body: payload.body,
                data: payload.data || {},
                badge: payload.badge,
            };

            const chunks = expo.chunkPushNotifications([message]);
            
            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    logger.info('Push notification sent:', ticketChunk);
                    
                    // Check for errors
                    for (const ticket of ticketChunk) {
                        if ((ticket as any).status === 'error') {
                            logger.error('Push notification error:', (ticket as any).message);
                            return false;
                        }
                    }
                } catch (error) {
                    logger.error('Error sending push notification chunk:', error);
                    return false;
                }
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

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                
                for (const ticket of ticketChunk) {
                    if ((ticket as any).status === 'ok') {
                        success++;
                    } else {
                        failed++;
                        logger.error('Push error:', (ticket as any).message);
                    }
                }
            } catch (error) {
                logger.error('Chunk send error:', error);
                failed += chunk.length;
            }
        }

        return { success, failed };
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
