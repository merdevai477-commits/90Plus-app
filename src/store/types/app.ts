import { ThemeState } from './theme';
import { LanguageState } from './language';
import { NotificationsState } from './notifications';
import { SecurityState } from './security';
import { UIState } from './ui';
import { PreferencesState } from './preferences';
import { FeatureFlagsState } from './features';
import { AnalyticsState } from './analytics';
import { RemoteConfigState } from './remoteConfig';

// Device Info Type
export interface DeviceInfo {
  os: 'ios' | 'android' | 'web';
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  deviceModel: string;
  screenWidth: number;
  screenHeight: number;
  hasNotch: boolean;
}

// Session Info Type
export interface SessionInfo {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  isActive: boolean;
}

// Main App State
export interface AppState {
  // Theme & Appearance
  theme: ThemeState;
  
  // Language & Localization
  language: LanguageState;
  
  // Notifications
  notifications: NotificationsState;
  
  // Security
  security: SecurityState;
  
  // UI State
  ui: UIState;
  
  // User Preferences
  preferences: PreferencesState;
  
  // Feature Flags
  features: FeatureFlagsState;
  
  // Remote Config
  remoteConfig: RemoteConfigState;
  
  // Analytics
  analytics: AnalyticsState;
  
  // General Info
  version: string;
  deviceInfo: DeviceInfo;
  lastLogin?: number;
  sessionInfo?: SessionInfo;
}

// App Settings Actions
export interface AppSettingsActions {
  // Theme Actions
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setFontScale: (scale: number) => void;
  setColors: (colors: Partial<ThemeState['colors']>) => void;
  
  // Language Actions
  setLanguage: (lang: string) => void;
  setDirection: (dir: 'ltr' | 'rtl') => void;
  autoDetectLanguage: () => void;
  
  // Notifications Actions
  toggleNotifications: (enabled: boolean) => void;
  toggleNotificationType: (type: keyof NotificationsState['types']) => void;
  setPushToken: (token: string) => void;
  
  // Security Actions
  setPIN: (enabled: boolean, pin?: string) => void;
  setBiometric: (enabled: boolean) => void;
  setPermission: (type: keyof SecurityState['permissions'], value: boolean) => void;
  setAutoLock: (minutes: number) => void;
  
  // UI Actions
  showModal: (modalId?: string) => void;
  hideModal: () => void;
  setLoading: (loading: boolean) => void;
  showSnackbar: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  hideSnackbar: () => void;
  
  // Preferences Actions
  setDefaultTab: (tab: string) => void;
  setLastScrollPosition: (page: string, position: number) => void;
  setThemeOverrides: (overrides: Record<string, any>) => void;
  
  // Feature Flags Actions
  toggleFeature: (flag: string) => void;
  setFeature: (flag: string, value: boolean) => void;
  
  // Remote Config Actions
  fetchRemoteConfig: () => Promise<void>;
  setRemoteConfig: (config: Record<string, any>) => void;
  
  // Analytics Actions
  setAnalyticsEnabled: (enabled: boolean) => void;
  logEvent: (eventName: string, data?: Record<string, any>) => void;
  
  // General Actions
  resetSettings: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}