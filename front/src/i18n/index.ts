/**
 * Internationalization System - Main Entry Point
 * 
 * This file exports all types, hooks, and utilities for the i18n system.
 * Import from this file for easy access to all i18n functionality.
 * 
 * Requirements: 5.1, 5.4
 * 
 * @example
 * ```tsx
 * import { useTranslation, Language, SUPPORTED_LANGUAGES } from '@/src/i18n';
 * 
 * const { t, language, setLanguage, isRTL, formatDate } = useTranslation();
 * ```
 */

// ============================================================================
// Types and Constants
// ============================================================================

export {
  // Types
  type Language,
  type TextDirection,
  type LanguageInfo,
  
  // Constants
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGE_CODES,
  
  // Type guards and helpers
  isLanguageSupported,
  getLanguageInfo,
  getTextDirection,
  isRTL,
} from './types';

// ============================================================================
// Translation Utilities
// ============================================================================

export {
  // Types
  type TranslationKeys,
  
  // Translation functions
  getTranslation,
  getTranslationsForLanguage,
  getAllTranslationKeys,
  hasTranslation,
  
  // Device detection
  detectDeviceLanguage,
  
  // Translations map
  translations,
} from './utils';

export { formatXpLabel, arabicPointWord } from './formatXp';

// ============================================================================
// Language Store (Zustand)
// ============================================================================

export {
  // Store hook
  useLanguageStore,
  
  // Types
  type LanguageState,
  type LanguageActions,
  type LanguageStore,
  
  // Storage keys
  STORAGE_KEYS,
  
  // Selectors
  selectLanguage,
  selectIsRTL,
  selectIsInitialized,
  selectIsLoading,
  
  // Helper functions
  shouldLanguageBeRTL,
  determineInitialLanguage,
} from './store';

// ============================================================================
// Sync Service
// ============================================================================

export {
  // Functions
  syncToBackend,
  fetchFromBackend,
  getPendingSync,
  processPendingSync,
  hasPendingSync,
  getLastSyncedLanguage,
  
  // Types
  type SyncResult,
  
  // Storage keys
  SYNC_STORAGE_KEYS,
  
  // Class and singleton
  LanguageSyncService,
  languageSyncService,
} from './syncService';

// ============================================================================
// Main Translation Hook
// ============================================================================

export {
  // Main hook
  useTranslation,
  
  // Types
  type UseTranslationReturn,
  
  // Locale utilities
  LOCALE_MAP,
  getLocale,
} from './useTranslation';

// Default export for convenience
export { useTranslation as default } from './useTranslation';
