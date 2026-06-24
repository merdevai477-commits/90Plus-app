/**
 * Language Store (Zustand)
 *
 * Centralized state management for language preferences with RTL support,
 * device detection, and persistence.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, DEFAULT_LANGUAGE, isLanguageSupported } from './types';
import { detectDeviceLanguage } from './utils';
import {
  applyNativeLayoutDirection,
  clearRtlReloadFlag,
  markRtlReloadPending,
  reloadAppForLayoutDirection,
  shouldLanguageBeRTL,
  wasRtlReloadPending,
} from './layoutDirection';

export const STORAGE_KEYS = {
  LANGUAGE: '@app:language',
  LANGUAGE_INITIALIZED: '@app:language_initialized',
} as const;

export interface LanguageState {
  language: Language;
  isRTL: boolean;
  isInitialized: boolean;
  isLoading: boolean;
}

export interface LanguageActions {
  setLanguage: (lang: Language) => Promise<void>;
  initialize: () => Promise<void>;
  reset: () => void;
}

export type LanguageStore = LanguageState & LanguageActions;

const defaultState: LanguageState = {
  language: DEFAULT_LANGUAGE,
  isRTL: false,
  isInitialized: false,
  isLoading: false,
};

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

async function saveLanguage(language: Language): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
}

async function syncNativeDirectionForLanguage(language: Language): Promise<boolean> {
  const rtl = shouldLanguageBeRTL(language);
  const needsReload = applyNativeLayoutDirection(rtl);

  if (!needsReload) {
    await clearRtlReloadFlag();
    return false;
  }

  const reloadWasPending = await wasRtlReloadPending();
  if (reloadWasPending) {
    // Avoid infinite reload loops if native direction still mismatches once.
    await clearRtlReloadFlag();
    console.warn('[i18n] RTL reload already attempted; continuing without another reload.');
    return false;
  }

  await markRtlReloadPending();
  await reloadAppForLayoutDirection();
  return true;
}

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  ...defaultState,

  setLanguage: async (lang: Language) => {
    if (!isLanguageSupported(lang)) {
      console.warn(`Unsupported language: ${lang}, falling back to ${DEFAULT_LANGUAGE}`);
      lang = DEFAULT_LANGUAGE;
    }

    set({ isLoading: true });

    try {
      const rtl = shouldLanguageBeRTL(lang);
      await saveLanguage(lang);

      const reloaded = await syncNativeDirectionForLanguage(lang);
      if (reloaded) {
        return;
      }

      set({
        language: lang,
        isRTL: rtl,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to set language:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    set({ isLoading: true });

    try {
      const savedLanguage = await loadSavedLanguage();

      let languageToUse: Language;
      if (savedLanguage) {
        languageToUse = savedLanguage;
      } else {
        languageToUse = detectDeviceLanguage();
        await saveLanguage(languageToUse);
      }

      const rtl = shouldLanguageBeRTL(languageToUse);
      const reloaded = await syncNativeDirectionForLanguage(languageToUse);
      if (reloaded) {
        return;
      }

      set({
        language: languageToUse,
        isRTL: rtl,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to initialize language store:', error);
      set({
        language: DEFAULT_LANGUAGE,
        isRTL: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  reset: () => {
    set(defaultState);
  },
}));

export const selectLanguage = (state: LanguageStore) => state.language;
export const selectIsRTL = (state: LanguageStore) => state.isRTL;
export const selectIsInitialized = (state: LanguageStore) => state.isInitialized;
export const selectIsLoading = (state: LanguageStore) => state.isLoading;

export { shouldLanguageBeRTL };

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
