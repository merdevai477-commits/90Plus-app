/**
 * Match notifications service
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import FollowedMatchesStorage, { FollowedMatch } from './followedMatchesStorage';
import PredictionStorage from './predictionStorage';
import './notificationForegroundSetup';

class MatchNotificationsService {
  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
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
