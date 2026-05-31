/**
 * Keeps Expo push token + backend consent in sync after login and on every foreground.
 */
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import {
    syncExpoPushTokenIfGranted,
    flushPendingPushToken,
} from '../../services/pushTokenRegistration.service';
import { logger } from '../../services/logger';

export function PushTokenSyncBootstrap() {
    const { isSignedIn, isLoaded, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    useEffect(() => {
        if (!isLoaded || !isSignedIn) return;

        const sync = async () => {
            await flushPendingPushToken(() => getTokenRef.current());
            await syncExpoPushTokenIfGranted(() => getTokenRef.current());
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
