/**
 * Language Store (Zustand)
 * 
 * Centralized state management for language preferences with RTL support,
 * device detection, and persistence.
 * 
 * Requirements: 1.1, 2.1, 2.2, 2.4, 4.1, 4.2
 */

import { create } from 'zustand';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, DEFAULT_LANGUAGE, isLanguageSupported, isRTL as checkIsRTL } from './types';
import { detectDeviceLanguage } from './utils';

/**
 * Storage keys for language preferences
 */
export const STORAGE_KEYS = {
  LANGUAGE: '@app:language',
  LANGUAGE_INITIALIZED: '@app:language_initialized',
} as const;

/**
 * Language store state interface
 */
export interface LanguageState {
  /** Current language code */
  language: Language;
  /** Whether current language is RTL */
  isRTL: boolean;
  /** Whether the store has been initialized */
  isInitialized: boolean;
  /** Whether a language change is in progress */
  isLoading: boolean;
}

/**
 * Language store actions interface
 */
export interface LanguageActions {
  /**
   * Set the current language
   * Updates RTL settings and persists to storage
   * Requirements: 1.1, 4.1, 4.2
   */
  setLanguage: (lang: Language) => Promise<void>;
  
  /**
   * Initialize the language store
   * Loads saved preference or detects device language
   * Requirements: 2.1, 2.2, 2.4
   */
  initialize: () => Promise<void>;
  
  /**
   * Reset the store to default state (for testing)
   */
  reset: () => void;
}

/**
 * Combined store type
 */
export type LanguageStore = LanguageState & LanguageActions;

/**
 * Default state values
 */
const defaultState: LanguageState = {
  language: DEFAULT_LANGUAGE,
  isRTL: false,
  isInitialized: false,
  isLoading: false,
};

/**
 * Apply RTL settings to the app
 * Requirements: 4.1, 4.2
 */
function applyRTLSettings(shouldBeRTL: boolean): void {
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
  }
}

/**
 * Load saved language preference from storage
 * Returns null if no preference is saved
 */
async function loadSavedLanguage(): Promise<Language | null> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    if (saved && isLanguageSupported(saved)) {
      return saved;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save language preference to storage
 */
async function saveLanguage(language: Language): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
}

/**
 * Zustand language store
 * 
 * Provides centralized language state management with:
 * - RTL support (Requirements: 4.1, 4.2)
 * - Device language detection (Requirements: 2.1, 2.2)
 * - Saved preference priority (Requirements: 2.4)
 * - Immediate UI updates (Requirements: 1.1)
 */
export const useLanguageStore = create<LanguageStore>((set, get) => ({
  ...defaultState,

  /**
   * Set the current language
   * Requirements: 1.1 - Immediately update UI to selected language
   * Requirements: 4.1 - Set app direction to RTL for Arabic
   * Requirements: 4.2 - Set app direction to LTR for non-Arabic
   */
  setLanguage: async (lang: Language) => {
    // Validate language
    if (!isLanguageSupported(lang)) {
      console.warn(`Unsupported language: ${lang}, falling back to ${DEFAULT_LANGUAGE}`);
      lang = DEFAULT_LANGUAGE;
    }

    set({ isLoading: true });

    try {
      // Determine RTL status
      const shouldBeRTL = checkIsRTL(lang);
      
      // Apply RTL settings (Requirements: 4.1, 4.2)
      applyRTLSettings(shouldBeRTL);
      
      // Update state immediately (Requirements: 1.1)
      set({
        language: lang,
        isRTL: shouldBeRTL,
        isLoading: false,
      });
      
      // Persist to storage
      await saveLanguage(lang);
    } catch (error) {
      console.error('Failed to set language:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Initialize the language store
   * Requirements: 2.1 - Detect device's system language on first launch
   * Requirements: 2.2 - Set detected language as default if supported
   * Requirements: 2.4 - Use saved preference over device detection
   */
  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    set({ isLoading: true });

    try {
      // Try to load saved preference first (Requirements: 2.4)
      const savedLanguage = await loadSavedLanguage();
      
      let languageToUse: Language;
      
      if (savedLanguage) {
        // Use saved preference (Requirements: 2.4)
        languageToUse = savedLanguage;
      } else {
        // Detect device language (Requirements: 2.1, 2.2)
        languageToUse = detectDeviceLanguage();
        // Save the detected language for future use
        await saveLanguage(languageToUse);
      }
      
      // Determine RTL status
      const shouldBeRTL = checkIsRTL(languageToUse);
      
      // Apply RTL settings
      applyRTLSettings(shouldBeRTL);
      
      // Update state
      set({
        language: languageToUse,
        isRTL: shouldBeRTL,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to initialize language store:', error);
      // Fall back to default language on error
      set({
        language: DEFAULT_LANGUAGE,
        isRTL: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  /**
   * Reset the store to default state
   * Useful for testing
   */
  reset: () => {
    set(defaultState);
  },
}));

/**
 * Selector hooks for specific state values
 */
export const selectLanguage = (state: LanguageStore) => state.language;
export const selectIsRTL = (state: LanguageStore) => state.isRTL;
export const selectIsInitialized = (state: LanguageStore) => state.isInitialized;
export const selectIsLoading = (state: LanguageStore) => state.isLoading;

/**
 * Helper function to determine if a language should use RTL
 * Exported for testing purposes
 * Requirements: 4.2 - Non-Arabic languages should be LTR
 */
export function shouldLanguageBeRTL(language: Language): boolean {
  return checkIsRTL(language);
}

/**
 * Helper function to determine language from device or saved preference
 * Exported for testing purposes
 * Requirements: 2.2, 2.4
 */
export async function determineInitialLanguage(): Promise<{
  language: Language;
  source: 'saved' | 'device';
}> {
  const savedLanguage = await loadSavedLanguage();
  
  if (savedLanguage) {
    return { language: savedLanguage, source: 'saved' };
  }
  
  return { language: detectDeviceLanguage(), source: 'device' };
}
