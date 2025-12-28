/**
 * Settings Context - Global Settings Management
 * 
 * Provides app-wide settings state and persistence
 * Handles notifications, preferences, theme, and language
 * 
 * @author Staff Engineer
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Conditionally import notifications only if not in Expo Go
let Notifications: any = null;
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    console.log('expo-notifications not available');
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface SettingsState {
  // Notifications
  notificationsEnabled: boolean;
  matchNotifications: boolean;
  goalNotifications: boolean;
  predictionReminders: boolean;
  
  // Preferences
  language: 'ar' | 'en';
  favoriteTeams: number[];
  favoriteLeagues: number[];
  
  // App State
  isFirstLaunch: boolean;
  lastSyncTime: number;
}

interface SettingsContextType {
  settings: SettingsState;
  loading: boolean;
  
  // Notification Methods
  toggleNotifications: (enabled: boolean) => Promise<void>;
  toggleMatchNotifications: (enabled: boolean) => Promise<void>;
  toggleGoalNotifications: (enabled: boolean) => Promise<void>;
  togglePredictionReminders: (enabled: boolean) => Promise<void>;
  
  // Preference Methods
  setLanguage: (lang: 'ar' | 'en') => Promise<void>;
  addFavoriteTeam: (teamId: number) => Promise<void>;
  removeFavoriteTeam: (teamId: number) => Promise<void>;
  addFavoriteLeague: (leagueId: number) => Promise<void>;
  removeFavoriteLeague: (leagueId: number) => Promise<void>;
  
  // Utility Methods
  clearCache: () => Promise<void>;
  resetSettings: () => Promise<void>;
  updateLastSync: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  SETTINGS: '@app:settings',
  CACHE: '@app:cache',
};

const DEFAULT_SETTINGS: SettingsState = {
  notificationsEnabled: true,
  matchNotifications: true,
  goalNotifications: true,
  predictionReminders: true,
  language: 'ar',
  favoriteTeams: [],
  favoriteLeagues: [],
  isFirstLaunch: true,
  lastSyncTime: Date.now(),
};

// ============================================================================
// CONTEXT
// ============================================================================

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializeSettings();
    configureNotifications();
  }, []);

  const initializeSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const configureNotifications = async () => {
    // Skip notifications in Expo Go
    if (isExpoGo || !Notifications) {
      console.log('📱 Running in Expo Go - Notifications disabled. Use development build for full functionality.');
      return;
    }

    try {
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Request permissions
      if (Platform.OS !== 'web') {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('Notification permissions not granted');
        }
      }
    } catch (error) {
      console.log('Error configuring notifications:', error);
    }
  };

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  const saveSettings = async (newSettings: SettingsState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  };

  // ============================================================================
  // NOTIFICATION METHODS
  // ============================================================================

  const toggleNotifications = async (enabled: boolean) => {
    const newSettings = { ...settings, notificationsEnabled: enabled };
    
    // Skip notification operations in Expo Go
    if (!isExpoGo && Notifications) {
      try {
        if (enabled) {
          // Request permissions if enabling
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            throw new Error('Notification permissions not granted');
          }
        } else {
          // Cancel all scheduled notifications if disabling
          await Notifications.cancelAllScheduledNotificationsAsync();
        }
      } catch (error) {
        console.log('Notification operation failed:', error);
      }
    }
    
    await saveSettings(newSettings);
  };

  const toggleMatchNotifications = async (enabled: boolean) => {
    const newSettings = { ...settings, matchNotifications: enabled };
    await saveSettings(newSettings);
  };

  const toggleGoalNotifications = async (enabled: boolean) => {
    const newSettings = { ...settings, goalNotifications: enabled };
    await saveSettings(newSettings);
  };

  const togglePredictionReminders = async (enabled: boolean) => {
    const newSettings = { ...settings, predictionReminders: enabled };
    await saveSettings(newSettings);
  };

  // ============================================================================
  // PREFERENCE METHODS
  // ============================================================================

  const setLanguage = async (lang: 'ar' | 'en') => {
    const newSettings = { ...settings, language: lang };
    await saveSettings(newSettings);
  };

  const addFavoriteTeam = async (teamId: number) => {
    if (!settings.favoriteTeams.includes(teamId)) {
      const newSettings = {
        ...settings,
        favoriteTeams: [...settings.favoriteTeams, teamId],
      };
      await saveSettings(newSettings);
    }
  };

  const removeFavoriteTeam = async (teamId: number) => {
    const newSettings = {
      ...settings,
      favoriteTeams: settings.favoriteTeams.filter(id => id !== teamId),
    };
    await saveSettings(newSettings);
  };

  const addFavoriteLeague = async (leagueId: number) => {
    if (!settings.favoriteLeagues.includes(leagueId)) {
      const newSettings = {
        ...settings,
        favoriteLeagues: [...settings.favoriteLeagues, leagueId],
      };
      await saveSettings(newSettings);
    }
  };

  const removeFavoriteLeague = async (leagueId: number) => {
    const newSettings = {
      ...settings,
      favoriteLeagues: settings.favoriteLeagues.filter(id => id !== leagueId),
    };
    await saveSettings(newSettings);
  };

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  const clearCache = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CACHE);
      // Clear any other cached data here
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  };

  const resetSettings = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS);
      setSettings(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  };

  const updateLastSync = async () => {
    const newSettings = { ...settings, lastSyncTime: Date.now() };
    await saveSettings(newSettings);
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: SettingsContextType = {
    settings,
    loading,
    
    // Notification Methods
    toggleNotifications,
    toggleMatchNotifications,
    toggleGoalNotifications,
    togglePredictionReminders,
    
    // Preference Methods
    setLanguage,
    addFavoriteTeam,
    removeFavoriteTeam,
    addFavoriteLeague,
    removeFavoriteLeague,
    
    // Utility Methods
    clearCache,
    resetSettings,
    updateLastSync,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Schedule a notification for a match
 */
export const scheduleMatchNotification = async (
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  matchTime: Date,
  minutesBefore: number = 15
) => {
  if (isExpoGo || !Notifications) {
    console.log('📱 Notifications not available in Expo Go');
    return;
  }

  try {
    const trigger = new Date(matchTime.getTime() - minutesBefore * 60 * 1000);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚽ المباراة على وشك البدء!',
        body: `${homeTeam} ضد ${awayTeam} - بعد ${minutesBefore} دقيقة`,
        data: { matchId, type: 'match_reminder' },
        sound: true,
      },
      trigger,
    });
  } catch (error) {
    console.log('Error scheduling notification:', error);
  }
};

/**
 * Send a goal notification
 */
export const sendGoalNotification = async (
  team: string,
  player: string,
  minute: number
) => {
  if (isExpoGo || !Notifications) {
    console.log('📱 Notifications not available in Expo Go');
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚽ هدف!',
        body: `${player} يسجل لـ ${team} في الدقيقة ${minute}`,
        data: { type: 'goal' },
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.log('Error sending notification:', error);
  }
};

/**
 * Send prediction result notification
 */
export const sendPredictionResultNotification = async (
  isCorrect: boolean,
  points: number,
  matchInfo: string
) => {
  if (isExpoGo || !Notifications) {
    console.log('📱 Notifications not available in Expo Go');
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isCorrect ? '🎉 توقع صحيح!' : '😔 توقع خاطئ',
        body: isCorrect 
          ? `لقد ربحت ${points} نقطة في مباراة ${matchInfo}`
          : `للأسف، توقعك في مباراة ${matchInfo} لم يكن صحيحاً`,
        data: { type: 'prediction_result', isCorrect, points },
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.log('Error sending notification:', error);
  }
};

export default SettingsContext;
