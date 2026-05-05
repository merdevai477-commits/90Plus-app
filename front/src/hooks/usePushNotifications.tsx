import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';
import type { Notification, EventSubscription } from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { MatchesService } from '../services/authService';
import { logger } from '../services/logger';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPermissionModal } from '../../components/common/NotificationPermissionModal';
import '../../services/notificationForegroundSetup';

const PERMISSION_REQUESTED_KEY = 'notification_permission_requested_v1';
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

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: Notification | null;
    error: string | null;
    showPermissionModal: boolean;
    setShowPermissionModal: (show: boolean) => void;
    requestPermissionExplicitly: () => Promise<boolean>;
}

export function usePushNotifications(): PushNotificationState {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notification | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    
    const notificationListener = useRef<EventSubscription | undefined>(undefined);
    const responseListener = useRef<EventSubscription | undefined>(undefined);
    
    const { getToken, isSignedIn, isLoaded } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

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
            const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'https://90plus-app-production-b28d.up.railway.app/api';
            await fetch(`${apiUrl}/notifications/${notificationId}/opened`, {
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

    const requestPermissionExplicitly = useCallback(async (): Promise<boolean> => {
        if (!Notifications) return false;

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            
            if (existingStatus === 'granted') {
                const token = await registerForPushNotificationsAsync();
                if (token) setExpoPushToken(token);
                return true;
            }

            // Show our custom soft-prompt first
            setShowPermissionModal(true);
            return false;
        } catch (err) {
            logger.error('Error in requestPermissionExplicitly:', err);
            return false;
        }
    }, []);

    useEffect(() => {
        if (!Notifications) return;

        // Only run after authentication is definitively loaded
        if (!isLoaded) return;

        let isMounted = true;

        const checkInitialPermissions = async () => {
            try {
                const { status } = await Notifications.getPermissionsAsync();
                
                if (status === 'granted') {
                    const token = await registerForPushNotificationsAsync();
                    if (token && isMounted) {
                        setExpoPushToken(token);
                        
                        // If user is signed in, send the token to the backend immediately
                        if (isSignedIn) {
                            await syncTokenWithBackendWithRetry.current(token, 0);
                        }
                    }
                } else if (status === 'undetermined') {
                    // Check if we've already asked (soft-prompt persistence)
                    const alreadyAsked = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
                    if (!alreadyAsked && isMounted) {
                        // Delay showing the modal slightly to ensure app is ready/interactive
                        setTimeout(() => {
                            if (isMounted) setShowPermissionModal(true);
                        }, 2500);
                    }
                }
            } catch (err: any) {
                if (isMounted) setError(err.message);
            }
        };

        checkInitialPermissions();

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

            // Auto mark-as-read when user taps a notification
            if (data?.notificationId && isSignedInRef.current) {
                trackNotificationOpen(data.notificationId);
                getTokenRef.current().then(token => {
                    if (!token) return;
                    const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'https://90plus-app-production-b28d.up.railway.app/api';
                    fetch(`${apiUrl}/notifications/${data.notificationId}/read`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    }).catch(err => logger.warn('Auto mark-as-read failed:', err));
                }).catch(() => {});
            }

            handleDeepLinking(data);
        });

        // Handle AppState changes
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
        showPermissionModal,
        setShowPermissionModal,
        requestPermissionExplicitly,
    };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Notifications) return null;

    if (!Device.isDevice) {
        logger.debug('Push notifications require a physical device');
        return null;
    }

    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return null;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        
        const token = pushTokenData.data;
        logger.debug('📱 Expo Push Token successfully extracted:', token);

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
    } catch (error) {
        logger.error('Error getting push token:', error);
        return null;
    }
}

// Global Injection Component
export function PushNotificationSetup() {
    if (!Notifications) return null;

    const { showPermissionModal, setShowPermissionModal, expoPushToken } = usePushNotifications();
    const { isSignedIn } = useAuth();
    
    // Manual sync ref for the confirm action
    const { getToken } = useAuth();
    const syncToken = async (pushToken: string) => {
        try {
            const authToken = await getToken();
            if (authToken) {
                await MatchesService.registerPushToken(authToken, pushToken);
            }
        } catch (err) {
            logger.error('Manual token sync failed:', err);
        }
    };

    return (
        <NotificationPermissionModal
            visible={showPermissionModal}
            onClose={() => setShowPermissionModal(false)}
            onConfirm={async () => {
                try {
                    const { status } = await Notifications.requestPermissionsAsync();
                    await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');
                    
                    if (status === 'granted') {
                        const token = await registerForPushNotificationsAsync();
                        if (token && isSignedIn) {
                            await syncToken(token);
                        }
                    }
                } catch (err) {
                    logger.error('Permission request error:', err);
                } finally {
                    setShowPermissionModal(false);
                }
            }}
        />
    );
}

export default usePushNotifications;
