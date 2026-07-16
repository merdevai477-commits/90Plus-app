/**
 * Present a system-tray notification (same UX as reel upload success).
 * Used as fallback when WebSocket delivers an inbox event but remote push
 * did not surface, and for mirroring social alerts while the app is open.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from './logger';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
let cachedModule: NotificationsModule | null | undefined;

function getNotificationsModule(): NotificationsModule | null {
    if (Platform.OS === 'web') return null;
    if (isExpoGo) return null;
    if (cachedModule !== undefined) return cachedModule;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedModule = require('expo-notifications') as NotificationsModule;
    } catch {
        cachedModule = null;
    }
    return cachedModule;
}

function resolveChannelId(type?: string): string {
    if (!type) return 'default';
    if (
        type === 'LIKE' ||
        type === 'COMMENT' ||
        type === 'REPLY' ||
        type === 'MENTION' ||
        type === 'FOLLOW' ||
        type === 'SHARE' ||
        type === 'COMMENT_LIKE'
    ) {
        return 'social-v2';
    }
    if (type.includes('MATCH') || type.includes('PREDICTION')) return 'match-updates-v2';
    return 'general-v2';
}

const recentNotificationIds = new Map<string, number>();
const DEDUP_MS = 8000;

export function markTrayNotificationPresented(notificationId: string): void {
    recentNotificationIds.set(notificationId, Date.now());
}

function shouldSkipDuplicate(notificationId?: string): boolean {
    if (!notificationId) return false;
    const seenAt = recentNotificationIds.get(notificationId);
    const now = Date.now();
    if (seenAt != null && now - seenAt < DEDUP_MS) return true;
    recentNotificationIds.set(notificationId, now);
    if (recentNotificationIds.size > 200) {
        for (const [id, ts] of recentNotificationIds) {
            if (now - ts > DEDUP_MS) recentNotificationIds.delete(id);
        }
    }
    return false;
}

export async function presentTrayNotification(params: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    channelId?: string;
}): Promise<void> {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        const notificationId =
            typeof params.data?.notificationId === 'string'
                ? params.data.notificationId
                : undefined;
        if (shouldSkipDuplicate(notificationId)) return;

        const type = typeof params.data?.type === 'string' ? params.data.type : undefined;
        const channelId = params.channelId ?? resolveChannelId(type);

        await Notifications.scheduleNotificationAsync({
            content: {
                title: params.title,
                body: params.body,
                sound: true,
                data: params.data ?? {},
                ...(Platform.OS === 'android'
                    ? {
                          channelId,
                          priority: Notifications.AndroidNotificationPriority.MAX,
                      }
                    : {}),
            },
            trigger: null,
        });
    } catch (err) {
        logger.warn('[trayNotification] present failed:', err);
    }
}
