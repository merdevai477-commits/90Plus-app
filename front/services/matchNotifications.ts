/**
 * Match notifications service
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import FollowedMatchesStorage, { FollowedMatch } from './followedMatchesStorage';
import PredictionStorage from './predictionStorage';
import './notificationForegroundSetup';

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

class MatchNotificationsService {
  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
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
