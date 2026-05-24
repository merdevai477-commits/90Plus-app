import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { MatchesService } from '../services/authService';
import { logger } from '../services/logger';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPermissionModal } from '../../components/common/NotificationPermissionModal';
import '../../services/notificationForegroundSetup';
import { getApiUrl } from '../../config/api.config';

// Lazy-load expo-notifications. In Expo Go on SDK 53+ the module crashes at
// import time because push-token auto-registration is no longer available —
// see https://docs.expo.dev/develop/development-builds/introduction/
type NotificationsModule = typeof import('expo-notifications');
const isExpoGo = Constants.appOwnership === 'expo';
let cachedNotifications: NotificationsModule | null | undefined;

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

const PERMISSION_REQUESTED_KEY = 'notification_permission_requested_v1';

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: any | null;
    error: string | null;
    showPermissionModal: boolean;
    setShowPermissionModal: (show: boolean) => void;
    requestPermissionExplicitly: () => Promise<boolean>;
}

export function usePushNotifications(): PushNotificationState {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    const notificationListener = useRef<any>(undefined);
    const responseListener = useRef<any>(undefined);

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
            } else {
                // All retries exhausted — report to Sentry so we know users
                // are silently missing push notifications.
                try {
                    const Sentry = await import('@sentry/react-native');
                    Sentry.captureException(err, {
                        tags: { component: 'PushNotifications', action: 'syncToken' },
                        extra: { tokenPrefix: pushToken.substring(0, 20) },
                    });
                } catch { /* Sentry may not be initialized */ }
            }
        }
    });

    const trackNotificationOpen = useRef(async (notificationId: string) => {
        try {
            const authToken = await getTokenRef.current();
            if (!authToken) return;
            const apiUrl = getApiUrl();
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
                case 'LIKE':
                case 'COMMENT':
                case 'REPLY':
                case 'MENTION':
                case 'SHARE':
                case 'COMMENT_LIKE':
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
                    const fId = String(data.matchId || data.fixtureId);
                    r.push({
                        pathname: '/(tabs)/match-details',
                        params: {
                            fixtureId: fId,
                            homeTeam: data.homeTeam || '',
                            awayTeam: data.awayTeam || '',
                            homeLogo: data.homeTeamLogo || '',
                            awayLogo: data.awayTeamLogo || '',
                            // Preserve 0-0 instead of coercing it to ''
                            homeScore: data.homeScore != null ? String(data.homeScore) : '',
                            awayScore: data.awayScore != null ? String(data.awayScore) : '',
                            league: data.leagueName || '',
                            leagueLogo: '',
                            date: data.matchDate || new Date().toISOString().split('T')[0],
                            time: '',
                            status: type === 'MATCH_END' ? 'finished' : 'live',
                        },
                    });
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
            } else if (
                type === 'LIKE' ||
                type === 'COMMENT' ||
                type === 'REPLY' ||
                type === 'MENTION' ||
                type === 'SHARE' ||
                type === 'COMMENT_LIKE'
            ) {
                const opensComments =
                    data.commentId &&
                    (type === 'COMMENT' ||
                        type === 'REPLY' ||
                        type === 'MENTION' ||
                        type === 'COMMENT_LIKE');
                if (data.reelId && opensComments) {
                    r.push({
                        pathname: '/(tabs)/reels',
                        params: {
                            reelId: data.reelId,
                            commentId: data.commentId,
                            autoOpenComments: 'true',
                        },
                    });
                } else if (data.reelId) {
                    r.push({ pathname: '/(tabs)/reels', params: { reelId: data.reelId } });
                } else {
                    r.push('/notifications');
                }
            } else if (type === 'PREDICTION_RESULT') {
                // Prefer match-details when the backend included a fixtureId
                // in the payload; fall back to the matches hub.
                const fId = data.matchId || data.fixtureId;
                if (fId) {
                    r.push({
                        pathname: '/(tabs)/match-details',
                        params: {
                            fixtureId: String(fId),
                            homeTeam: data.homeTeam || '',
                            awayTeam: data.awayTeam || '',
                            homeLogo: data.homeTeamLogo || '',
                            awayLogo: data.awayTeamLogo || '',
                            homeScore: data.homeScore != null ? String(data.homeScore) : '',
                            awayScore: data.awayScore != null ? String(data.awayScore) : '',
                            league: data.leagueName || '',
                            leagueLogo: '',
                            date: data.matchDate || new Date().toISOString().split('T')[0],
                            time: '',
                            status: 'finished',
                        },
                    });
                } else {
                    r.push('/(tabs)/matches');
                }
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
            } else if (type === 'MILESTONE' || type === 'REPORT_RESOLVED' || type === 'REPORT_SUBMITTED') {
                const screen = data.screen;
                if (screen) {
                    r.push(screen as any);
                } else {
                    r.push('/notifications');
                }
            } else if (type === 'LEVEL_UP') {
                r.push({ pathname: '/(tabs)/profile', params: { tab: 'stats' } });
            } else if (type === 'LEADERBOARD_TOP10' || type === 'LEADERBOARD_TOP3') {
                r.push('/(tabs)/rank' as any);
            } else if (type === 'AVATAR_UPLOAD') {
                r.push('/(tabs)/profile' as any);
            } else if (type === 'AI_CHECKIN') {
                r.push('/(tabs)/chat' as any);
            } else if (type === 'DAILY_QUIZ_RENEWED' || type === 'QUIZ_REWARD') {
                r.push('/(tabs)/quiz' as any);
            } else if (type === 'LUCKY_WHEEL_RENEWED') {
                r.push({ pathname: '/(tabs)/Home', params: { openLuckyWheel: 'true' } });
            } else if (type === 'COOLDOWN_EXPIRED') {
                r.push('/(tabs)/profile' as any);
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
        try {
            const Notifications = loadNotifications();
            if (!Notifications) {
                setError('Push notifications require a development build, not Expo Go.');
                return false;
            }
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
        if (!loadNotifications()) return;

        // Only run after authentication is definitively loaded
        if (!isLoaded) return;

        let isMounted = true;

        const checkInitialPermissions = async () => {
            try {
                const Notifications = loadNotifications();
                if (!Notifications) return;
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

        const Notifications = loadNotifications();

        // Handle AppState changes (works even without notifications module)
        const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                Notifications?.setBadgeCountAsync(0);
            }
        });

        if (!Notifications) {
            return () => {
                isMounted = false;
                appStateSubscription.remove();
            };
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
                    const apiUrl = getApiUrl();
                    fetch(`${apiUrl}/notifications/${data.notificationId}/read`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    }).catch(err => logger.warn('Auto mark-as-read failed:', err));
                }).catch(() => {});
            }

            handleDeepLinking(data);
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
    if (!Device.isDevice) {
        logger.debug('Push notifications require a physical device');
        return null;
    }

    const Notifications = loadNotifications();
    if (!Notifications) {
        logger.debug('Push notifications not available (Expo Go / web)');
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
    if (!loadNotifications()) return null;

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
                    const Notifications = loadNotifications();
                    if (!Notifications) {
                        await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');
                        setShowPermissionModal(false);
                        return;
                    }
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
