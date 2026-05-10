/**
 * Match notifications service
 *
 * SDK 55 note: `expo-notifications` is loaded lazily and only outside of
 * Expo Go, because importing it in Expo Go triggers the "Android Push
 * notifications ... was removed from Expo Go" runtime error.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';

/** Lazy-load `expo-notifications` (returns null in Expo Go / web). */
let cachedModule: NotificationsModule | null | undefined;
function getNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-notifications') as NotificationsModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

class MatchNotificationsService {
  /**
   * Request notification permissions + set up the Android match channel.
   * No-op in Expo Go / on web.
   */
  async requestPermissions(): Promise<boolean> {
    const Notifications = getNotifications();
    if (!Notifications) return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('match-notifications', {
          name: 'Match Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#22c55e',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }
}

export default new MatchNotificationsService();
