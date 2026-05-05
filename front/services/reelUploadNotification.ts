import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { logger } from './logger';

const CHANNEL_ID = 'reel-upload';
const CHANNEL_ID_RESULT = 'reel-upload-result';
const ACTIVE_REQUEST_ID = 'reel-upload-active-session';

let lastProgressRounded = -1;
type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;
const isExpoGo = Constants.appOwnership === 'expo';

if (Platform.OS !== 'web' && !isExpoGo) {
    try {
        Notifications = require('expo-notifications') as NotificationsModule;
    } catch {
        Notifications = null;
    }
}

async function ensureChannels(): Promise<void> {
    if (!Notifications) return;
    if (Platform.OS !== 'android') return;
    // Silent channel for progress updates (no sound, no vibration)
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'رفع الريلز - التقدم',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [],
        enableVibrate: false,
        sound: null,
        showBadge: false,
    });
    // Loud channel for success/failure only
    await Notifications.setNotificationChannelAsync(CHANNEL_ID_RESULT, {
        name: 'رفع الريلز - النتيجة',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        enableVibrate: true,
        showBadge: true,
    });
}

async function ensurePermission(): Promise<boolean> {
    if (!Notifications) return false;

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

/**
 * إشعار محلي (ليس Push) يوضح للمستخدم أن الريلز يُرفع، بما في ذلك في الخلفية.
 * - begin()         → إشعار واحد صامت (بدون صوت أو اهتزاز)
 * - updateProgress() → يُحدّث نص الإشعار الصامت فقط كل 15٪
 * - success()       → إشعار جديد بصوت واهتزاز
 * - failure()       → إشعار جديد بصوت واهتزاز
 */
export const reelUploadNotification = {
    async begin(): Promise<void> {
        if (Platform.OS === 'web' || !Notifications) return;
        lastProgressRounded = -1;
        const ok = await ensurePermission();
        if (!ok) return;
        await ensureChannels();

        // Cancel any old one first
        try { await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }

        try {
            await Notifications.scheduleNotificationAsync({
                identifier: ACTIVE_REQUEST_ID,
                content: {
                    title: '📤 جاري رفع الريلز',
                    body: 'يتم تحضير الفيديو…',
                    sound: null,           // ✅ NO SOUND on start
                    data: { type: 'reel_upload_progress' },
                    ...(Platform.OS === 'android' ? {
                        android: {
                            channelId: CHANNEL_ID,  // silent channel
                            ongoing: true,           // stays visible during upload
                            sticky: false,
                            priority: Notifications.AndroidNotificationPriority.LOW,
                        },
                    } : {}),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] begin failed:', e);
        }
    },

    /**
     * تحديث نص التقدّم؛ يُحدّث فقط كل ~15٪ وبدون صوت أو اهتزاز.
     */
    async updateProgress(progress: number, phaseLabel: string): Promise<void> {
        if (Platform.OS === 'web' || !Notifications) return;
        const rounded = Math.min(100, Math.max(0, Math.round(progress)));
        const jump = Math.abs(rounded - lastProgressRounded);

        // Only update every 15% — no sound either way
        if (jump < 15 && rounded > 0 && rounded < 100) return;
        lastProgressRounded = rounded;

        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') return;

        try {
            // Replace existing notification in-place (same identifier = no new pop)
            await Notifications.scheduleNotificationAsync({
                identifier: ACTIVE_REQUEST_ID,
                content: {
                    title: `📤 جاري رفع الريلز — ${rounded}٪`,
                    body: phaseLabel,
                    sound: null,           // ✅ NEVER make sound during progress
                    data: { type: 'reel_upload_progress', progress: rounded },
                    ...(Platform.OS === 'android' ? {
                        android: {
                            channelId: CHANNEL_ID,
                            ongoing: true,
                            sticky: false,
                            priority: Notifications.AndroidNotificationPriority.LOW,
                        },
                    } : {}),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] update failed:', e);
        }
    },

    async success(message = 'تم نشر الريلز في ملفك الشخصي! 🎉'): Promise<void> {
        if (Platform.OS === 'web' || !Notifications) return;
        lastProgressRounded = -1;

        // Remove the ongoing progress notification
        try { await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }
        try { await Notifications.dismissNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }

        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') return;
        await ensureChannels();

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '✅ تم رفع الريلز!',
                    body: message,
                    sound: 'default',      // ✅ YES sound on success
                    data: { type: 'reel_upload_ok' },
                    ...(Platform.OS === 'android' ? {
                        android: {
                            channelId: CHANNEL_ID_RESULT,  // loud channel
                            sticky: false,
                            priority: Notifications.AndroidNotificationPriority.HIGH,
                        },
                    } : {}),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] success failed:', e);
        }
    },

    async failure(message: string): Promise<void> {
        if (Platform.OS === 'web' || !Notifications) return;
        lastProgressRounded = -1;

        // Remove the ongoing progress notification
        try { await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }
        try { await Notifications.dismissNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }

        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') return;
        await ensureChannels();

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '❌ فشل رفع الريلز',
                    body: message,
                    sound: 'default',       // ✅ YES sound on failure
                    data: { type: 'reel_upload_error' },
                    ...(Platform.OS === 'android' ? {
                        android: {
                            channelId: CHANNEL_ID_RESULT,
                            sticky: false,
                            priority: Notifications.AndroidNotificationPriority.DEFAULT,
                        },
                    } : {}),
                },
                trigger: null,
            });
        } catch (e) {
            logger.warn('[reelUploadNotification] failure failed:', e);
        }
    },

    async clear(): Promise<void> {
        if (!Notifications) return;
        lastProgressRounded = -1;
        try { await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }
        try { await Notifications.dismissNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }
    },
};
