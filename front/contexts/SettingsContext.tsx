/**
 * Settings Context - Global Settings Management
 * 
 * Provides app-wide settings state and persistence
 * Handles notifications, preferences, theme, and language
 * 
 * Language handling is now synced with the new i18n system.
 * The i18n store is the source of truth for language preferences.
 * 
 * @author Staff Engineer
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useLanguageStore, Language } from '../src/i18n';
import { useAuth } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';
import { logger } from '../services/logger';
import { ensureNotificationForegroundHandler } from '../services/notificationForegroundSetup';
import {
  syncExpoPushToken,
  updatePushNotificationsConsent,
  ensureAndroidNotificationChannels,
  requestOsNotificationPermission,
} from '../services/pushTokenRegistration.service';

// Conditionally import notifications only if not in Expo Go
let Notifications: any = null;
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    logger.debug('expo-notifications not available');
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
  /** @deprecated Language is now managed by the i18n store. Use useTranslation() hook instead. */
  language: Language;
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
  /** @deprecated Use useTranslation().setLanguage() from '../src/i18n' instead */
  setLanguage: (lang: Language) => Promise<void>;
  addFavoriteTeam: (teamId: number) => Promise<void>;
  removeFavoriteTeam: (teamId: number) => Promise<void>;
  addFavoriteLeague: (leagueId: number) => Promise<void>;
  removeFavoriteLeague: (leagueId: number) => Promise<void>;

  // Utility Methods
  clearCache: () => Promise<void>;
  resetSettings: () => Promise<void>;
  updateLastSync: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
  language: 'ar', // Default, but actual language is managed by i18n store
  favoriteTeams: [],
  favoriteLeagues: [],
  isFirstLaunch: true,
  lastSyncTime: Date.now(),
};

const API_BASE_URL = getApiUrl();

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
  
  // Get Clerk auth for API calls
  const { getToken, isSignedIn } = useAuth();
  
  // Get language from the new i18n store
  const i18nLanguage = useLanguageStore((state) => state.language);
  const i18nSetLanguage = useLanguageStore((state) => state.setLanguage);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializeSettings();
    configureNotifications();
  }, []);
  
  // Sync settings.language with i18n store language
  useEffect(() => {
    if (!loading && settings.language !== i18nLanguage) {
      setSettings((prev) => ({ ...prev, language: i18nLanguage }));
    }
  }, [i18nLanguage, loading]);

  // Sync settings to backend whenever they change (debounce could be added here)
  useEffect(() => {
    if (!loading && !settings.isFirstLaunch) {
      syncSettingsToBackend(settings);
    }
  }, [settings]);

  const syncSettingsToBackend = async (currentSettings: SettingsState) => {
    try {
      if (!isSignedIn) return;
      
      const token = await getToken();
      if (!token) return;

      await fetch(`${API_BASE_URL}/users/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(currentSettings)
      });
    } catch (e) {
      logger.warn('Failed to sync settings', e);
    }
  };

  const loadSettingsFromBackend = async () => {
    try {
      if (!isSignedIn) return null;
      
      const token = await getToken();
      if (!token) return null;

      const res = await fetch(`${API_BASE_URL}/users/settings`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.status === 'SUCCESS' && json.data) {
        return json.data;
      }
    } catch (e) {
      logger.warn('Failed to load settings from backend', e);
    }
    return null;
  };

  const initializeSettings = async () => {
    try {
      // ✅ OPTIMIZATION: Load from local storage FIRST (instant)
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Show local settings immediately
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        setLoading(false); // ✅ Stop loading immediately after local load
        
        // ✅ OPTIMIZATION: Sync with backend in background (non-blocking)
        loadSettingsFromBackend().then(backendSettings => {
          if (backendSettings) {
            const merged = { ...DEFAULT_SETTINGS, ...parsed, ...backendSettings };
            setSettings(merged);
            AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
          }
        }).catch(err => console.warn('Background settings sync failed:', err));
        
        return; // Exit early - loading is done
      }
      
      // No local settings - try backend (this is first launch)
      const backendSettings = await loadSettingsFromBackend();
      if (backendSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...backendSettings });
        await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...DEFAULT_SETTINGS, ...backendSettings }));
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
      logger.info('Running in Expo Go - Notifications disabled. Use development build for full functionality.');
      return;
    }

    try {
      ensureNotificationForegroundHandler();

      if (Platform.OS !== 'web') {
        const { status } = await Notifications.getPermissionsAsync();
        const granted = status === 'granted';
        setSettings((prev) => ({
          ...prev,
          notificationsEnabled: granted ? true : prev.notificationsEnabled,
        }));
        if (!granted) {
          logger.debug('Notification permissions not yet granted');
        }
      }
    } catch (error) {
      logger.error('Error configuring notifications:', error);
    }
  };

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  const saveSettings = async (newSettings: SettingsState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
      setSettings(newSettings);
      // Backend sync is handled by useEffect
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

    if (!isExpoGo && Notifications) {
      try {
        if (enabled) {
          await ensureAndroidNotificationChannels();
          const status = await requestOsNotificationPermission();
          if (status !== 'granted') {
            throw new Error('Notification permissions not granted');
          }
          if (isSignedIn) {
            const authToken = await getToken();
            if (authToken) {
              await updatePushNotificationsConsent(authToken, true);
            }
            await syncExpoPushToken(getToken);
          }
        } else {
          await Notifications.cancelAllScheduledNotificationsAsync();
          if (isSignedIn) {
            const authToken = await getToken();
            if (authToken) {
              await updatePushNotificationsConsent(authToken, false);
            }
          }
        }
      } catch (error) {
        logger.error('Notification operation failed:', error);
        throw error;
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

  /**
   * @deprecated Use useTranslation().setLanguage() from '../src/i18n' instead.
   * This method now delegates to the i18n store for consistency.
   */
  const setLanguage = async (lang: Language) => {
    // Delegate to the new i18n store (Requirements: 1.2, 1.3)
    await i18nSetLanguage(lang);
    // Update local settings state to keep in sync
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

  const deleteAccount = async () => {
    try {
      if (!isSignedIn) throw new Error('Not logged in');
      
      const token = await getToken();
      if (!token) throw new Error('Not logged in');

      const res = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete account');

      // Clear local storage
      await resetSettings();
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
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
    deleteAccount,
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
        data: {
          matchId: String(matchId),
          fixtureId: String(matchId),
          type: 'MATCH_START',
          screen: '/(tabs)/match-details',
        },
        sound: true,
      },
      trigger,
    });
  } catch (error) {
    logger.error('Error scheduling notification:', error);
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
        data: { type: 'MATCH_GOAL', screen: '/(tabs)/matches' },
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
