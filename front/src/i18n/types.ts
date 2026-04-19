/**
 * Internationalization Types and Constants
 * 
 * This file defines the core types and constants for the i18n system.
 * Requirements: 7.1, 7.2, 7.3
 */

/**
 * Supported language codes
 */
export type Language = 'ar' | 'en' | 'fr' | 'es' | 'de' | 'it' | 'tr' | 'pt';

/**
 * Text direction for languages
 */
export type TextDirection = 'rtl' | 'ltr';

/**
 * Language metadata interface
 */
export interface LanguageInfo {
  /** ISO 639-1 language code */
  code: Language;
  /** English name of the language */
  name: string;
  /** Name in native script */
  nativeName: string;
  /** Flag emoji representing the language */
  flag: string;
  /** Text direction (RTL or LTR) */
  direction: TextDirection;
}

/**
 * All supported languages with metadata
 * Requirements: 7.1 - Display all 8 supported languages
 * Requirements: 7.2 - Show each language name in its native script
 * Requirements: 7.3 - Show a flag or icon for each language
 */
export const SUPPORTED_LANGUAGES: readonly LanguageInfo[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', direction: 'rtl' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', direction: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', direction: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', direction: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', direction: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', direction: 'ltr' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', direction: 'ltr' },
] as const;

/**
 * Default language when no preference is set or detected language is unsupported
 */
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * Set of supported language codes for quick lookup
 */
export const SUPPORTED_LANGUAGE_CODES: ReadonlySet<string> = new Set(
  SUPPORTED_LANGUAGES.map(lang => lang.code)
);

/**
 * Helper function to check if a language code is supported
 */
export function isLanguageSupported(code: string): code is Language {
  return SUPPORTED_LANGUAGE_CODES.has(code);
}

/**
 * Get language info by code
 */
export function getLanguageInfo(code: Language): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

/**
 * Get text direction for a language
 */
export function getTextDirection(code: Language): TextDirection {
  const info = getLanguageInfo(code);
  return info?.direction ?? 'ltr';
}

/**
 * Check if a language is RTL
 */
export function isRTL(code: Language): boolean {
  return getTextDirection(code) === 'rtl';
}
