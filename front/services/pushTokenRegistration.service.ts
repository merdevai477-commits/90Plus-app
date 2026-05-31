/**
 * Central push-token registration for remote notifications.
 *
 * Local notifications (e.g. reel upload progress) only need OS permission.
 * Remote push (likes, follows, matches, etc.) also requires an Expo push
 * token stored on the backend with pushNotificationsConsent = true.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { MatchesService } from '../src/services/authService';
import { logger } from './logger';
import { getApiUrl } from '../config/api.config';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
let cachedNotifications: NotificationsModule | null | undefined;

export const PENDING_PUSH_TOKEN_KEY = '@90plus/pendingExpoPushToken';

function loadNotifications(): NotificationsModule | null {
    if (Platform.OS === 'web') return null;
    if (isExpoGo) return null;
    if (cachedNotifications !== undefined) return cachedNotifications;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedNotifications = require('expo-notifications') as NotificationsModule;
    } catch {
        cachedNotifications = null;
    }
    return cachedNotifications;
}

export function isPushRegistrationAvailable(): boolean {
    return !!loadNotifications() && Device.isDevice;
}

async function setupAndroidChannels(Notifications: NotificationsModule): Promise<void> {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
        name: 'إشعارات عامة',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#32cd32',
        sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('match-updates', {
        name: 'تحديثات المباريات',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#22c55e',
        sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('social', {
        name: 'تفاعلات اجتماعية',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#a855f7',
        sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('general', {
        name: 'إشعارات التطبيق',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#32cd32',
        sound: 'default',
    });
}

/** Read Expo push token when OS permission is already granted. */
export async function getExpoPushTokenIfPermitted(): Promise<string | null> {
    if (!Device.isDevice) {
        logger.debug('Push notifications require a physical device');
        return null;
    }

    const Notifications = loadNotifications();
    if (!Notifications) return null;

    try {
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== 'granted') {
            if (__DEV__) {
                const projectId =
                    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
                console.log('[PushAudit]', JSON.stringify({
                    permissions: perm.status,
                    projectId: projectId ?? null,
                    expoPushToken: null,
                }));
            }
            return null;
        }

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = pushTokenData.data;

        await setupAndroidChannels(Notifications);
        logger.debug('📱 Expo push token obtained:', token.substring(0, 25));
        if (__DEV__) {
            console.log('[PushAudit]', JSON.stringify({
                permissions: 'granted',
                projectId: projectId ?? null,
                expoPushToken: token.substring(0, 30) + '...',
            }));
        }
        return token;
    } catch (error) {
        logger.error('Error getting push token:', error);
        return null;
    }
}

export async function persistPendingPushToken(token: string): Promise<void> {
    try {
        await AsyncStorage.setItem(PENDING_PUSH_TOKEN_KEY, token);
    } catch (err) {
        logger.warn('Failed to persist pending push token:', err);
    }
}

export async function clearPendingPushToken(): Promise<void> {
    try {
        await AsyncStorage.removeItem(PENDING_PUSH_TOKEN_KEY);
    } catch {
        /* non-fatal */
    }
}

export async function updatePushNotificationsConsent(
    authToken: string,
    granted: boolean,
): Promise<void> {
    try {
        const apiUrl = getApiUrl();
        await fetch(`${apiUrl}/gdpr/consent`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                consentType: 'PUSH_NOTIFICATIONS',
                granted,
            }),
        });
    } catch (err) {
        logger.warn('Failed to sync push consent with backend:', err);
    }
}

async function registerTokenWithBackend(
    authToken: string,
    pushToken: string,
    attempt = 0,
): Promise<boolean> {
    try {
        const success = await MatchesService.registerPushToken(authToken, pushToken);
        if (success) {
            logger.debug('✅ Push token synced with backend');
            await clearPendingPushToken();
            return true;
        }
        throw new Error('Backend rejected token sync');
    } catch (err: unknown) {
        logger.error(`❌ Push token sync failed (attempt ${attempt}):`, err);
        if (attempt < 3) {
            const delay = Math.pow(2, attempt) * 2000;
            await new Promise((r) => setTimeout(r, delay));
            return registerTokenWithBackend(authToken, pushToken, attempt + 1);
        }
        try {
            const Sentry = await import('@sentry/react-native');
            Sentry.captureException(err, {
                tags: { component: 'PushNotifications', action: 'syncToken' },
                extra: { tokenPrefix: pushToken.substring(0, 20) },
            });
        } catch {
            /* Sentry may not be initialized */
        }
        return false;
    }
}

/** Sync token to backend; updates consent when auth is available. */
export async function syncExpoPushToken(
    getAuthToken: () => Promise<string | null>,
): Promise<boolean> {
    const pushToken = await getExpoPushTokenIfPermitted();
    if (!pushToken) return false;

    const authToken = await getAuthToken();
    if (!authToken) {
        await persistPendingPushToken(pushToken);
        return false;
    }

    await updatePushNotificationsConsent(authToken, true);
    return registerTokenWithBackend(authToken, pushToken);
}

/** Re-register when permission is already granted (inbox focus, foreground, etc.). */
export async function syncExpoPushTokenIfGranted(
    getAuthToken: () => Promise<string | null>,
): Promise<void> {
    if (!isPushRegistrationAvailable()) return;
    await syncExpoPushToken(getAuthToken);
}

/** Flush a token captured before sign-in once the user logs in. */
export async function flushPendingPushToken(
    getAuthToken: () => Promise<string | null>,
): Promise<boolean> {
    try {
        const pending = await AsyncStorage.getItem(PENDING_PUSH_TOKEN_KEY);
        if (!pending) return false;

        const authToken = await getAuthToken();
        if (!authToken) return false;

        await updatePushNotificationsConsent(authToken, true);
        return registerTokenWithBackend(authToken, pending);
    } catch (err) {
        logger.warn('Failed to flush pending push token:', err);
        return false;
    }
}

/**
 * Call after OS notification permission is granted (modal, reel upload, settings).
 * Registers token immediately when signed in; otherwise stores pending token.
 */
export async function capturePushTokenAfterPermission(
    getAuthToken?: () => Promise<string | null>,
): Promise<string | null> {
    const pushToken = await getExpoPushTokenIfPermitted();
    if (!pushToken) return null;

    if (getAuthToken) {
        const authToken = await getAuthToken();
        if (authToken) {
            await updatePushNotificationsConsent(authToken, true);
            await registerTokenWithBackend(authToken, pushToken);
        } else {
            await persistPendingPushToken(pushToken);
        }
    } else {
        await persistPendingPushToken(pushToken);
    }

    return pushToken;
}

export { loadNotifications };
