/**
 * Keeps Expo push token + backend consent in sync after login and on every foreground.
 * On Android, also triggers the OS notification permission dialog when needed.
 */
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import {
    syncExpoPushTokenIfGranted,
    flushPendingPushToken,
    ensureAndroidNotificationChannels,
    shouldPromptForNotificationPermission,
    requestOsNotificationPermission,
    capturePushTokenAfterPermission,
    loadNotifications,
    isPushRegistrationAvailable,
    NOTIFICATION_PERMISSION_REQUESTED_KEY,
} from '../../services/pushTokenRegistration.service';
import { logPushRegistrationReport } from '../../services/pushRegistrationReport.service';
import { logger } from '../../services/logger';
import { pushStep } from '../../utils/pushTrace';

async function ensureAndroidNotificationPermission(
    getToken: () => Promise<string | null>,
): Promise<void> {
    if (Platform.OS !== 'android' || !isPushRegistrationAvailable()) return;

    const Notifications = loadNotifications();
    if (!Notifications) return;

    await ensureAndroidNotificationChannels();
    const { status } = await Notifications.getPermissionsAsync();

    if (status === 'granted') return;
    if (!shouldPromptForNotificationPermission(status)) return;

    const alreadyAsked = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_REQUESTED_KEY);
    if (alreadyAsked) return;

    // Brief delay so home screen finishes mounting before the system dialog.
    await new Promise((r) => setTimeout(r, 2500));

    const newStatus = await requestOsNotificationPermission();
    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_REQUESTED_KEY, 'true');

    if (newStatus === 'granted') {
        await capturePushTokenAfterPermission(getToken);
    } else if (newStatus === 'denied') {
        logger.info(
            '[Push] Android notification permission denied — enable in system Settings → Apps → 90Plus → Notifications',
        );
    } else {
        logger.info('[Push] Android notification permission not granted:', newStatus);
    }
}

async function ensureIosNotificationPermission(
    getToken: () => Promise<string | null>,
): Promise<void> {
    if (Platform.OS !== 'ios' || !isPushRegistrationAvailable()) return;

    const Notifications = loadNotifications();
    if (!Notifications) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return;

    const alreadyAsked = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_REQUESTED_KEY);
    if (alreadyAsked && status === 'denied') {
        logger.info(
            '[Push] iOS notification permission denied — enable in Settings → 90Plus → Notifications',
        );
    }
}

export function PushTokenSyncBootstrap() {
    const { isSignedIn, isLoaded, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const permissionPromptStarted = useRef(false);
    const lastPermissionStatus = useRef<string | null>(null);

    useEffect(() => {
        if (!isLoaded) {
            pushStep('EARLY EXIT', 'PushTokenSyncBootstrap — Clerk isLoaded=false');
            return;
        }
        if (!isSignedIn) {
            pushStep('EARLY EXIT', 'PushTokenSyncBootstrap — user not signed in');
            return;
        }

        const sync = async () => {
            pushStep('1', 'App started — PushTokenSyncBootstrap sync()');
            await logPushRegistrationReport('signed-in-sync-start');

            const Notifications = loadNotifications();
            let currentStatus: string | null = null;
            if (Notifications) {
                const perm = await Notifications.getPermissionsAsync();
                currentStatus = perm.status;
            }

            const wasNotGranted = lastPermissionStatus.current != null
                && lastPermissionStatus.current !== 'granted';
            const nowGranted = currentStatus === 'granted';
            if (wasNotGranted && nowGranted) {
                await capturePushTokenAfterPermission(() => getTokenRef.current());
            }
            if (currentStatus) {
                lastPermissionStatus.current = currentStatus;
            }

            if (!permissionPromptStarted.current) {
                permissionPromptStarted.current = true;
                if (Platform.OS === 'android') {
                    await ensureAndroidNotificationPermission(() => getTokenRef.current());
                } else {
                    await ensureIosNotificationPermission(() => getTokenRef.current());
                }
            } else if (nowGranted) {
                // User may have enabled notifications in system settings after denying once.
                await syncExpoPushTokenIfGranted(() => getTokenRef.current());
            }

            await flushPendingPushToken(() => getTokenRef.current());
            await syncExpoPushTokenIfGranted(() => getTokenRef.current());
            await logPushRegistrationReport('signed-in-sync-end');
        };

        sync();

        const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') sync();
        });

        return () => sub.remove();
    }, [isLoaded, isSignedIn]);

    return null;
}

export function GlobalNotificationTrayBridge() {
    const { isSignedIn } = useAuth();

    useEffect(() => {
        if (!isSignedIn) return;

        let unsubscribe: (() => void) | undefined;

        (async () => {
            try {
                const { websocketClient } = await import('../../services/websocketClient');
                const { presentTrayNotification } = await import('../../services/trayNotification.service');

                unsubscribe = websocketClient.subscribe('notification', (message) => {
                    const payload = message.payload as {
                        id?: string;
                        title?: string;
                        message?: string;
                        type?: string;
                        data?: Record<string, unknown>;
                    };

                    const title = payload.title?.trim();
                    const body = (payload.message ?? '').trim();
                    if (!title || !body) return;

                    const data: Record<string, unknown> = {
                        ...(payload.data && typeof payload.data === 'object' ? payload.data : {}),
                        type: payload.type ?? payload.data?.type,
                        notificationId: payload.id,
                    };

                    void presentTrayNotification({ title, body, data });
                });
            } catch (err) {
                logger.warn('[GlobalNotificationTrayBridge] setup failed:', err);
            }
        })();

        return () => unsubscribe?.();
    }, [isSignedIn]);

    return null;
}
