/**
 * useTranslation Hook
 * 
 * Main translation hook providing type-safe translations, language management,
 * and locale-aware formatting functions.
 * 
 * Requirements: 3.1, 3.4, 6.1, 6.2
 */

import { useCallback, useMemo } from 'react';
import { useLanguageStore } from './store';
import { Language, TextDirection, getTextDirection } from './types';
import { getTranslation, getTranslationsForLanguage, TranslationKeys } from './utils';
import { syncToBackend } from './syncService';

/**
 * Return type for the useTranslation hook
 */
export interface UseTranslationReturn {
  /** Full translations object for current language */
  t: TranslationKeys;
  /** Current language code */
  language: Language;
  /** Set the current language (async, syncs to backend) */
  setLanguage: (lang: Language) => Promise<void>;
  /** Whether current language is RTL */
  isRTL: boolean;
  /** Text direction ('rtl' or 'ltr') */
  direction: TextDirection;
  /** Format a date according to current locale */
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  /** Format a number according to current locale */
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  /** Format currency according to current locale */
  formatCurrency: (amount: number, currency?: string) => string;
  /** Get a specific translation by key with fallback */
  translate: (key: string) => string;
  /** Whether the language store is loading */
  isLoading: boolean;
}

/**
 * Map language codes to Intl locale codes
 * Some languages need region codes for proper formatting
 */
const LOCALE_MAP: Record<Language, string> = {
  ar: 'ar-SA',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  tr: 'tr-TR',
  pt: 'pt-PT',
};

/**
 * Get the Intl locale string for a language
 */
function getLocale(language: Language): string {
  return LOCALE_MAP[language] || 'en-US';
}

/**
 * Default date format options
 */
const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

/**
 * Default number format options
 */
const DEFAULT_NUMBER_OPTIONS: Intl.NumberFormatOptions = {
  maximumFractionDigits: 2,
};


/**
 * useTranslation Hook
 * 
 * Provides access to translations, language state, and formatting utilities.
 * Updates immediately when language changes (Requirements: 6.1, 6.2).
 * 
 * @returns UseTranslationReturn object with translations and utilities
 * 
 * @example
 * ```tsx
 * const { t, language, setLanguage, formatDate, isRTL } = useTranslation();
 * 
 * return (
 *   <View style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
 *     <Text>{t.common.loading}</Text>
 *     <Text>{formatDate(new Date())}</Text>
 *   </View>
 * );
 * ```
 */
export function useTranslation(): UseTranslationReturn {
  // Get state from Zustand store
  const language = useLanguageStore(state => state.language);
  const isRTL = useLanguageStore(state => state.isRTL);
  const isLoading = useLanguageStore(state => state.isLoading);
  const storeSetLanguage = useLanguageStore(state => state.setLanguage);

  // Get text direction
  const direction = useMemo(() => getTextDirection(language), [language]);

  // Get locale for Intl APIs
  const locale = useMemo(() => getLocale(language), [language]);

  /**
   * Get the full translations object for current language
   * Memoized to prevent unnecessary re-renders
   * Requirements: 3.1 - Return translation for current language
   */
  const t = useMemo(() => getTranslationsForLanguage(language), [language]);

  /**
   * Set language with backend sync
   * Requirements: 6.1 - Update all visible text within 100ms
   * Requirements: 6.2 - No app restart required
   */
  const setLanguage = useCallback(async (lang: Language): Promise<void> => {
    // Update store immediately (triggers UI update)
    await storeSetLanguage(lang);
    
    // Sync to backend in background (don't await to keep UI responsive)
    // Token will be handled by the sync service
    syncToBackend(lang, null).catch(error => {
      console.warn('Background sync failed:', error);
    });
  }, [storeSetLanguage]);

  /**
   * Get a specific translation by dot-notation key
   * Requirements: 3.1, 3.2, 3.3 - Translation with fallback
   */
  const translate = useCallback((key: string): string => {
    return getTranslation(key, language);
  }, [language]);

  /**
   * Format a date according to current locale
   * Requirements: 3.4 - Format dates according to current locale
   */
  const formatDate = useCallback((
    date: Date,
    options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
  ): string => {
    try {
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      // Fallback to ISO string if Intl fails
      console.warn('Date formatting failed:', error);
      return date.toISOString().split('T')[0];
    }
  }, [locale]);

  /**
   * Format a number according to current locale
   * Requirements: 3.4 - Format numbers according to current locale
   */
  const formatNumber = useCallback((
    num: number,
    options: Intl.NumberFormatOptions = DEFAULT_NUMBER_OPTIONS
  ): string => {
    try {
      return new Intl.NumberFormat(locale, options).format(num);
    } catch (error) {
      // Fallback to toString if Intl fails
      console.warn('Number formatting failed:', error);
      return num.toString();
    }
  }, [locale]);

  /**
   * Format currency according to current locale
   * Requirements: 3.4 - Format currency according to current locale
   */
  const formatCurrency = useCallback((
    amount: number,
    currency: string = 'USD'
  ): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(amount);
    } catch (error) {
      // Fallback to basic format if Intl fails
      console.warn('Currency formatting failed:', error);
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, [locale]);

  return {
    t,
    language,
    setLanguage,
    isRTL,
    direction,
    formatDate,
    formatNumber,
    formatCurrency,
    translate,
    isLoading,
  };
}

/**
 * Export the locale map for testing purposes
 */
export { LOCALE_MAP, getLocale };

export default useTranslation;
