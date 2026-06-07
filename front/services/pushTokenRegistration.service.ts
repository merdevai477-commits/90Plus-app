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
import { getClerkBearerToken } from '../utils/clerkAuthToken';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
let cachedNotifications: NotificationsModule | null | undefined;

/** One in-flight backend sync per session — avoids duplicate POST /push-token on startup */
let inFlightPushSync: Promise<boolean> | null = null;
let lastSyncedPushToken: string | null = null;

export const PENDING_PUSH_TOKEN_KEY = '@90plus/pendingExpoPushToken';
export const NOTIFICATION_PERMISSION_REQUESTED_KEY = 'notification_permission_requested_v3';

/** Wait for Clerk JWT — avoids race where token is generated before auth is ready. */
async function resolveAuthToken(
    getAuthToken: () => Promise<string | null>,
): Promise<string | null> {
    return getClerkBearerToken(getAuthToken, { retries: 5, baseDelayMs: 400 });
}

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

let channelsReady = false;

async function setupAndroidChannels(Notifications: NotificationsModule): Promise<void> {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
        name: 'إشعارات عامة',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#32cd32',
    });

    await Notifications.setNotificationChannelAsync('match-updates', {
        name: 'تحديثات المباريات',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#22c55e',
    });

    await Notifications.setNotificationChannelAsync('social', {
        name: 'تفاعلات اجتماعية',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#a855f7',
    });

    await Notifications.setNotificationChannelAsync('general', {
        name: 'إشعارات التطبيق',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#32cd32',
    });
}

/**
 * Android 13+ requires at least one notification channel before the OS shows
 * the POST_NOTIFICATIONS prompt. Safe to call multiple times.
 */
export async function ensureAndroidNotificationChannels(): Promise<void> {
    const Notifications = loadNotifications();
    if (!Notifications || Platform.OS !== 'android') return;
    if (channelsReady) return;
    await setupAndroidChannels(Notifications);
    channelsReady = true;
}

/**
 * Whether we should show the in-app permission modal / call requestPermissionsAsync.
 * Android reports `denied` on fresh install (not `undetermined`) — must still prompt.
 */
export function shouldPromptForNotificationPermission(status: string): boolean {
    if (status === 'granted') return false;
    if (Platform.OS === 'android') {
        return status === 'undetermined' || status === 'denied';
    }
    return status === 'undetermined';
}

/** Request OS notification permission (creates Android channels first). */
export async function requestOsNotificationPermission(): Promise<string> {
    const Notifications = loadNotifications();
    if (!Notifications) return 'denied';
    await ensureAndroidNotificationChannels();
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
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
        const permission = await Notifications.getPermissionsAsync();
        pushTrace(`[PUSH TRACE] permissions=${permission.status}`);

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

        if (permission.status !== 'granted') {
            console.log('[PUSH REPORT]', {
                platform: Platform.OS,
                isDevice: Device.isDevice,
                appOwnership: Constants.appOwnership,
                projectId: projectId ?? null,
                permission: permission.status,
                token: null,
            });
            pushTrace('[PUSH TRACE] EXIT → reason: permission not granted');
            return null;
        }

        await ensureAndroidNotificationChannels();

        pushTrace(`[PUSH TRACE] projectId=${projectId ?? 'undefined'}`);
        pushTrace('[PUSH TRACE] before getExpoPushTokenAsync');

        let pushTokenData: { data: string } | null = null;
        try {
            pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            pushTrace(`[PUSH TRACE] token=${pushTokenData.data}`);
        } catch (tokenErr: unknown) {
            const msg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
            pushTrace(`[PUSH TRACE] token=error:${msg}`);
            pushTrace('[PUSH TRACE] EXIT → reason: getExpoPushTokenAsync failed');
            logger.error('Error getting push token:', tokenErr);
        }

        console.log('[PUSH REPORT]', {
            platform: Platform.OS,
            isDevice: Device.isDevice,
            appOwnership: Constants.appOwnership,
            projectId: projectId ?? null,
            permission: permission.status,
            token: pushTokenData?.data ?? null,
        });

        if (!pushTokenData?.data) {
            return null;
        }

        const token = pushTokenData.data;
        await ensureAndroidNotificationChannels();
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
        if (result.unauthorized) {
            pushTrace('[PUSH TRACE] registerPushToken response=401 — will persist pending');
            await persistPendingPushToken(pushToken);
            return false;
        }
        if (result.userNotSynced) {
            pushTrace('[PUSH TRACE] registerPushToken response=404 USER_NOT_SYNCED — will persist pending');
            await persistPendingPushToken(pushToken);
            return false;
        }

        pushTrace(
            `[PUSH TRACE] registerPushToken response=failed status=${result.statusCode ?? '?'} code=${result.errorCode ?? '?'}`,
        );
        logger.warn('Push token sync rejected by backend', {
            attempt,
            statusCode: result.statusCode,
            errorCode: result.errorCode,
            reason: result.reason,
        });

        if (attempt < 2) {
            const delay = Math.pow(2, attempt) * 2000;
            await new Promise((r) => setTimeout(r, delay));
            return registerTokenWithBackend(authToken, pushToken, attempt + 1);
        }

        try {
            const Sentry = await import('@sentry/react-native');
            Sentry.captureMessage('Push token sync failed after retries', {
                level: 'warning',
                tags: { component: 'PushNotifications', action: 'syncToken' },
                extra: {
                    tokenPrefix: pushToken.substring(0, 20),
                    statusCode: result.statusCode,
                    errorCode: result.errorCode,
                    reason: result.reason,
                },
            });
        } catch {
            /* Sentry may not be initialized */
        }
        pushTrace('[PUSH TRACE] EXIT → reason: registerPushToken failed after retries');
        return false;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pushTrace(`[PUSH TRACE] registerPushToken response=error:${msg}`);
        logger.warn(`Push token sync network error (attempt ${attempt}):`, err);
        if (attempt < 2) {
            const delay = Math.pow(2, attempt) * 2000;
            await new Promise((r) => setTimeout(r, delay));
            return registerTokenWithBackend(authToken, pushToken, attempt + 1);
        }
        try {
            const Sentry = await import('@sentry/react-native');
            Sentry.captureMessage('Push token sync failed after retries', {
                level: 'warning',
                tags: { component: 'PushNotifications', action: 'syncToken' },
                extra: {
                    tokenPrefix: pushToken.substring(0, 20),
                    reason: msg,
                },
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

        const authToken = await resolveAuthToken(getAuthToken);
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

        const authToken = await resolveAuthToken(getAuthToken);
        if (!authToken) {
            pushTrace('[PUSH TRACE] EXIT → reason: flushPendingPushToken — no auth token (pending kept)');
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
        const authToken = await resolveAuthToken(getAuthToken);
        if (authToken) {
            await updatePushNotificationsConsent(authToken, true);
            await registerTokenWithBackend(authToken, pushToken);
        } else {
            pushTrace('[PUSH TRACE] EXIT → reason: capturePushTokenAfterPermission — pending (no auth after retries)');
            await persistPendingPushToken(pushToken);
        }
    } else {
        pushTrace('[PUSH TRACE] EXIT → reason: capturePushTokenAfterPermission — pending (no getAuthToken)');
        await persistPendingPushToken(pushToken);
    }

    return pushToken;
}

export { loadNotifications };
