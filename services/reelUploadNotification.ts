import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { logger } from './logger';

const CHANNEL_ID = 'reel-upload';
const ACTIVE_REQUEST_ID = 'reel-upload-active-session';

let lastPresentedId: string | null = null;
let lastProgressRounded = -1;

async function ensureChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'رفع الريلز',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        enableVibrate: true,
    });
}

async function ensurePermission(): Promise<boolean> {
    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    } catch (e) {
        logger.warn('[reelUploadNotification] permission:', e);
        return false;
    }
}

async function dismissTracked(): Promise<void> {
    if (!lastPresentedId) return;
    try {
        await Notifications.dismissNotificationAsync(lastPresentedId);
    } catch {
        /* already dismissed */
    }
    lastPresentedId = null;
}

function androidExtras() {
    if (Platform.OS !== 'android') return {};
    return {
        android: {
            channelId: CHANNEL_ID,
            sticky: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
        },
    };
}

/**
 * إشعار محلي (ليس Push) يوضح للمستخدم أن الريلز يُرفع، بما في ذلك في الخلفية.
 */
export const reelUploadNotification = {
    async begin(): Promise<void> {
        if (Platform.OS === 'web') return;
        lastProgressRounded = -1;
        const ok = await ensurePermission();
        if (!ok) return;
        await ensureChannel();
        await dismissTracked();
        try {
            lastPresentedId = await Notifications.scheduleNotificationAsync({
                identifier: ACTIVE_REQUEST_ID,
                content: {
                    title: 'جاري رفع الريلز',
                    body: 'يتم تحضير الفيديو والرفع…',
                    sound: 'default',
                    data: { type: 'reel_upload_progress' },
                    ...androidExtras(),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] begin failed:', e);
        }
    },

    /**
     * تحديث نص التقدّم؛ يُخفّف الضجيج (لا يحدّث الإشعار إلا كل ~8٪).
     */
    async updateProgress(progress: number, phaseLabel: string): Promise<void> {
        if (Platform.OS === 'web') return;
        const rounded = Math.min(100, Math.max(0, Math.round(progress)));
        const jump = Math.abs(rounded - lastProgressRounded);
        if (jump < 8 && rounded > 0 && rounded < 100) return;
        lastProgressRounded = rounded;

        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') return;

        await ensureChannel();
        await dismissTracked();
        try {
            lastPresentedId = await Notifications.scheduleNotificationAsync({
                identifier: ACTIVE_REQUEST_ID,
                content: {
                    title: 'جاري رفع الريلز',
                    body: `${phaseLabel} — ${rounded}٪`,
                    sound: 'default',
                    data: { type: 'reel_upload_progress', progress: rounded },
                    ...androidExtras(),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] update failed:', e);
        }
    },

    async success(message = 'تم نشر الريلز في ملفك الشخصي.'): Promise<void> {
        if (Platform.OS === 'web') return;
        lastProgressRounded = -1;
        await dismissTracked();
        try {
            await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID);
        } catch {
            /* */
        }
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') return;
        await ensureChannel();
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'تم رفع الريلز',
                    body: message,
                    sound: 'default',
                    data: { type: 'reel_upload_ok' },
                    ...(Platform.OS === 'android'
                        ? {
                              android: {
                                  channelId: CHANNEL_ID,
                                  sticky: false,
                                  priority: Notifications.AndroidNotificationPriority.HIGH,
                              },
                          }
                        : {}),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] success failed:', e);
        }
    },

    async failure(message: string): Promise<void> {
        if (Platform.OS === 'web') return;
        lastProgressRounded = -1;
        await dismissTracked();
        try {
            await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID);
        } catch {
            /* */
        }
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') return;
        await ensureChannel();
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'فشل رفع الريلز',
                    body: message,
                    sound: 'default',
                    data: { type: 'reel_upload_error' },
                    ...(Platform.OS === 'android'
                        ? {
                              android: {
                                  channelId: CHANNEL_ID,
                                  sticky: false,
                                  priority: Notifications.AndroidNotificationPriority.DEFAULT,
                              },
                          }
                        : {}),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] failure failed:', e);
        }
    },

    async clear(): Promise<void> {
        lastProgressRounded = -1;
        await dismissTracked();
        try {
            await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID);
        } catch {
            /* */
        }
    },
};
