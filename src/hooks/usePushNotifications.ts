import { useState, useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { MatchesService } from '../services/authService';
import { logger } from '../services/logger';
import { useRouter } from 'expo-router';
import '../../services/notificationForegroundSetup';

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    error: string | null;
}

export function usePushNotifications(): PushNotificationState {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const notificationListener = useRef<Notifications.EventSubscription | undefined>(undefined);
    const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);
    
    // Correctly using useAuth without hacks
    const { getToken, isSignedIn, isLoaded } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Use refs to avoid stale closures in event listeners
    const getTokenRef = useRef(getToken);
    const isSignedInRef = useRef(isSignedIn);
    const routerRef = useRef(router);
    const queryClientRef = useRef(queryClient);
    getTokenRef.current = getToken;
    isSignedInRef.current = isSignedIn;
    routerRef.current = router;
    queryClientRef.current = queryClient;

    const syncTokenWithBackendWithRetry = useRef(async (pushToken: string, attempt: number = 0) => {
        try {
            const authToken = await getTokenRef.current();
            if (authToken) {
                const success = await MatchesService.registerPushToken(authToken, pushToken);
                if (success) {
                    logger.debug('✅ Push token synced successfully with backend');
                } else {
                    throw new Error('Backend rejected token sync');
                }
            }
        } catch (err: any) {
            logger.error(`❌ Push token sync failed (attempt ${attempt}):`, err);
            if (attempt < 3) {
                const delay = Math.pow(2, attempt) * 2000;
                setTimeout(() => syncTokenWithBackendWithRetry.current(pushToken, attempt + 1), delay);
            }
        }
    });

    const trackNotificationOpen = useRef(async (notificationId: string) => {
        try {
            const authToken = await getTokenRef.current();
            if (!authToken) return;
            await fetch(`${require('../../config/api.config').getApiUrl()}/notifications/${notificationId}/opened`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            });
        } catch (err) {
            logger.warn('Failed to track notification open:', err);
        }
    }).current;

    const handleSilentNotification = useRef((data: Record<string, any>) => {
        try {
            switch (data.type) {
                case 'MATCH_UPDATE':
                    queryClientRef.current.invalidateQueries({ queryKey: ['matches', 'live'] });
                    break;
                case 'SCORE_UPDATE':
                    if (data.matchId) {
                        queryClientRef.current.invalidateQueries({ queryKey: ['matches', data.matchId] });
                    }
                    queryClientRef.current.invalidateQueries({ queryKey: ['matches', 'live'] });
                    break;
                case 'NOTIFICATION_COUNT':
                    queryClientRef.current.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
                    break;
                default:
                    break;
            }
        } catch (err) {
            logger.error('Failed to handle silent notification:', err);
        }
    }).current;

    const handleDeepLinking = useRef((data: Record<string, any>) => {
        if (!data) return;
        try {
            const type = data.type as string | undefined;
            const r = routerRef.current;

            if (type === 'LUCKY_WHEEL') {
                r.push({ pathname: '/(tabs)/Home', params: { openLuckyWheel: 'true' } });
            } else if (type === 'MATCH_GOAL' || type === 'MATCH_UPDATE' || type === 'MATCH_START' || type === 'MATCH_END' || type === 'MATCH_HALFTIME' || type?.includes('MATCH')) {
                if (data.matchId || data.fixtureId) {
                    r.push({ pathname: '/(tabs)/matches', params: { matchId: String(data.matchId || data.fixtureId) } });
                } else {
                    r.push('/(tabs)/matches');
                }
            } else if (type === 'FOLLOW') {
                const username = data.actorUsername || data.followerUsername || data.username;
                if (username) {
                    r.push({ pathname: '/user/[username]', params: { username } });
                } else {
                    r.push('/notifications');
                }
            } else if (type === 'LIKE' || type === 'COMMENT' || type === 'REPLY' || type === 'MENTION') {
                if (data.commentId && data.reelId) {
                    r.push({ pathname: '/(tabs)/reels', params: { reelId: data.reelId, commentId: data.commentId, autoOpenComments: 'true' } });
                } else if (data.reelId) {
                    r.push({ pathname: '/(tabs)/reels', params: { reelId: data.reelId } });
                } else {
                    r.push('/notifications');
                }
            } else if (type === 'PREDICTION_RESULT') {
                r.push('/(tabs)/matches');
            } else if (type === 'VIDEO_PROCESSED') {
                if (data.reelId) {
                    r.push({ pathname: '/(tabs)/reels', params: { reelId: data.reelId } });
                } else {
                    r.push('/(tabs)/reels');
                }
            } else if (type === 'GIFT') {
                r.push({ pathname: '/(tabs)/profile', params: { tab: 'wallet' } });
            } else if (type === 'COIN_MILESTONE') {
                r.push({ pathname: '/(tabs)/profile', params: { tab: 'wallet' } });
            } else if (type === 'MILESTONE' || type === 'REPORT_RESOLVED') {
                const screen = data.screen;
                if (screen) {
                    r.push(screen as any);
                } else {
                    r.push('/notifications');
                }
            } else if (data.screen) {
                r.push(data.screen as any);
            } else if (data.url) {
                r.push(data.url as any);
            } else {
                r.push('/notifications');
            }
        } catch (err) {
            logger.error('Failed to handle notification deep link:', err);
        }
    }).current;

    useEffect(() => {
        // Only run after authentication is definitively loaded
        if (!isLoaded) return;

        let isMounted = true;

        const initializePushTokens = async () => {
            try {
                const token = await registerForPushNotificationsAsync();
                if (token && isMounted) {
                    setExpoPushToken(token);
                    
                    // If user is signed in, send the token to the backend immediately
                    if (isSignedIn) {
                        await syncTokenWithBackendWithRetry.current(token, 0);
                    }
                }
            } catch (err: any) {
                if (isMounted) setError(err.message);
            }
        };

        initializePushTokens();

        // Re-sync token when user signs in (handles case where user logs in after app launch)
        if (isSignedIn && expoPushToken) {
            syncTokenWithBackendWithRetry.current(expoPushToken, 0);
        }

        // 1. Foreground Notification arrives
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            const data = notification.request.content.data as Record<string, any>;

            // Handle silent background notifications - invalidate cache, no UI
            if (data?.silent === true) {
                logger.debug('🔕 Silent notification received, invalidating cache:', data.type);
                handleSilentNotification(data);
                return;
            }

            logger.debug('🔔 Notification received in foreground:', notification.request.identifier);
            setNotification(notification);
        });

        // 2. User taps a notification (Background / Terminated -> Foreground)
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data as Record<string, any>;
            logger.debug('📲 Notification tapped. Payload:', data);

            Notifications.setBadgeCountAsync(0);

            // Feature 10: Auto mark-as-read when user taps a notification
            if (data?.notificationId && isSignedInRef.current) {
                trackNotificationOpen(data.notificationId);
                // Also mark as read (trackNotificationOpen only records the open event)
                getTokenRef.current().then(token => {
                    if (!token) return;
                    fetch(`${require('../../config/api.config').getApiUrl()}/notifications/${data.notificationId}/read`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    }).catch(err => logger.warn('Auto mark-as-read failed:', err));
                }).catch(() => {});
            }

            handleDeepLinking(data);
        });

        // Handle AppState changes (e.g. tracking when they come from background, resolving badges)
        const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                Notifications.setBadgeCountAsync(0);
            }
        });

        return () => {
            isMounted = false;
            if (notificationListener.current) notificationListener.current.remove();
            if (responseListener.current) responseListener.current.remove();
            appStateSubscription.remove();
        };
    }, [isLoaded, isSignedIn]);

    return {
        expoPushToken,
        notification,
        error,
    };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    if (!Device.isDevice) {
        logger.debug('Push notifications require a physical device');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            logger.debug('🚫 Push notification permission not granted by user');
            return null;
        }

        // Safely extract the project ID for EAS
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        if (!projectId) {
            logger.warn('Project ID missing for Expo push token setup.');
        }
        
        const pushTokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
        });
        
        token = pushTokenData.data;
        logger.debug('📱 Expo Push Token successfully extracted:', token);

    } catch (error) {
        logger.error('Error getting push token:', error);
    }

    // Android-specific channel setup
    if (Platform.OS === 'android') {
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
    }

    return token;
}

// Global Injection Component
export function PushNotificationSetup() {
    usePushNotifications();
    return null;
}

export default usePushNotifications;
