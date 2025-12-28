/**
 * Notifications Hook
 * 
 * Provides easy access to notification functionality
 * throughout the app
 */

import { useSettings } from '../contexts/SettingsContext';
import {
  scheduleMatchNotification,
  sendGoalNotification,
  sendPredictionResultNotification,
} from '../contexts/SettingsContext';

export const useNotifications = () => {
  const { settings } = useSettings();

  const canSendNotifications = settings.notificationsEnabled;
  const canSendMatchNotifications = settings.notificationsEnabled && settings.matchNotifications;
  const canSendGoalNotifications = settings.notificationsEnabled && settings.goalNotifications;
  const canSendPredictionReminders = settings.notificationsEnabled && settings.predictionReminders;

  return {
    // Permissions
    canSendNotifications,
    canSendMatchNotifications,
    canSendGoalNotifications,
    canSendPredictionReminders,
    
    // Functions
    scheduleMatchNotification,
    sendGoalNotification,
    sendPredictionResultNotification,
  };
};

export default useNotifications;
