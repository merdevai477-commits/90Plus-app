import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppSettingsActions } from './types/app';
import { Platform, Dimensions } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { nanoid } from 'nanoid/non-secure';

const { width, height } = Dimensions.get('window');

// Initial States
const initialTheme = {
  mode: 'light' as const,
  fontScale: 1,
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    error: '#FF3B30',
    warning: '#FF9500',
    success: '#34C759',
    info: '#5AC8FA',
  },
};

const initialLanguage = {
  current: 'ar',
  available: ['ar', 'en'],
  direction: 'rtl' as const,
  fallback: 'en',
  autoDetect: false,
};

const initialNotifications = {
  enabled: true,
  types: {
    marketing: true,
    system: true,
    messages: true,
    updates: true,
    reminders: true,
  },
  sound: true,
  vibration: true,
  badge: true,
};

const initialSecurity = {
  pinEnabled: false,
  biometricEnabled: false,
  permissions: {
    camera: false,
    location: false,
    storage: false,
    contacts: false,
    microphone: false,
    notifications: false,
  },
  autoLockMinutes: 5,
  failedAttempts: 0,
  maxFailedAttempts: 5,
  secureScreenshot: false,
};

const initialUI = {
  modal: {
    visible: false,
  },
  loading: false,
  snackbar: {
    visible: false,
    message: '',
    type: 'info' as const,
  },
  isTabBarVisible: true,
  statusBarStyle: 'auto' as const,
  orientation: 'portrait' as const,
};

const initialPreferences = {
  defaultTab: 'home',
  lastScrollPositions: {},
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h' as const,
  currency: 'SAR',
  measurementUnit: 'metric' as const,
  compactMode: false,
  animations: true,
};

const initialFeatures = {
  flags: {},
  experimentsEnabled: false,
  betaFeatures: false,
  debugMode: __DEV__,
};

const initialAnalytics = {
  enabled: true,
  events: [],
  crashReporting: true,
  performanceMonitoring: true,
};

const initialRemoteConfig = {
  config: {},
  fetchInterval: 3600000, // 1 hour
  isStale: true,
};

// Device Info Helper
const getDeviceInfo = () => ({
  os: Platform.OS as 'ios' | 'android' | 'web',
  osVersion: Platform.Version.toString(),
  appVersion: Application.nativeApplicationVersion || '1.0.0',
  buildNumber: Application.nativeBuildVersion || '1',
  deviceModel: Device.modelName || 'Unknown',
  deviceName: Device.deviceName || 'Unknown',
  brand: Device.brand || 'Unknown',
  screenWidth: width,
  screenHeight: height,
  hasNotch: Platform.OS === 'ios' && height >= 812, // iPhone X and later
  isDevice: Device.isDevice ?? true,
  deviceType: Device.deviceType || Device.DeviceType.PHONE,
});
// Main Store
interface AppSettingsStore extends AppState, AppSettingsActions {}

export const useAppSettings = create<AppSettingsStore>()(
  persist(
    (set, get) => ({
      // Initial State
      theme: initialTheme,
      language: initialLanguage,
      notifications: initialNotifications,
      security: initialSecurity,
      ui: initialUI,
      preferences: initialPreferences,
      features: initialFeatures,
      remoteConfig: initialRemoteConfig,
      analytics: initialAnalytics,
      version: Application.nativeApplicationVersion || '1.0.0',
      deviceInfo: getDeviceInfo(),
      lastLogin: Date.now(),
      sessionInfo: {
        sessionId: nanoid(),
        startTime: Date.now(),
        lastActivity: Date.now(),
        isActive: true,
      },

      // Theme Actions
      toggleTheme: () => {
        const currentMode = get().theme.mode;
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        set((state) => ({
          theme: { ...state.theme, mode: newMode },
        }));
      },

      setTheme: (mode) => {
        set((state) => ({
          theme: { ...state.theme, mode },
        }));
      },

      setFontScale: (scale) => {
        set((state) => ({
          theme: { ...state.theme, fontScale: scale },
        }));
      },

      setColors: (colors) => {
        set((state) => ({
          theme: {
            ...state.theme,
            colors: { ...state.theme.colors, ...colors },
          },
        }));
      },

      // Language Actions
      setLanguage: (lang) => {
        const direction = lang === 'ar' ? 'rtl' : 'ltr';
        set((state) => ({
          language: { ...state.language, current: lang, direction },
        }));
      },

      setDirection: (dir) => {
        set((state) => ({
          language: { ...state.language, direction: dir },
        }));
      },

      autoDetectLanguage: () => {
        // Implementation depends on device locale
        const deviceLocale = 'ar'; // Get from device
        get().setLanguage(deviceLocale);
      },

      // Notifications Actions
      toggleNotifications: (enabled) => {
        set((state) => ({
          notifications: { ...state.notifications, enabled },
        }));
      },

      toggleNotificationType: (type) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            types: {
              ...state.notifications.types,
              [type]: !state.notifications.types[type],
            },
          },
        }));
      },

      setPushToken: (token) => {
        set((state) => ({
          notifications: { ...state.notifications, pushToken: token },
        }));
      },

      // Security Actions
      setPIN: (enabled, pin) => {
        set((state) => ({
          security: { ...state.security, pinEnabled: enabled, pin },
        }));
      },

      setBiometric: (enabled) => {
        set((state) => ({
          security: { ...state.security, biometricEnabled: enabled },
        }));
      },

      setPermission: (type, value) => {
        set((state) => ({
          security: {
            ...state.security,
            permissions: {
              ...state.security.permissions,
              [type]: value,
            },
          },
        }));
      },

      setAutoLock: (minutes) => {
        set((state) => ({
          security: { ...state.security, autoLockMinutes: minutes },
        }));
      },

      // UI Actions
      showModal: (modalId) => {
        set((state) => ({
          ui: {
            ...state.ui,
            modal: { visible: true, modalId },
          },
        }));
      },

      hideModal: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            modal: { visible: false },
          },
        }));
      },

      setLoading: (loading) => {
        set((state) => ({
          ui: { ...state.ui, loading },
        }));
      },

      showSnackbar: (message, type = 'info') => {
        set((state) => ({
          ui: {
            ...state.ui,
            snackbar: { visible: true, message, type },
          },
        }));
        
        // Auto hide after 3 seconds
        setTimeout(() => {
          get().hideSnackbar();
        }, 3000);
      },

      hideSnackbar: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            snackbar: { ...state.ui.snackbar, visible: false },
          },
        }));
      },

      // Preferences Actions
      setDefaultTab: (tab) => {
        set((state) => ({
          preferences: { ...state.preferences, defaultTab: tab },
        }));
      },

      setLastScrollPosition: (page, position) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            lastScrollPositions: {
              ...state.preferences.lastScrollPositions,
              [page]: position,
            },
          },
        }));
      },

      setThemeOverrides: (overrides) => {
        set((state) => ({
          preferences: { ...state.preferences, themeOverrides: overrides },
        }));
      },

      // Feature Flags Actions
      toggleFeature: (flag) => {
        set((state) => ({
          features: {
            ...state.features,
            flags: {
              ...state.features.flags,
              [flag]: !state.features.flags[flag],
            },
          },
        }));
      },

      setFeature: (flag, value) => {
        set((state) => ({
          features: {
            ...state.features,
            flags: {
              ...state.features.flags,
              [flag]: value,
            },
          },
        }));
      },

      // Remote Config Actions
      fetchRemoteConfig: async () => {
        try {
          // Fetch from your backend
          const response = await fetch('https://api.yourapp.com/config');
          const config = await response.json();
          
          set((state) => ({
            remoteConfig: {
              ...state.remoteConfig,
              config,
              lastFetch: Date.now(),
              isStale: false,
            },
          }));
        } catch (error) {
          console.error('Failed to fetch remote config:', error);
        }
      },

      setRemoteConfig: (config) => {
        set((state) => ({
          remoteConfig: {
            ...state.remoteConfig,
            config,
            lastFetch: Date.now(),
            isStale: false,
          },
        }));
      },

      // Analytics Actions
      setAnalyticsEnabled: (enabled) => {
        set((state) => ({
          analytics: { ...state.analytics, enabled },
        }));
      },

      logEvent: (eventName, data) => {
        if (!get().analytics.enabled) return;
        
        const event = {
          name: eventName,
          timestamp: Date.now(),
          properties: data,
          userId: get().analytics.userId,
          sessionId: get().sessionInfo?.sessionId,
        };
        
        set((state) => ({
          analytics: {
            ...state.analytics,
            events: [...state.analytics.events, event].slice(-100), // Keep last 100 events
          },
        }));
        
        // Send to analytics service
        console.log('📊 Analytics Event:', event);
      },

      // General Actions
      resetSettings: () => {
        set({
          theme: initialTheme,
          language: initialLanguage,
          notifications: initialNotifications,
          security: initialSecurity,
          ui: initialUI,
          preferences: initialPreferences,
          features: initialFeatures,
          analytics: initialAnalytics,
        });
      },

      loadSettings: async () => {
        // Settings are auto-loaded by zustand persist
        console.log('Settings loaded');
      },

      saveSettings: async () => {
        // Settings are auto-saved by zustand persist
        console.log('Settings saved');
      },
    }),
    {
      name: 'app-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        notifications: state.notifications,
        security: state.security,
        preferences: state.preferences,
        features: state.features,
        analytics: {
          ...state.analytics,
          events: [], // Don't persist events
        },
      }),
    }
  )
);

// Helper Hooks
export const useTheme = () => useAppSettings((state) => state.theme);
export const useLanguage = () => useAppSettings((state) => state.language);
export const useNotifications = () => useAppSettings((state) => state.notifications);
export const useSecurity = () => useAppSettings((state) => state.security);
export const useUI = () => useAppSettings((state) => state.ui);
export const usePreferences = () => useAppSettings((state) => state.preferences);
export const useFeatures = () => useAppSettings((state) => state.features);
export const useAnalytics = () => useAppSettings((state) => state.analytics);