/**
 * Translation Utility Functions
 * 
 * This file provides utility functions for the i18n system including
 * translation retrieval with fallback logic, language detection, and validation.
 * 
 * Requirements: 3.1, 3.2, 3.3, 2.1
 */

import { NativeModules, Platform } from 'react-native';
import { Language, DEFAULT_LANGUAGE, isLanguageSupported, SUPPORTED_LANGUAGE_CODES } from './types';

// Import all translation files
import { en } from '../../locales/en';
import { ar } from '../../locales/ar';
import { fr } from '../../locales/fr';
import { es } from '../../locales/es';
import { de } from '../../locales/de';
import { it } from '../../locales/it';
import { tr } from '../../locales/tr';
import { pt } from '../../locales/pt';

/**
 * Type for translation keys (nested object structure)
 */
export type TranslationKeys = typeof en;

/**
 * Map of all translations by language code
 */
export const translations: Record<Language, TranslationKeys> = {
  en,
  ar: ar as unknown as TranslationKeys,
  fr: fr as unknown as TranslationKeys,
  es: es as unknown as TranslationKeys,
  de: de as unknown as TranslationKeys,
  it: it as unknown as TranslationKeys,
  tr: tr as unknown as TranslationKeys,
  pt: pt as unknown as TranslationKeys,
};

/**
 * Get a nested value from an object using a dot-notation key
 * @param obj - The object to traverse
 * @param key - Dot-notation key (e.g., 'common.loading')
 * @returns The value at the key path, or undefined if not found
 */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const keys = key.split('.');
  let current: unknown = obj;
  
  for (const k of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[k];
  }
  
  return current;
}

/**
 * Get translation for a key in the specified language with fallback logic
 * 
 * Fallback order:
 * 1. Translation in requested language
 * 2. Translation in English (if different from requested)
 * 3. The key itself
 * 
 * Requirements:
 * - 3.1: Return translation for current language
 * - 3.2: Return English fallback if missing in target language
 * - 3.3: Return key itself if missing in all languages
 * 
 * @param key - Dot-notation translation key (e.g., 'common.loading')
 * @param language - Target language code
 * @returns The translated string or the key if not found
 */
export function getTranslation(key: string, language: Language): string {
  // Validate language, fall back to English if unsupported
  const targetLang = isLanguageSupported(language) ? language : DEFAULT_LANGUAGE;
  
  // Try to get translation in target language
  const targetTranslations = translations[targetLang];
  const targetValue = getNestedValue(targetTranslations as unknown as Record<string, unknown>, key);
  
  if (typeof targetValue === 'string' && targetValue.length > 0) {
    return targetValue;
  }
  
  // Fallback to English if target language is not English
  if (targetLang !== DEFAULT_LANGUAGE) {
    const englishTranslations = translations[DEFAULT_LANGUAGE];
    const englishValue = getNestedValue(englishTranslations as unknown as Record<string, unknown>, key);
    
    if (typeof englishValue === 'string' && englishValue.length > 0) {
      return englishValue;
    }
  }
  
  // Return the key itself as final fallback
  return key;
}

/**
 * Check if a language code is supported
 * Re-exported from types for convenience
 * 
 * @param code - Language code to check
 * @returns True if the language is supported
 */
export { isLanguageSupported };

/**
 * Detect the device's system language
 * 
 * Requirements:
 * - 2.1: Detect device's system language on first launch
 * - 2.3: Fall back to English if detected language is not supported
 * 
 * @returns The detected language code, or English if unsupported
 */
export function detectDeviceLanguage(): Language {
  let deviceLanguage: string | undefined;
  
  try {
    // First try expo-localization (most reliable for Expo apps)
    try {
      const Localization = require('expo-localization');
      if (Localization?.getLocales) {
        const locales = Localization.getLocales();
        if (locales && locales.length > 0) {
          deviceLanguage = locales[0].languageCode;
        }
      } else if (Localization?.locale) {
        deviceLanguage = Localization.locale;
      }
    } catch {
      // expo-localization not available, try native modules
    }
    
    // Fallback to native modules if expo-localization didn't work
    if (!deviceLanguage) {
      if (Platform.OS === 'ios') {
        // iOS: Get language from settings
        deviceLanguage = 
          NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
      } else if (Platform.OS === 'android') {
        // Android: Try multiple methods to get the language
        deviceLanguage = 
          NativeModules.I18nManager?.localeIdentifier ||
          NativeModules.DeviceInfo?.locale ||
          NativeModules.SettingsManager?.settings?.locale;
      } else if (Platform.OS === 'web') {
        // Web: Get language from navigator
        deviceLanguage = typeof navigator !== 'undefined' 
          ? navigator.language || (navigator as { userLanguage?: string }).userLanguage
          : undefined;
      }
    }
  } catch {
    // If we can't detect, fall back to English
    deviceLanguage = undefined;
  }
  
  if (!deviceLanguage) {
    return DEFAULT_LANGUAGE;
  }
  
  // Extract the language code (e.g., 'en-US' -> 'en', 'ar_SA' -> 'ar')
  const languageCode = deviceLanguage.split(/[-_]/)[0].toLowerCase();
  
  // Check if the detected language is supported
  if (isLanguageSupported(languageCode)) {
    return languageCode;
  }
  
  // Fall back to English for unsupported languages
  return DEFAULT_LANGUAGE;
}

/**
 * Get all translation keys from the English translation file
 * Useful for validation and testing
 * 
 * @returns Array of all dot-notation translation keys
 */
export function getAllTranslationKeys(): string[] {
  const keys: string[] = [];
  
  function extractKeys(obj: Record<string, unknown>, prefix: string = ''): void {
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        extractKeys(value as Record<string, unknown>, fullKey);
      } else {
        keys.push(fullKey);
      }
    }
  }
  
  extractKeys(translations[DEFAULT_LANGUAGE] as unknown as Record<string, unknown>);
  return keys;
}

/**
 * Check if a translation key exists in a specific language
 * 
 * @param key - Dot-notation translation key
 * @param language - Language code to check
 * @returns True if the key exists and has a non-empty value
 */
export function hasTranslation(key: string, language: Language): boolean {
  if (!isLanguageSupported(language)) {
    return false;
  }
  
  const value = getNestedValue(translations[language] as unknown as Record<string, unknown>, key);
  return typeof value === 'string' && value.length > 0;
}

/**
 * Get the full translations object for a language
 * 
 * @param language - Language code
 * @returns The translations object for the language
 */
export function getTranslationsForLanguage(language: Language): TranslationKeys {
  if (!isLanguageSupported(language)) {
    return translations[DEFAULT_LANGUAGE];
  }
  return translations[language];
}
