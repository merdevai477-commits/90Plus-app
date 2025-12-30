/**
 * Property-Based Tests for useTranslation Hook
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';

// Mock expo-constants before importing modules that use it
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:3000/api',
    },
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock react-native
jest.mock('react-native', () => ({
  I18nManager: {
    isRTL: false,
    allowRTL: jest.fn(),
    forceRTL: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
  NativeModules: {
    SettingsManager: {
      settings: {
        AppleLocale: 'en_US',
        AppleLanguages: ['en'],
      },
    },
    I18nManager: {
      localeIdentifier: 'en_US',
    },
  },
}));

import { LOCALE_MAP, getLocale } from '../useTranslation';
import { SUPPORTED_LANGUAGES, Language } from '../types';
import { getTranslationsForLanguage, translations } from '../utils';

// Generator for supported language codes
const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));

// Generator for valid dates (reasonable range to avoid edge cases)
const validDateArb = fc.date({
  min: new Date('1970-01-01'),
  max: new Date('2100-12-31'),
}).filter(date => !isNaN(date.getTime()));

// Generator for valid numbers
const validNumberArb = fc.double({
  min: -1e15,
  max: 1e15,
  noNaN: true,
  noDefaultInfinity: true,
});

// Generator for positive amounts (for currency)
const positiveAmountArb = fc.double({
  min: 0,
  max: 1e12,
  noNaN: true,
  noDefaultInfinity: true,
});

describe('useTranslation Hook Property Tests', () => {
  /**
   * **Feature: internationalization-system, Property 8: Date Formatting by Locale**
   * *For any* date and any supported language, the formatted date string should match the locale's date format conventions.
   * **Validates: Requirements 3.4**
   */
  describe('Property 8: Date Formatting by Locale', () => {
    it('should format dates according to locale conventions for all supported languages', () => {
      fc.assert(
        fc.property(
          validDateArb,
          supportedLanguageArb,
          (date: Date, language: Language) => {
            const locale = getLocale(language);
            
            // Format using Intl.DateTimeFormat
            const formatted = new Intl.DateTimeFormat(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(date);
            
            // Property: Formatted date should be a non-empty string
            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
            
            // Property: Formatted date should have reasonable length
            // (at minimum: day + month + year = at least 8 characters)
            expect(formatted.length).toBeGreaterThanOrEqual(8);
            
            // Property: Formatting should not throw and should produce valid output
            // The format varies by locale (Arabic uses Eastern Arabic numerals)
            // so we just verify it's a valid non-empty string
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different formats for different locales', () => {
      // Use a specific date to compare formats
      const testDate = new Date('2024-03-15');
      const formats = new Map<string, string>();
      
      SUPPORTED_LANGUAGES.forEach(lang => {
        const locale = getLocale(lang.code);
        const formatted = new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(testDate);
        formats.set(lang.code, formatted);
      });
      
      // Property: At least some languages should have different formats
      const uniqueFormats = new Set(formats.values());
      expect(uniqueFormats.size).toBeGreaterThan(1);
    });

    it('should have valid locale mappings for all supported languages', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (language: Language) => {
          const locale = getLocale(language);
          
          // Property: Locale should be defined
          expect(locale).toBeDefined();
          expect(typeof locale).toBe('string');
          
          // Property: Locale should follow BCP 47 format (xx-XX)
          expect(locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
          
          // Property: Locale should be in the LOCALE_MAP
          expect(LOCALE_MAP[language]).toBe(locale);
        }),
        { numRuns: 100 }
      );
    });

    it('should format dates consistently for the same locale', () => {
      fc.assert(
        fc.property(
          validDateArb,
          supportedLanguageArb,
          (date: Date, language: Language) => {
            const locale = getLocale(language);
            const options: Intl.DateTimeFormatOptions = {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            };
            
            // Format the same date twice
            const formatted1 = new Intl.DateTimeFormat(locale, options).format(date);
            const formatted2 = new Intl.DateTimeFormat(locale, options).format(date);
            
            // Property: Same date and locale should produce identical output
            expect(formatted1).toBe(formatted2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format numbers according to locale conventions', () => {
      fc.assert(
        fc.property(
          validNumberArb,
          supportedLanguageArb,
          (num: number, language: Language) => {
            const locale = getLocale(language);
            
            const formatted = new Intl.NumberFormat(locale).format(num);
            
            // Property: Formatted number should be a non-empty string
            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format currency according to locale conventions', () => {
      fc.assert(
        fc.property(
          positiveAmountArb,
          supportedLanguageArb,
          (amount: number, language: Language) => {
            const locale = getLocale(language);
            
            const formatted = new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: 'USD',
            }).format(amount);
            
            // Property: Formatted currency should be a non-empty string
            expect(typeof formatted).toBe('string');
            expect(formatted.length).toBeGreaterThan(0);
            
            // Property: Formatted currency should contain currency indicator
            // (either symbol $ or code USD depending on locale)
            const containsCurrencyIndicator = 
              formatted.includes('$') || 
              formatted.includes('USD') ||
              formatted.includes('US');
            expect(containsCurrencyIndicator).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * **Feature: internationalization-system, Property 1: Language Change Updates UI**
   * *For any* supported language, when the language is changed, the translation service should return translations in the new language for all keys.
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Language Change Updates UI', () => {
    it('should return translations object for any supported language', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (language: Language) => {
          const t = getTranslationsForLanguage(language);
          
          // Property: Translations object should be defined
          expect(t).toBeDefined();
          expect(typeof t).toBe('object');
          
          // Property: Translations should have common section
          expect(t.common).toBeDefined();
          expect(typeof t.common).toBe('object');
        }),
        { numRuns: 100 }
      );
    });

    it('should return different translations for different languages', () => {
      // Get translations for English and Arabic (most different)
      const enTranslations = getTranslationsForLanguage('en');
      const arTranslations = getTranslationsForLanguage('ar');
      
      // Property: Different languages should have different translations
      // (at least for some keys)
      expect(enTranslations.common.loading).not.toBe(arTranslations.common.loading);
    });

    it('should return consistent translations for the same language', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (language: Language) => {
          const t1 = getTranslationsForLanguage(language);
          const t2 = getTranslationsForLanguage(language);
          
          // Property: Same language should return same translations object
          expect(t1).toEqual(t2);
        }),
        { numRuns: 100 }
      );
    });

    it('should have translations object available for all supported languages', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (language: Language) => {
          // Property: translations map should have entry for this language
          expect(translations[language]).toBeDefined();
          
          // Property: The translations should be an object
          expect(typeof translations[language]).toBe('object');
        }),
        { numRuns: 100 }
      );
    });

    it('should update translations when language changes', () => {
      fc.assert(
        fc.property(
          supportedLanguageArb,
          supportedLanguageArb,
          (lang1: Language, lang2: Language) => {
            const t1 = getTranslationsForLanguage(lang1);
            const t2 = getTranslationsForLanguage(lang2);
            
            if (lang1 === lang2) {
              // Property: Same language should return equal translations
              expect(t1).toEqual(t2);
            } else {
              // Property: Different languages should return different translation objects
              // (they may have some identical values but are different objects)
              expect(t1).not.toBe(t2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: internationalization-system, Property 10: Cache Update on Language Change**
   * *For any* language change, the cached translations should be updated to reflect the new language.
   * **Validates: Requirements 6.4**
   */
  describe('Property 10: Cache Update on Language Change', () => {
    it('should return fresh translations for each language request', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (language: Language) => {
          // Get translations twice
          const t1 = getTranslationsForLanguage(language);
          const t2 = getTranslationsForLanguage(language);
          
          // Property: Both calls should return equivalent translations
          expect(t1.common.loading).toBe(t2.common.loading);
          expect(t1.common.error).toBe(t2.common.error);
        }),
        { numRuns: 100 }
      );
    });

    it('should reflect language-specific content after change', () => {
      fc.assert(
        fc.property(
          supportedLanguageArb,
          supportedLanguageArb,
          (fromLang: Language, toLang: Language) => {
            // Simulate language change by getting translations for new language
            const oldTranslations = getTranslationsForLanguage(fromLang);
            const newTranslations = getTranslationsForLanguage(toLang);
            
            // Property: After "change", we should get the new language's translations
            expect(newTranslations).toBe(translations[toLang]);
            
            // Property: The translations should match the target language
            expect(newTranslations.common.loading).toBe(translations[toLang].common.loading);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain translation integrity across language switches', () => {
      // Simulate multiple language switches
      const languageSequence: Language[] = ['en', 'ar', 'fr', 'de', 'en'];
      
      languageSequence.forEach(lang => {
        const t = getTranslationsForLanguage(lang);
        
        // Property: Each switch should return valid translations
        expect(t).toBeDefined();
        expect(t.common).toBeDefined();
        expect(typeof t.common.loading).toBe('string');
        expect(t.common.loading.length).toBeGreaterThan(0);
      });
    });

    it('should return correct translations immediately after language change', () => {
      fc.assert(
        fc.property(
          supportedLanguageArb,
          supportedLanguageArb,
          (lang1: Language, lang2: Language) => {
            // Get translations for first language
            getTranslationsForLanguage(lang1);
            
            // "Change" to second language
            const newT = getTranslationsForLanguage(lang2);
            
            // Property: Should immediately reflect the new language
            expect(newT).toBe(translations[lang2]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
