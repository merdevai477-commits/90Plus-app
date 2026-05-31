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
import { pushTrace } from '../utils/pushTrace';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
let cachedNotifications: NotificationsModule | null | undefined;

/** One in-flight backend sync per session — avoids duplicate POST /push-token on startup */
let inFlightPushSync: Promise<boolean> | null = null;
let lastSyncedPushToken: string | null = null;

export const PENDING_PUSH_TOKEN_KEY = '@90plus/pendingExpoPushToken';

function ownershipLabel(): string {
    const o = Constants.appOwnership;
    if (o === 'expo' || o === 'standalone' || o === 'guest') return o;
    return o ?? 'null';
}

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
    pushTrace('[PUSH TRACE] start');
    pushTrace(`[PUSH TRACE] platform=${Platform.OS}`);
    pushTrace(`[PUSH TRACE] appOwnership=${ownershipLabel()}`);
    pushTrace(`[PUSH TRACE] isDevice=${String(Device.isDevice)}`);

    if (!Device.isDevice) {
        pushTrace('[PUSH TRACE] EXIT → reason: Device.isDevice=false');
        logger.debug('Push notifications require a physical device');
        return null;
    }

    const Notifications = loadNotifications();
    if (!Notifications) {
        if (Platform.OS === 'web') {
            pushTrace('[PUSH TRACE] EXIT → reason: Platform.OS=web');
        } else if (isExpoGo) {
            pushTrace('[PUSH TRACE] EXIT → reason: Expo Go (appOwnership=expo, no remote push)');
        } else {
            pushTrace('[PUSH TRACE] EXIT → reason: expo-notifications module unavailable');
        }
        return null;
    }

    try {
        const perm = await Notifications.getPermissionsAsync();
        pushTrace(`[PUSH TRACE] permissions=${perm.status}`);

        if (perm.status !== 'granted') {
            pushTrace('[PUSH TRACE] EXIT → reason: permission denied');
            return null;
        }

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        pushTrace(`[PUSH TRACE] projectId=${projectId ?? 'undefined'}`);
        pushTrace('[PUSH TRACE] before getExpoPushTokenAsync');

        let token: string;
        try {
            const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            token = pushTokenData.data;
            pushTrace(`[PUSH TRACE] token=${token}`);
        } catch (tokenErr: unknown) {
            const msg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
            pushTrace(`[PUSH TRACE] token=error:${msg}`);
            pushTrace('[PUSH TRACE] EXIT → reason: getExpoPushTokenAsync failed');
            logger.error('Error getting push token:', tokenErr);
            return null;
        }

        await setupAndroidChannels(Notifications);
        logger.debug('📱 Expo push token obtained:', token.substring(0, 25));
        return token;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        pushTrace(`[PUSH TRACE] token=error:${msg}`);
        pushTrace('[PUSH TRACE] EXIT → reason: unexpected error in getExpoPushTokenIfPermitted');
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
    if (lastSyncedPushToken === pushToken && attempt === 0) {
        pushTrace('[PUSH TRACE] skip registerPushToken — already synced this token');
        return true;
    }

    pushTrace('[PUSH TRACE] before registerPushToken API call');
    try {
        const result = await MatchesService.registerPushToken(authToken, pushToken);
        if (result.success) {
            pushTrace('[PUSH TRACE] registerPushToken response=success');
            logger.debug('✅ Push token synced with backend');
            lastSyncedPushToken = pushToken;
            await clearPendingPushToken();
            pushTrace('[PUSH TRACE] success ✓');
            return true;
        }
        if (result.rateLimited) {
            pushTrace('[PUSH TRACE] registerPushToken response=429 (no retry)');
            logger.warn('Push token sync rate-limited; will retry on next foreground');
            return false;
        }
        pushTrace('[PUSH TRACE] registerPushToken response=failed (non-SUCCESS body)');
        throw new Error('Backend rejected token sync');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pushTrace(`[PUSH TRACE] registerPushToken response=error:${msg}`);
        logger.error(`❌ Push token sync failed (attempt ${attempt}):`, err);
        if (attempt < 2) {
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
        pushTrace('[PUSH TRACE] EXIT → reason: registerPushToken failed after retries');
        return false;
    }
}

/** Sync token to backend; updates consent when auth is available. */
export async function syncExpoPushToken(
    getAuthToken: () => Promise<string | null>,
): Promise<boolean> {
    if (inFlightPushSync) {
        pushTrace('[PUSH TRACE] reusing in-flight syncExpoPushToken');
        return inFlightPushSync;
    }

    inFlightPushSync = (async () => {
        pushTrace('[PUSH TRACE] syncExpoPushToken() start');
        const pushToken = await getExpoPushTokenIfPermitted();
        if (!pushToken) {
            pushTrace('[PUSH TRACE] EXIT → reason: syncExpoPushToken — no token from getExpoPushTokenIfPermitted');
            return false;
        }

        const authToken = await getAuthToken();
        if (!authToken) {
            pushTrace('[PUSH TRACE] EXIT → reason: syncExpoPushToken — no auth token, persisted pending');
            await persistPendingPushToken(pushToken);
            return false;
        }

        await updatePushNotificationsConsent(authToken, true);
        return registerTokenWithBackend(authToken, pushToken);
    })();

    try {
        return await inFlightPushSync;
    } finally {
        inFlightPushSync = null;
    }
}

/** Re-register when permission is already granted (inbox focus, foreground, etc.). */
export async function syncExpoPushTokenIfGranted(
    getAuthToken: () => Promise<string | null>,
): Promise<void> {
    if (!isPushRegistrationAvailable()) {
        pushTrace('[PUSH TRACE] EXIT → reason: syncExpoPushTokenIfGranted — isPushRegistrationAvailable=false');
        return;
    }
    await syncExpoPushToken(getAuthToken);
}

/** Flush a token captured before sign-in once the user logs in. */
export async function flushPendingPushToken(
    getAuthToken: () => Promise<string | null>,
): Promise<boolean> {
    pushTrace('[PUSH TRACE] flushPendingPushToken() start');
    try {
        const pending = await AsyncStorage.getItem(PENDING_PUSH_TOKEN_KEY);
        if (!pending) {
            pushTrace('[PUSH TRACE] EXIT → reason: flushPendingPushToken — no pending token');
            return false;
        }

        const authToken = await getAuthToken();
        if (!authToken) {
            pushTrace('[PUSH TRACE] EXIT → reason: flushPendingPushToken — no auth token');
            return false;
        }

        await updatePushNotificationsConsent(authToken, true);
        return registerTokenWithBackend(authToken, pending);
    } catch (err) {
        logger.warn('Failed to flush pending push token:', err);
        pushTrace('[PUSH TRACE] EXIT → reason: flushPendingPushToken exception');
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
    pushTrace('[PUSH TRACE] capturePushTokenAfterPermission() start');
    const pushToken = await getExpoPushTokenIfPermitted();
    if (!pushToken) {
        pushTrace('[PUSH TRACE] EXIT → reason: capturePushTokenAfterPermission — no token');
        return null;
    }

    if (getAuthToken) {
        const authToken = await getAuthToken();
        if (authToken) {
            await updatePushNotificationsConsent(authToken, true);
            await registerTokenWithBackend(authToken, pushToken);
        } else {
            pushTrace('[PUSH TRACE] EXIT → reason: capturePushTokenAfterPermission — pending (no auth)');
            await persistPendingPushToken(pushToken);
        }
    } else {
        pushTrace('[PUSH TRACE] EXIT → reason: capturePushTokenAfterPermission — pending (no getAuthToken)');
        await persistPendingPushToken(pushToken);
    }

    return pushToken;
}

export { loadNotifications };
