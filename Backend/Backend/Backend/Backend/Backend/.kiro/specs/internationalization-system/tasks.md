
# Implementation Plan

- [x] 1. Create Language Types and Constants






  - [x] 1.1 Create language types file with all supported languages






    - Create `front/src/i18n/types.ts`
    - Define Language type, LanguageInfo interface
    - Export SUPPORTED_LANGUAGES array with metadata (code, name, nativeName, flag, direction)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 1.2 Write property test for native language names


    - **Property 11: Native Language Names**
    - **Validates: Requirements 7.2**

  - [x] 1.3 Write property test for language flags

    - **Property 12: Language Flags**
    - **Validates: Requirements 7.3**


- [x] 2. Create Translation Utilities





  - [x] 2.1 Create translation utility functions

    - Create `front/src/i18n/utils.ts`
    - Implement `getTranslation(key, language)` with fallback logic
    - Implement `isLanguageSupported(code)` function
    - Implement `detectDeviceLanguage()` function
    - _Requirements: 3.1, 3.2, 3.3, 2.1_

  - [x] 2.2 Write property test for translation key resolution


    - **Property 5: Translation Key Resolution**
    - **Validates: Requirements 3.1**

  - [x] 2.3 Write property test for missing translation fallback


    - **Property 6: Missing Translation Fallback to English**
    - **Validates: Requirements 3.2**

  - [x] 2.4 Write property test for missing key returns key


    - **Property 7: Missing Key Returns Key**
    - **Validates: Requirements 3.3**

  - [x] 2.5 Write property test for unsupported language fallback


    - **Property 3: Unsupported Language Fallback**
    - **Validates: Requirements 2.3**

- [x] 3. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.


- [x] 4. Create Language Store with Zustand

  - [x] 4.1 Create Zustand language store
    - Create `front/src/i18n/store.ts`
    - Implement language state with isRTL, isInitialized
    - Implement setLanguage action with I18nManager RTL handling
    - Implement initialize action with device detection and saved preference
    - _Requirements: 1.1, 2.1, 2.2, 2.4, 4.1, 4.2_

  - [x] 4.2 Write property test for supported language detection
    - **Property 2: Supported Language Detection**
    - **Validates: Requirements 2.2**

  - [x] 4.3 Write property test for saved preference priority

    - **Property 4: Saved Preference Priority**
    - **Validates: Requirements 2.4**


  - [x] 4.4 Write property test for RTL direction


    - **Property 9: RTL for Arabic Only**
    - **Validates: Requirements 4.2**

- [x] 5. Create Backend Sync Service





  - [x] 5.1 Create language sync service


    - Create `front/src/i18n/syncService.ts`
    - Implement syncToBackend with retry logic
    - Implement fetchFromBackend
    - Handle offline scenarios with pending sync queue
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 5.2 Update Backend to handle language in settings


    - Ensure PATCH /api/users/settings accepts language field
    - Ensure GET /api/users/settings returns language field
    - _Requirements: 1.2, 1.3_

- [x] 6. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create useTranslation Hook





  - [x] 7.1 Create main translation hook


    - Create `front/src/i18n/useTranslation.ts`
    - Return t (translations), language, setLanguage, isRTL
    - Implement formatDate, formatNumber, formatCurrency with Intl API
    - _Requirements: 3.1, 3.4, 6.1, 6.2_


  - [x] 7.2 Write property test for date formatting

    - **Property 8: Date Formatting by Locale**
    - **Validates: Requirements 3.4**


  - [x] 7.3 Write property test for language change updates
    - **Property 1: Language Change Updates UI**
    - **Validates: Requirements 1.1**

  - [x] 7.4 Write property test for cache update on language change

    - **Property 10: Cache Update on Language Change**
    - **Validates: Requirements 6.4**

- [x] 8. Complete Translation Files







  - [x] 8.1 Audit and complete Arabic translations

    - Review ar.ts for missing keys
    - Add all missing translations
    - Ensure consistency with English file
    - _Requirements: 8.1, 8.3_


  - [x] 8.2 Audit and complete French translations

    - Review fr.ts for missing keys
    - Add all missing translations
    - _Requirements: 8.1, 8.3_


  - [x] 8.3 Audit and complete Spanish translations

    - Review es.ts for missing keys
    - Add all missing translations
    - _Requirements: 8.1, 8.3_

  - [x] 8.4 Audit and complete German translations


    - Review de.ts for missing keys
    - Add all missing translations
    - _Requirements: 8.1, 8.3_


  - [x] 8.5 Audit and complete Italian translations

    - Review it.ts for missing keys
    - Add all missing translations
    - _Requirements: 8.1, 8.3_


  - [x] 8.6 Audit and complete Turkish translations

    - Review tr.ts for missing keys
    - Add all missing translations
    - _Requirements: 8.1, 8.3_


  - [x] 8.7 Audit and complete Portuguese translations

    - Review pt.ts for missing keys
    - Add all missing translations
    - _Requirements: 8.1, 8.3_

  - [x] 8.8 Write property test for translation file completeness


    - **Property 13: Translation File Completeness**
    - **Validates: Requirements 8.1, 8.3**

- [x] 9. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.


- [x] 10. Create Language Picker Component








  - [x] 10.1 Create enhanced language picker modal




    - Create `front/components/common/LanguagePickerModal.tsx`
    - Display all 8 languages with flags and native names
    - Show current selection with checkmark
    - Handle language change with loading state
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. Integrate i18n System into App





  - [x] 11.1 Create i18n index file for easy imports


    - Create `front/src/i18n/index.ts`
    - Export all types, hooks, and utilities
    - _Requirements: 5.1, 5.4_

  - [x] 11.2 Update app layout to initialize language store


    - Modify `front/app/_layout.tsx`
    - Initialize language store on app start
    - Apply RTL settings before rendering
    - _Requirements: 2.1, 4.1, 4.2_

  - [x] 11.3 Update settings screen to use new language picker


    - Modify `front/app/(tabs)/settings.tsx`
    - Replace old language picker with new LanguagePickerModal
    - Use useTranslation hook
    - _Requirements: 7.1, 7.4_

- [x] 12. Migrate Screens to New i18n System






  - [x] 12.1 Migrate Home screen

    - Update `front/app/(tabs)/Home.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_



  - [x] 12.2 Migrate Profile screen
    - Update `front/app/(tabs)/profile.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_


  - [x] 12.3 Migrate Reels screen

    - Update `front/app/(tabs)/reels.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_


  - [x] 12.4 Migrate Leagues screen

    - Update `front/app/(tabs)/leagues.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_


  - [x] 12.5 Migrate Rankings screen

    - Update `front/app/(tabs)/rankings.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_

  - [x] 12.6 Migrate Quiz screen


    - Update `front/app/(tabs)/quiz.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_



  - [x] 12.7 Migrate Notifications screen
    - Update `front/app/notifications.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_


  - [x] 12.8 Migrate Match Details screen

    - Update `front/app/(tabs)/match-details.tsx` to use useTranslation
    - Replace all hardcoded strings with translations
    - _Requirements: 3.1_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Remove Old Language System
  - [x] 14.1 Deprecate old LanguageContext
    - Update `front/contexts/LanguageContext.tsx` to use new store internally
    - Mark as deprecated with migration guide
    - _Requirements: 6.2_

  - [x] 14.2 Update SettingsContext language handling
    - Modify `front/contexts/SettingsContext.tsx`
    - Sync language with new i18n store
    - Ensure backend sync uses new system
    - _Requirements: 1.2, 1.3_

- [x] 15. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

