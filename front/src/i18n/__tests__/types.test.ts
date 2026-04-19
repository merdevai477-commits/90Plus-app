/**
 * Property-Based Tests for i18n Types
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import {
  SUPPORTED_LANGUAGES,
  Language,
  LanguageInfo,
  isLanguageSupported,
  getLanguageInfo,
  getTextDirection,
  isRTL,
  SUPPORTED_LANGUAGE_CODES,
} from '../types';

describe('i18n Types Property Tests', () => {
  /**
   * **Feature: internationalization-system, Property 11: Native Language Names**
   * *For any* supported language, the language info should include a non-empty native name in its own script.
   * **Validates: Requirements 7.2**
   */
  describe('Property 11: Native Language Names', () => {
    // Generator for supported language codes
    const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));

    it('should have non-empty native name for any supported language', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const langInfo = getLanguageInfo(langCode);
          
          // Property: Language info must exist
          expect(langInfo).toBeDefined();
          
          // Property: Native name must be a non-empty string
          expect(typeof langInfo!.nativeName).toBe('string');
          expect(langInfo!.nativeName.length).toBeGreaterThan(0);
          expect(langInfo!.nativeName.trim().length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have unique native names for each language', () => {
      const nativeNames = SUPPORTED_LANGUAGES.map(l => l.nativeName);
      const uniqueNames = new Set(nativeNames);
      
      // Property: All native names should be unique
      expect(uniqueNames.size).toBe(nativeNames.length);
    });

    it('should have native name different from English name for non-English languages', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const langInfo = getLanguageInfo(langCode);
          
          // For non-English languages, native name should differ from English name
          if (langCode !== 'en') {
            expect(langInfo!.nativeName).not.toBe(langInfo!.name);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: internationalization-system, Property 12: Language Flags**
   * *For any* supported language, the language info should include a flag emoji.
   * **Validates: Requirements 7.3**
   */
  describe('Property 12: Language Flags', () => {
    // Generator for supported language codes
    const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));

    it('should have a flag emoji for any supported language', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const langInfo = getLanguageInfo(langCode);
          
          // Property: Language info must exist
          expect(langInfo).toBeDefined();
          
          // Property: Flag must be a non-empty string
          expect(typeof langInfo!.flag).toBe('string');
          expect(langInfo!.flag.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have unique flags for each language', () => {
      const flags = SUPPORTED_LANGUAGES.map(l => l.flag);
      const uniqueFlags = new Set(flags);
      
      // Property: All flags should be unique
      expect(uniqueFlags.size).toBe(flags.length);
    });

    it('should have flag that is an emoji (contains regional indicator symbols)', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const langInfo = getLanguageInfo(langCode);
          
          // Flag emojis are typically 4 bytes (2 regional indicator symbols)
          // Each regional indicator is a surrogate pair in JavaScript
          // So a flag emoji should have length >= 2 (in terms of code units)
          expect(langInfo!.flag.length).toBeGreaterThanOrEqual(2);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional helper function tests
   */
  describe('Helper Functions', () => {
    it('isLanguageSupported should return true for all supported languages', () => {
      const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));
      
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: string) => {
          expect(isLanguageSupported(langCode)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('isLanguageSupported should return false for unsupported languages', () => {
      // Generator for random strings that are not supported language codes
      const unsupportedLanguageArb = fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => !SUPPORTED_LANGUAGE_CODES.has(s));
      
      fc.assert(
        fc.property(unsupportedLanguageArb, (langCode: string) => {
          expect(isLanguageSupported(langCode)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('getTextDirection should return rtl only for Arabic', () => {
      const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));
      
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const direction = getTextDirection(langCode);
          
          if (langCode === 'ar') {
            expect(direction).toBe('rtl');
          } else {
            expect(direction).toBe('ltr');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('isRTL should return true only for Arabic', () => {
      const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));
      
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const rtl = isRTL(langCode);
          
          if (langCode === 'ar') {
            expect(rtl).toBe(true);
          } else {
            expect(rtl).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Structural tests for SUPPORTED_LANGUAGES
   */
  describe('SUPPORTED_LANGUAGES Structure', () => {
    it('should have exactly 8 supported languages', () => {
      expect(SUPPORTED_LANGUAGES.length).toBe(8);
    });

    it('should include all required languages', () => {
      const requiredLanguages: Language[] = ['ar', 'en', 'fr', 'es', 'de', 'it', 'tr', 'pt'];
      const actualCodes = SUPPORTED_LANGUAGES.map(l => l.code);
      
      requiredLanguages.forEach(lang => {
        expect(actualCodes).toContain(lang);
      });
    });

    it('should have valid direction for all languages', () => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        expect(['rtl', 'ltr']).toContain(lang.direction);
      });
    });
  });
});
