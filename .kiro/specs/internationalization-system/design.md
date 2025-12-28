# Design Document: Internationalization System

## Overview

This design document outlines the architecture for a robust, enterprise-grade internationalization (i18n) system. The system provides complete multi-language support with user preference persistence across devices, automatic language detection, RTL support, and seamless backend synchronization.

## Architecture

The i18n system follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │   Screens    │ │  Components  │ │    Language Picker       │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hook Layer                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    useTranslation()                       │   │
│  │  - t: TranslationKeys (type-safe translations)           │   │
│  │  - language: Language (current language)                 │   │
│  │  - setLanguage: (lang) => Promise<void>                  │   │
│  │  - isRTL: boolean                                        │   │
│  │  - formatDate: (date) => string                          │   │
│  │  - formatNumber: (num) => string                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   State Layer (Zustand)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 useLanguageStore                          │   │
│  │  - language: Language                                     │   │
│  │  - isRTL: boolean                                        │   │
│  │  - isInitialized: boolean                                │   │
│  │  - setLanguage: (lang) => void                           │   │
│  │  - initialize: () => Promise<void>                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│    Translation Files    │     │      Sync Service               │
│  ┌───────────────────┐  │     │  ┌───────────────────────────┐  │
│  │ ar.ts (Arabic)    │  │     │  │ syncLanguageToBackend()   │  │
│  │ en.ts (English)   │  │     │  │ fetchLanguageFromBackend()│  │
│  │ fr.ts (French)    │  │     │  │ detectDeviceLanguage()    │  │
│  │ es.ts (Spanish)   │  │     │  └───────────────────────────┘  │
│  │ de.ts (German)    │  │     └─────────────────────────────────┘
│  │ it.ts (Italian)   │  │                   │
│  │ tr.ts (Turkish)   │  │                   ▼
│  │ pt.ts (Portuguese)│  │     ┌─────────────────────────────────┐
│  └───────────────────┘  │     │        Backend API              │
└─────────────────────────┘     │  PATCH /api/users/settings      │
                                │  GET /api/users/settings        │
                                └─────────────────────────────────┘
```

## Components and Interfaces

### 1. Language Types

```typescript
// Supported languages
type Language = 'ar' | 'en' | 'fr' | 'es' | 'de' | 'it' | 'tr' | 'pt';

// Language metadata
interface LanguageInfo {
  code: Language;
  name: string;           // English name
  nativeName: string;     // Name in native script
  flag: string;           // Flag emoji
  direction: 'rtl' | 'ltr';
}

// All supported languages with metadata
const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', direction: 'rtl' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', direction: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', direction: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', direction: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', direction: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', direction: 'ltr' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', direction: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', direction: 'ltr' },
];
```

### 2. Language Store (Zustand)

```typescript
interface LanguageState {
  language: Language;
  isRTL: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  
  // Actions
  setLanguage: (lang: Language) => Promise<void>;
  initialize: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
}
```

### 3. Translation Hook

```typescript
interface UseTranslationReturn {
  t: TranslationKeys;
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  isRTL: boolean;
  direction: 'rtl' | 'ltr';
  formatDate: (date: Date, format?: string) => string;
  formatNumber: (num: number) => string;
  formatCurrency: (amount: number, currency?: string) => string;
}
```

### 4. Sync Service

```typescript
interface LanguageSyncService {
  // Sync language preference to backend
  syncToBackend: (language: Language) => Promise<boolean>;
  
  // Fetch language preference from backend
  fetchFromBackend: () => Promise<Language | null>;
  
  // Detect device language
  detectDeviceLanguage: () => Language;
  
  // Check if language is supported
  isSupported: (langCode: string) => boolean;
}
```

## Data Models

### Storage Keys
```typescript
const STORAGE_KEYS = {
  LANGUAGE: '@app:language',
  LANGUAGE_INITIALIZED: '@app:language_initialized',
  PENDING_SYNC: '@app:language_pending_sync',
} as const;
```

### Backend Settings Schema
```typescript
// Part of user settings JSON in database
interface UserSettings {
  language?: Language;
  // ... other settings
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Language Change Updates UI
*For any* supported language, when the language is changed, the translation service should return translations in the new language for all keys.
**Validates: Requirements 1.1**

### Property 2: Supported Language Detection
*For any* device language that matches a supported language code, the service should set that language as default.
**Validates: Requirements 2.2**

### Property 3: Unsupported Language Fallback
*For any* device language code that is not in the supported languages list, the service should fall back to English.
**Validates: Requirements 2.3**

### Property 4: Saved Preference Priority
*For any* saved language preference, when initializing, the service should use the saved preference over device detection.
**Validates: Requirements 2.4**

### Property 5: Translation Key Resolution
*For any* valid translation key and any supported language, the service should return a non-empty string translation.
**Validates: Requirements 3.1**

### Property 6: Missing Translation Fallback to English
*For any* translation key that exists in English but is missing in another language, the service should return the English translation.
**Validates: Requirements 3.2**

### Property 7: Missing Key Returns Key
*For any* translation key that does not exist in any language file, the service should return the key itself.
**Validates: Requirements 3.3**

### Property 8: Date Formatting by Locale
*For any* date and any supported language, the formatted date string should match the locale's date format conventions.
**Validates: Requirements 3.4**

### Property 9: RTL for Arabic Only
*For any* non-Arabic language, the direction should be LTR.
**Validates: Requirements 4.2**

### Property 10: Cache Update on Language Change
*For any* language change, the cached translations should be updated to reflect the new language.
**Validates: Requirements 6.4**

### Property 11: Native Language Names
*For any* supported language, the language info should include a non-empty native name in its own script.
**Validates: Requirements 7.2**

### Property 12: Language Flags
*For any* supported language, the language info should include a flag emoji.
**Validates: Requirements 7.3**

### Property 13: Translation File Completeness
*For any* translation key in the English file, all other language files should have the same key.
**Validates: Requirements 8.1, 8.3**

### Property 14: Plural Form Handling
*For any* pluralizable translation and any count, the service should return the grammatically correct plural form.
**Validates: Requirements 8.4**

## Error Handling

### Network Failures
When backend sync fails:
1. Store the language preference locally
2. Mark as pending sync
3. Retry on next app launch or when network is available
4. Continue with local preference

### Invalid Language Code
When an invalid language code is received:
1. Log a warning
2. Fall back to English
3. Do not crash the app

### Missing Translations
When a translation is missing:
1. Check English fallback
2. If English is also missing, return the key
3. Log warning in development mode

## Testing Strategy

### Unit Testing
- Test language store state transitions
- Test translation key resolution
- Test fallback logic
- Test date/number formatting

### Property-Based Testing
The project will use **fast-check** library for property-based testing.

Each property-based test should:
- Run a minimum of 100 iterations
- Be tagged with the corresponding correctness property reference
- Use smart generators for language codes and translation keys

Property tests will validate:
- Language change updates translations (Property 1)
- Supported language detection (Property 2)
- Unsupported language fallback (Property 3)
- Translation key resolution (Property 5, 6, 7)
- RTL direction logic (Property 9)
- Translation file completeness (Property 13)

### Integration Testing
- Test full flow from language change to backend sync
- Test initialization with various stored states
- Test offline behavior and retry logic

