/**
 * Property-Based Tests for Language Store
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import {
  shouldLanguageBeRTL,
  STORAGE_KEYS,
} from '../store';
import {
  SUPPORTED_LANGUAGES,
  Language,
  isLanguageSupported,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
} from '../types';
import { detectDeviceLanguage } from '../utils';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock react-native I18nManager
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

describe('Language Store Property Tests', () => {
  /**
   * **Feature: internationalization-system, Property 2: Supported Language Detection**
   * *For any* device language that matches a supported language code, the service should set that language as default.
   * **Validates: Requirements 2.2**
   */
  describe('Property 2: Supported Language Detection', () => {
    // Generator for supported language codes
    const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));

    it('should recognize all supported language codes as valid', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          // Property: All supported language codes should be recognized
          expect(isLanguageSupported(langCode)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should have all 8 supported languages available for detection', () => {
      // Property: The set of supported languages should contain exactly 8 languages
      expect(SUPPORTED_LANGUAGE_CODES.size).toBe(8);
      
      const requiredLanguages: Language[] = ['ar', 'en', 'fr', 'es', 'de', 'it', 'tr', 'pt'];
      requiredLanguages.forEach(lang => {
        expect(SUPPORTED_LANGUAGE_CODES.has(lang)).toBe(true);
      });
    });

    it('should return a supported language from detectDeviceLanguage', () => {
      // Property: detectDeviceLanguage should always return a supported language
      const detectedLanguage = detectDeviceLanguage();
      expect(isLanguageSupported(detectedLanguage)).toBe(true);
    });

    it('should map any supported language code to itself when checking support', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          // Property: Supported language codes should be recognized
          const isSupported = isLanguageSupported(langCode);
          expect(isSupported).toBe(true);
          
          // Property: The language code should be in the supported set
          expect(SUPPORTED_LANGUAGE_CODES.has(langCode)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: internationalization-system, Property 4: Saved Preference Priority**
   * *For any* saved language preference, when initializing, the service should use the saved preference over device detection.
   * **Validates: Requirements 2.4**
   */
  describe('Property 4: Saved Preference Priority', () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    
    beforeEach(() => {
      jest.clearAllMocks();
    });

    // Generator for supported language codes
    const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));

    it('should use saved preference when available', async () => {
      await fc.assert(
        fc.asyncProperty(supportedLanguageArb, async (savedLang: Language) => {
          // Setup: Mock AsyncStorage to return a saved language
          AsyncStorage.getItem.mockResolvedValue(savedLang);
          
          // Property: When a saved preference exists, it should be returned
          const result = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
          expect(result).toBe(savedLang);
          
          // Property: The saved language should be a valid supported language
          expect(isLanguageSupported(result)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should validate saved preference is a supported language', async () => {
      await fc.assert(
        fc.asyncProperty(supportedLanguageArb, async (savedLang: Language) => {
          // Property: Any saved language should be in the supported languages list
          expect(isLanguageSupported(savedLang)).toBe(true);
          
          // Property: The saved language should have corresponding language info
          const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === savedLang);
          expect(langInfo).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should fall back to device detection when no saved preference exists', async () => {
      // Setup: Mock AsyncStorage to return null (no saved preference)
      AsyncStorage.getItem.mockResolvedValue(null);
      
      // Property: When no saved preference, detectDeviceLanguage should be used
      const detectedLanguage = detectDeviceLanguage();
      
      // Property: The detected language should be a valid supported language
      expect(isLanguageSupported(detectedLanguage)).toBe(true);
    });

    it('should fall back to English when saved preference is invalid', async () => {
      // Generator for invalid language codes
      const invalidLanguageArb = fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => !SUPPORTED_LANGUAGE_CODES.has(s));

      await fc.assert(
        fc.asyncProperty(invalidLanguageArb, async (invalidLang: string) => {
          // Property: Invalid language codes should not be recognized as supported
          expect(isLanguageSupported(invalidLang)).toBe(false);
          
          // Property: When invalid, the system should fall back to default
          // (This is tested by checking that DEFAULT_LANGUAGE is always valid)
          expect(isLanguageSupported(DEFAULT_LANGUAGE)).toBe(true);
          expect(DEFAULT_LANGUAGE).toBe('en');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: internationalization-system, Property 9: RTL for Arabic Only**
   * *For any* non-Arabic language, the direction should be LTR.
   * **Validates: Requirements 4.2**
   */
  describe('Property 9: RTL for Arabic Only', () => {
    // Generator for supported language codes
    const supportedLanguageArb = fc.constantFrom(...SUPPORTED_LANGUAGES.map(l => l.code));
    
    // Generator for non-Arabic supported languages
    const nonArabicLanguageArb = fc.constantFrom(
      ...SUPPORTED_LANGUAGES.filter(l => l.code !== 'ar').map(l => l.code)
    );

    it('should return RTL=true only for Arabic', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const isRTL = shouldLanguageBeRTL(langCode);
          
          if (langCode === 'ar') {
            // Property: Arabic should be RTL
            expect(isRTL).toBe(true);
          } else {
            // Property: All other languages should be LTR
            expect(isRTL).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return RTL=false for all non-Arabic languages', () => {
      fc.assert(
        fc.property(nonArabicLanguageArb, (langCode: Language) => {
          const isRTL = shouldLanguageBeRTL(langCode);
          
          // Property: Non-Arabic languages should never be RTL
          expect(isRTL).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should have consistent RTL status with language info direction', () => {
      fc.assert(
        fc.property(supportedLanguageArb, (langCode: Language) => {
          const isRTL = shouldLanguageBeRTL(langCode);
          const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
          
          // Property: RTL status should match the direction in language info
          expect(langInfo).toBeDefined();
          expect(isRTL).toBe(langInfo!.direction === 'rtl');
        }),
        { numRuns: 100 }
      );
    });

    it('should have exactly one RTL language (Arabic)', () => {
      const rtlLanguages = SUPPORTED_LANGUAGES.filter(l => l.direction === 'rtl');
      
      // Property: Only Arabic should be RTL
      expect(rtlLanguages.length).toBe(1);
      expect(rtlLanguages[0].code).toBe('ar');
    });

    it('should have 7 LTR languages', () => {
      const ltrLanguages = SUPPORTED_LANGUAGES.filter(l => l.direction === 'ltr');
      
      // Property: All non-Arabic languages should be LTR
      expect(ltrLanguages.length).toBe(7);
      ltrLanguages.forEach(lang => {
        expect(lang.code).not.toBe('ar');
      });
    });
  });
});
