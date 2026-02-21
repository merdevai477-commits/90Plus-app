import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuth } from '@clerk/clerk-expo';
import { MatchesService } from '../services/authService';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    error: string | null;
}

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();
    
    const { getToken, isSignedIn } = useAuth();

    useEffect(() => {
        // Register for push notifications
        registerForPushNotificationsAsync()
            .then(token => {
                if (token) {
                    setExpoPushToken(token);
                    // Send token to backend
                    sendTokenToBackend(token);
                }
            })
            .catch(err => {
                setError(err.message);
            });

        // Listen for incoming notifications
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        // Listen for notification responses (when user taps notification)
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            console.log('Notification tapped:', data);
            // Handle navigation based on notification type
            handleNotificationResponse(data);
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    // Re-register token when user signs in
    useEffect(() => {
        if (isSignedIn && expoPushToken) {
            sendTokenToBackend(expoPushToken);
        }
    }, [isSignedIn, expoPushToken]);

    const sendTokenToBackend = async (pushToken: string) => {
        try {
            const authToken = await getToken();
            if (authToken) {
                await MatchesService.registerPushToken(authToken, pushToken);
                logger.debug('✅ Push token registered with backend');
            }
        } catch (err) {
            console.error('Failed to register push token:', err);
        }
    };

    const handleNotificationResponse = (data: any) => {
        // Handle different notification types
        switch (data?.type) {
            case 'MATCH_GOAL':
            case 'MATCH_START':
            case 'MATCH_END':
            case 'MATCH_HALFTIME':
                // Navigate to match details or home screen
                // router.push('/matches');
                break;
            default:
                break;
        }
    };

    return {
        expoPushToken,
        notification,
        error,
    };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    // Must be a physical device
    if (!Device.isDevice) {
        logger.debug('Push notifications require a physical device');
        return null;
    }

    // Check/request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        logger.debug('Push notification permission not granted');
        return null;
    }

    // Get Expo push token
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        
        const pushTokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
        });
        
        token = pushTokenData.data;
        logger.debug('📱 Expo Push Token:', token);
    } catch (error) {
        logger.error('Error getting push token:', error);
    }

    // Android-specific channel setup
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('match-updates', {
            name: 'تحديثات المباريات',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#32cd32',
            sound: 'default',
        });
    }

    return token;
}

export default usePushNotifications;
