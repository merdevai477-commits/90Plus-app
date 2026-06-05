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
    } else {
        logger.info('[Push] Android notification permission not granted:', newStatus);
    }
}

export function PushTokenSyncBootstrap() {
    const { isSignedIn, isLoaded, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const permissionPromptStarted = useRef(false);

    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;

        const sync = async () => {
            await logPushRegistrationReport('signed-in-sync-start');

            if (!permissionPromptStarted.current) {
                permissionPromptStarted.current = true;
                await ensureAndroidNotificationPermission(() => getTokenRef.current());
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
