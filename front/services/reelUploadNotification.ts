/**
 * reelUploadNotification
 *
 * Foreground/background notifications that keep the user informed about
 * an in-progress reel upload. Uses a silent channel for progress updates
 * and a loud channel for success/failure results.
 *
 * SDK 55 note:
 *  - We dynamically `require('expo-notifications')` on first use instead of
 *    importing at the top of the file. The push-token auto-registration
 *    side-effect inside `expo-notifications` throws in Expo Go as of
 *    SDK 53 ("Android Push notifications ... was removed from Expo Go"),
 *    and a top-level import would make the whole app crash.
 *  - In Expo Go we turn every method into a no-op.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from './logger';

const CHANNEL_ID = 'reel-upload';
const CHANNEL_ID_RESULT = 'reel-upload-result';
const ACTIVE_REQUEST_ID = 'reel-upload-active-session';

let lastProgressRounded = -1;

type NotificationsModule = typeof import('expo-notifications');

/** True when the app is running inside Expo Go (not a development/production build). */
const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Lazy-load expo-notifications only when we actually need it and only on
 * devices where the native module is available. Returns `null` in Expo Go
 * or on web.
 */
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

async function ensureChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const Notifications = getNotificationsModule();
    if (!Notifications) return;
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
    const Notifications = getNotificationsModule();
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
 * Local-only notifications that inform the user about an in-progress reel
 * upload (including while the app is backgrounded).
 *
 * - begin()          → single silent notification (no sound/vibration)
 * - updateProgress() → updates the same silent notification every ~15 %
 * - success()        → fires a new notification with sound + vibration
 * - failure()        → fires a new notification with sound + vibration
 * - clear()          → removes any pending/visible progress notification
 *
 * All methods degrade to no-ops in Expo Go / on web.
 */
export const reelUploadNotification = {
    async begin(): Promise<void> {
        if (Platform.OS === 'web') return;
        const Notifications = getNotificationsModule();
        if (!Notifications) return;

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
     * Update progress text; only actually posts every ~15 % and never plays
     * sound/vibration.
     */
    async updateProgress(progress: number, phaseLabel: string): Promise<void> {
        if (Platform.OS === 'web') return;
        const Notifications = getNotificationsModule();
        if (!Notifications) return;

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
        if (Platform.OS === 'web') return;
        const Notifications = getNotificationsModule();
        if (!Notifications) return;

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
        if (Platform.OS === 'web') return;
        const Notifications = getNotificationsModule();
        if (!Notifications) return;

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
        const Notifications = getNotificationsModule();
        if (!Notifications) return;
        lastProgressRounded = -1;
        try { await Notifications.cancelScheduledNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }
        try { await Notifications.dismissNotificationAsync(ACTIVE_REQUEST_ID); } catch { /* */ }
    },
};
