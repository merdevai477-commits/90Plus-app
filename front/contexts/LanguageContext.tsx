/**
 * Language Context - i18n Management
 * 
 * @deprecated This context is deprecated. Please use the new i18n system instead:
 * 
 * ```tsx
 * // Old way (deprecated)
 * import { useLanguage } from '../contexts/LanguageContext';
 * const { t, language, setLanguage, isRTL } = useLanguage();
 * 
 * // New way (recommended)
 * import { useTranslation } from '../src/i18n';
 * const { t, language, setLanguage, isRTL } = useTranslation();
 * ```
 * 
 * Migration Guide:
 * 1. Replace `import { useLanguage } from '../contexts/LanguageContext'`
 *    with `import { useTranslation } from '../src/i18n'`
 * 2. Replace `useLanguage()` with `useTranslation()`
 * 3. The API is compatible - t, language, setLanguage, isRTL work the same way
 * 
 * This context now internally uses the new Zustand-based i18n store for
 * backwards compatibility during migration.
 */

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { TranslationKeys } from '../locales/ar';
import { useTranslation } from '../src/i18n';

type Language = 'ar' | 'en';
type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  t: TranslationKeys;
  setLanguage: (lang: Language) => Promise<void>;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * @deprecated Use the new i18n system directly instead of wrapping with LanguageProvider.
 * The app layout already initializes the language store.
 * 
 * This provider is maintained for backwards compatibility and internally
 * delegates to the new Zustand-based i18n store.
 */
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t, language, setLanguage: setLang, isRTL } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure the new i18n store is initialized
    setIsReady(true);
  }, []);

  const setLanguage = async (lang: Language) => {
    await setLang(lang);
  };

  const value: LanguageContextType = {
    language: language as Language,
    direction: isRTL ? 'rtl' : 'ltr',
    t,
    setLanguage,
    isRTL,
  };

  if (!isReady) {
    return null;
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * @deprecated Use `useTranslation` from '../src/i18n' instead.
 * 
 * This hook is maintained for backwards compatibility and internally
 * delegates to the new useTranslation hook.
 * 
 * @example
 * ```tsx
 * // Deprecated
 * import { useLanguage } from '../contexts/LanguageContext';
 * const { t, language } = useLanguage();
 * 
 * // Recommended
 * import { useTranslation } from '../src/i18n';
 * const { t, language } = useTranslation();
 * ```
 */
export const useLanguage = (): LanguageContextType => {
  // First try to use the context (for components still wrapped in LanguageProvider)
  const context = useContext(LanguageContext);
  
  // If context exists, use it for backwards compatibility
  if (context) {
    return context;
  }
  
  // Otherwise, use the new i18n system directly
  // This allows useLanguage to work even without LanguageProvider
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { t, language, setLanguage: setLang, isRTL } = useTranslation();
  
  const setLanguage = async (lang: Language) => {
    await setLang(lang);
  };

  return {
    language: language as Language,
    direction: isRTL ? 'rtl' : 'ltr',
    t,
    setLanguage,
    isRTL,
  };
};

export default LanguageContext;
