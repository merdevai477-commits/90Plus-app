/**
 * إعداد موحّد لعرض الإشعارات المحلية و Push في الشريط/المركز (iOS + Android).
 * بدون shouldShowBanner / shouldShowList قد لا تظهر الإشعارات أثناء فتح التطبيق أو في قائمة الإشعارات.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ensureAndroidNotificationChannels } from './pushTokenRegistration.service';

const isExpoGo = Constants.appOwnership === 'expo';

export function ensureNotificationForegroundHandler(): void {
    if (isExpoGo || Platform.OS === 'web') return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
        if (Platform.OS === 'android') {
            void ensureAndroidNotificationChannels();
        }
    } catch {
        /* expo-notifications غير متاح */
    }
}

ensureNotificationForegroundHandler();
