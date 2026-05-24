import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebSocketService } from './websocket.service';
import PushNotificationService from './push-notification.service';
import { renderPushTemplate, getUserLanguage } from './push-templates.service';

// Source of truth: this enum MUST stay in sync with the Prisma `NotificationType`
// enum at prisma/schema.prisma. Each new value here requires a migration that
// runs `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS ...` before the
// first row using it can be written.
export enum NotificationType {
    MATCH_UPDATE = 'MATCH_UPDATE',
    MATCH_GOAL = 'MATCH_GOAL',
    MATCH_START = 'MATCH_START',
    MATCH_END = 'MATCH_END',
    MATCH_HALFTIME = 'MATCH_HALFTIME',
    MATCH_FAVORITE = 'MATCH_FAVORITE',
    MATCH_YELLOW_CARD = 'MATCH_YELLOW_CARD',
    MATCH_RED_CARD = 'MATCH_RED_CARD',
    PREDICTION_RESULT = 'PREDICTION_RESULT',
    QUIZ_REWARD = 'QUIZ_REWARD',
    LEVEL_UP = 'LEVEL_UP',
    ACHIEVEMENT = 'ACHIEVEMENT',
    FOLLOW = 'FOLLOW',
    LIKE = 'LIKE',
    COMMENT = 'COMMENT',
    REPLY = 'REPLY',
    MENTION = 'MENTION',
    GIFT = 'GIFT',
    VIDEO_PROCESSED = 'VIDEO_PROCESSED',
    REPORT_RESOLVED = 'REPORT_RESOLVED',
    REPORT_SUBMITTED = 'REPORT_SUBMITTED',     // Confirmation to reporter
    MILESTONE = 'MILESTONE',
    COIN_MILESTONE = 'COIN_MILESTONE',
    GENERAL = 'GENERAL',
    MODERATION_ALERT = 'MODERATION_ALERT',
    // ── New triggers ──────────────────────────────────
    LUCKY_WHEEL = 'LUCKY_WHEEL',               // Lucky wheel spin result
    LUCKY_WHEEL_RENEWED = 'LUCKY_WHEEL_RENEWED', // Daily wheel reset / availability
    COMMENT_LIKE = 'COMMENT_LIKE',             // Like on a comment
    FOLLOW_ACTIVITY = 'FOLLOW_ACTIVITY',       // Someone you follow uploaded a new video
    LEADERBOARD_TOP10 = 'LEADERBOARD_TOP10',   // User entered top 10 ranking
    LEADERBOARD_TOP3 = 'LEADERBOARD_TOP3',     // User entered top 3 (elite)
    RE_ENGAGEMENT = 'RE_ENGAGEMENT',           // Re-engagement motivational push
    SHARE = 'SHARE',                           // Someone shared your reel
    AVATAR_UPLOAD = 'AVATAR_UPLOAD',           // Avatar upload completed / failed
    AI_CHECKIN = 'AI_CHECKIN',                 // 12-hourly AI coach check-in
    COOLDOWN_EXPIRED = 'COOLDOWN_EXPIRED',     // Avatar/cover/reel/username cooldown ended
    DAILY_QUIZ_RENEWED = 'DAILY_QUIZ_RENEWED', // Daily quiz pack ready
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
        case 'COMMENT_LIKE':
        case 'SHARE':
        case 'FOLLOW_ACTIVITY':
            return 'social';
        case 'MATCH_UPDATE':
        case 'MATCH_GOAL':
        case 'MATCH_START':
        case 'MATCH_END':
        case 'MATCH_HALFTIME':
        case 'MATCH_FAVORITE':
        case 'MATCH_YELLOW_CARD':
        case 'MATCH_RED_CARD':
            return 'match-updates';
        case 'VIDEO_PROCESSED':
            return 'general';
        case 'GIFT':
        case 'COIN_MILESTONE':
        case 'MILESTONE':
        case 'LUCKY_WHEEL':
        case 'LEADERBOARD_TOP10':
        case 'RE_ENGAGEMENT':
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
                    // Only push if the user has given consent and has a valid token.
                    if (user?.pushNotificationsConsent && user?.expoPushToken) {
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
        matchId: number,
        extras?: {
            homeTeamLogo?: string | null;
            awayTeamLogo?: string | null;
            leagueName?: string | null;
            matchDate?: Date | string | null;
        }
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchGoals) return null;

        const scorer = scoringTeam === 'home' ? homeTeam : awayTeam;
        const lang = await getUserLanguage(userId);
        const title = renderPushTemplate('goalTitle', lang);
        const message = `${scorer} — ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`;

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            channelId: 'match-updates',
            data: {
                type: 'MATCH_GOAL',
                matchId: String(matchId),
                fixtureId: String(matchId),
                homeTeam,
                awayTeam,
                homeTeamLogo: extras?.homeTeamLogo ?? '',
                awayTeamLogo: extras?.awayTeamLogo ?? '',
                leagueName: extras?.leagueName ?? '',
                matchDate: extras?.matchDate
                    ? (extras.matchDate instanceof Date
                        ? extras.matchDate.toISOString().split('T')[0]
                        : String(extras.matchDate))
                    : '',
                homeScore,
                awayScore,
                scoringTeam,
                screen: '/(tabs)/match-details',
                priority: 'high', // Ensures iOS/Android don't silently drop this notification
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
        matchId: number,
        extras?: {
            homeTeamLogo?: string | null;
            awayTeamLogo?: string | null;
            leagueName?: string | null;
            matchDate?: Date | string | null;
        }
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchStart) return null;

        const lang = await getUserLanguage(userId);
        const title = renderPushTemplate('matchStartTitle', lang);
        const message = renderPushTemplate('matchStartBody', lang, {
            home: homeTeam,
            away: awayTeam,
            minutes: 0,
        });

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            channelId: 'match-updates',
            data: {
                type: 'MATCH_START',
                matchId: String(matchId),
                fixtureId: String(matchId),
                homeTeam,
                awayTeam,
                homeTeamLogo: extras?.homeTeamLogo ?? '',
                awayTeamLogo: extras?.awayTeamLogo ?? '',
                leagueName: extras?.leagueName ?? '',
                matchDate: extras?.matchDate
                    ? (extras.matchDate instanceof Date
                        ? extras.matchDate.toISOString().split('T')[0]
                        : String(extras.matchDate))
                    : '',
                screen: '/(tabs)/match-details',
                priority: 'high',
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
        matchId: number,
        extras?: {
            homeTeamLogo?: string | null;
            awayTeamLogo?: string | null;
            leagueName?: string | null;
            matchDate?: Date | string | null;
        }
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchHalftime) return null;

        const lang = await getUserLanguage(userId);
        const title = renderPushTemplate('halftimeTitle', lang);
        const message = renderPushTemplate('halftimeBody', lang, {
            home: homeTeam,
            away: awayTeam,
            homeScore,
            awayScore,
        });

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            channelId: 'match-updates',
            data: {
                type: 'MATCH_HALFTIME',
                matchId: String(matchId),
                fixtureId: String(matchId),
                homeTeam,
                awayTeam,
                homeTeamLogo: extras?.homeTeamLogo ?? '',
                awayTeamLogo: extras?.awayTeamLogo ?? '',
                leagueName: extras?.leagueName ?? '',
                matchDate: extras?.matchDate
                    ? (extras.matchDate instanceof Date
                        ? extras.matchDate.toISOString().split('T')[0]
                        : String(extras.matchDate))
                    : '',
                homeScore,
                awayScore,
                screen: '/(tabs)/match-details',
                priority: 'high',
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
        matchId: number,
        extras?: {
            homeTeamLogo?: string | null;
            awayTeamLogo?: string | null;
            leagueName?: string | null;
            matchDate?: Date | string | null;
        }
    ) {
        const prefs = await getUserPreferences(userId);
        if (prefs && !prefs.matchEnd) return null;

        const lang = await getUserLanguage(userId);
        const title = renderPushTemplate('fulltimeTitle', lang);
        const message = renderPushTemplate('fulltimeBody', lang, {
            home: homeTeam,
            away: awayTeam,
            homeScore,
            awayScore,
        });

        return this.createNotification({
            userId,
            pushToken,
            title,
            message,
            type: NotificationType.MATCH_UPDATE,
            channelId: 'match-updates',
            data: {
                type: 'MATCH_END',
                matchId: String(matchId),
                fixtureId: String(matchId),
                homeTeam,
                awayTeam,
                homeTeamLogo: extras?.homeTeamLogo ?? '',
                awayTeamLogo: extras?.awayTeamLogo ?? '',
                leagueName: extras?.leagueName ?? '',
                matchDate: extras?.matchDate
                    ? (extras.matchDate instanceof Date
                        ? extras.matchDate.toISOString().split('T')[0]
                        : String(extras.matchDate))
                    : '',
                homeScore,
                awayScore,
                screen: '/(tabs)/match-details',
                priority: 'high',
            }
        });
    }

    /**
     * Send prediction result notification
     * ✅ NEW: Notify users about their prediction results
     * When `match` metadata is provided, the notification deep-links to the
     * match-details screen so the user lands on the right match. Otherwise it
     * falls back to the matches hub.
     */
    static async sendPredictionResultNotification(
        userId: string,
        isCorrect: boolean,
        matchInfo: string,
        coinsWon: number,
        match?: {
            fixtureId?: number | string | null;
            homeTeam?: string | null;
            awayTeam?: string | null;
            homeTeamLogo?: string | null;
            awayTeamLogo?: string | null;
            leagueName?: string | null;
            matchDate?: Date | string | null;
            homeScore?: number | null;
            awayScore?: number | null;
        }
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

            const lang = await getUserLanguage(userId);
            const title = isCorrect
                ? renderPushTemplate('predictionWinTitle', lang)
                : renderPushTemplate('predictionLossTitle', lang);
            const message = isCorrect
                ? `${renderPushTemplate('predictionWinBody', lang, { coins: coinsWon, match: matchInfo })}`
                : `${renderPushTemplate('predictionLossBody', lang, { match: matchInfo })}`;

            const fixtureId = match?.fixtureId != null ? String(match.fixtureId) : '';
            const matchDate = match?.matchDate
                ? (match.matchDate instanceof Date
                    ? match.matchDate.toISOString().split('T')[0]
                    : String(match.matchDate))
                : '';

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
                    // Always include — empty strings when unavailable so the
                    // mobile deep-link handler can decide whether to open
                    // match-details or fall back to /(tabs)/matches.
                    matchId: fixtureId,
                    fixtureId,
                    homeTeam: match?.homeTeam ?? '',
                    awayTeam: match?.awayTeam ?? '',
                    homeTeamLogo: match?.homeTeamLogo ?? '',
                    awayTeamLogo: match?.awayTeamLogo ?? '',
                    leagueName: match?.leagueName ?? '',
                    matchDate,
                    homeScore: match?.homeScore ?? null,
                    awayScore: match?.awayScore ?? null,
                    screen: fixtureId ? '/(tabs)/match-details' : '/(tabs)/matches',
                }
            });
        } catch (error) {
            logger.error('Error sending prediction result notification:', error);
            return null;
        }
    }
}
