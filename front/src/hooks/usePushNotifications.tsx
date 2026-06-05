import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '../services/logger';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPermissionModal } from '../../components/common/NotificationPermissionModal';
import '../../services/notificationForegroundSetup';
import { getApiUrl } from '../../config/api.config';
import {
    loadNotifications,
    syncExpoPushToken,
    syncExpoPushTokenIfGranted,
    flushPendingPushToken,
    capturePushTokenAfterPermission,
    updatePushNotificationsConsent,
    shouldPromptForNotificationPermission,
    requestOsNotificationPermission,
    ensureAndroidNotificationChannels,
    NOTIFICATION_PERMISSION_REQUESTED_KEY,
} from '../../services/pushTokenRegistration.service';
import { markTrayNotificationPresented } from '../../services/trayNotification.service';

const PERMISSION_REQUESTED_KEY = NOTIFICATION_PERMISSION_REQUESTED_KEY;

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

    const processNotificationResponse = useRef((data: Record<string, any> | undefined) => {
        if (!data) return;
        const Notifications = loadNotifications();
        Notifications?.setBadgeCountAsync(0);

        if (data.notificationId && isSignedInRef.current) {
            trackNotificationOpen(data.notificationId);
            getTokenRef.current().then((token) => {
                if (!token) return;
                const apiUrl = getApiUrl();
                fetch(`${apiUrl}/notifications/${data.notificationId}/read`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                }).catch((err) => logger.warn('Auto mark-as-read failed:', err));
            }).catch(() => {});
        }

        handleDeepLinking(data);
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
                const token = await capturePushTokenAfterPermission(getTokenRef.current);
                if (token) setExpoPushToken(token);
                return true;
            }

            setShowPermissionModal(true);
            return false;
        } catch (err) {
            logger.error('Error in requestPermissionExplicitly:', err);
            return false;
        }
    }, []);

    useEffect(() => {
        if (!loadNotifications()) return;
        if (!isLoaded) return;

        let isMounted = true;

        const checkInitialPermissions = async () => {
            try {
                const Notifications = loadNotifications();
                if (!Notifications) return;
                const { status } = await Notifications.getPermissionsAsync();

                if (status === 'granted') {
                    const token = await capturePushTokenAfterPermission(getTokenRef.current);
                    if (token && isMounted) {
                        setExpoPushToken(token);
                    }
                    if (isSignedIn) {
                        await flushPendingPushToken(getTokenRef.current);
                    }
                } else if (shouldPromptForNotificationPermission(status)) {
                    const alreadyAsked = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
                    if (!alreadyAsked && isMounted && isSignedIn) {
                        setTimeout(() => {
                            if (isMounted && isSignedInRef.current) setShowPermissionModal(true);
                        }, 2500);
                    }
                }
            } catch (err: any) {
                if (isMounted) setError(err.message);
            }
        };

        checkInitialPermissions();

        if (isSignedIn) {
            void flushPendingPushToken(getTokenRef.current);
            void syncExpoPushTokenIfGranted(getTokenRef.current);
        }

        const Notifications = loadNotifications();

        const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                Notifications?.setBadgeCountAsync(0);
                if (isSignedInRef.current) {
                    void syncExpoPushTokenIfGranted(getTokenRef.current);
                    void flushPendingPushToken(getTokenRef.current);
                }
            }
        });

        if (!Notifications) {
            return () => {
                isMounted = false;
                appStateSubscription.remove();
            };
        }

        // Cold start: app opened from a notification tap while terminated
        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (!response) return;
                const data = response.notification.request.content.data as Record<string, any>;
                logger.debug('📲 Cold-start notification response:', data);
                processNotificationResponse(data);
            })
            .catch((err) => logger.warn('getLastNotificationResponseAsync failed:', err));

        notificationListener.current = Notifications.addNotificationReceivedListener((incoming) => {
            const data = incoming.request.content.data as Record<string, any>;

            if (data?.notificationId) {
                markTrayNotificationPresented(String(data.notificationId));
            }

            if (data?.silent === true || data?.silent === 'true') {
                logger.debug('🔕 Silent notification received, invalidating cache:', data.type);
                handleSilentNotification(data);
                return;
            }

            logger.debug('🔔 Notification received in foreground:', incoming.request.identifier);
            setNotification(incoming);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data as Record<string, any>;
            logger.debug('📲 Notification tapped. Payload:', data);
            processNotificationResponse(data);
        });

        return () => {
            isMounted = false;
            if (notificationListener.current) notificationListener.current.remove();
            if (responseListener.current) responseListener.current.remove();
            appStateSubscription.remove();
        };
    }, [isLoaded, isSignedIn]);

    // Show permission modal after sign-in if OS permission still undetermined
    useEffect(() => {
        if (!isLoaded || !isSignedIn || !loadNotifications()) return;

        let cancelled = false;

        (async () => {
            const Notifications = loadNotifications();
            if (!Notifications) return;
            await ensureAndroidNotificationChannels();
            const { status } = await Notifications.getPermissionsAsync();
            if (!shouldPromptForNotificationPermission(status) || cancelled) return;
            const alreadyAsked = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
            if (alreadyAsked || cancelled) return;
            setTimeout(() => {
                if (!cancelled && isSignedInRef.current) setShowPermissionModal(true);
            }, 1500);
        })();

        return () => {
            cancelled = true;
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

export {
    syncExpoPushTokenIfGranted,
    syncExpoPushToken,
    updatePushNotificationsConsent,
    capturePushTokenAfterPermission,
} from '../../services/pushTokenRegistration.service';

export function PushNotificationSetup() {
    const { showPermissionModal, setShowPermissionModal } = usePushNotifications();
    const { isSignedIn, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    if (!loadNotifications()) return null;

    return (
        <NotificationPermissionModal
            visible={showPermissionModal && isSignedIn}
            onClose={() => setShowPermissionModal(false)}
            onConfirm={async () => {
                try {
                    const Notifications = loadNotifications();
                    if (!Notifications) {
                        await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');
                        setShowPermissionModal(false);
                        return;
                    }
                    const status = await requestOsNotificationPermission();
                    await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');

                    if (status === 'granted') {
                        await capturePushTokenAfterPermission(() => getTokenRef.current());
                        await flushPendingPushToken(() => getTokenRef.current());
                        await syncExpoPushTokenIfGranted(() => getTokenRef.current());
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
