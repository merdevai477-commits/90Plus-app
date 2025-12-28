/**
 * Language Context - i18n Management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ar, TranslationKeys } from '../locales/ar';
import { en } from '../locales/en';
import { fr } from '../locales/fr';
import { es } from '../locales/es';
import { de } from '../locales/de';
import { it } from '../locales/it';
import { tr } from '../locales/tr';
import { pt } from '../locales/pt';

type Language = 'ar' | 'en' | 'fr' | 'es' | 'de' | 'it' | 'tr' | 'pt';
type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  t: TranslationKeys;
  setLanguage: (lang: Language) => Promise<void>;
  isRTL: boolean;
}

const STORAGE_KEY = '@app:language';

const translations: Record<Language, TranslationKeys> = {
  ar,
  en,
  fr,
  es,
  de,
  it,
  tr,
  pt,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('ar');
  const [direction, setDirection] = useState<Direction>('rtl');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const validLanguages: Language[] = ['ar', 'en', 'fr', 'es', 'de', 'it', 'tr', 'pt'];
      if (stored && validLanguages.includes(stored as Language)) {
        setLanguageState(stored as Language);
        setDirection(stored === 'ar' ? 'rtl' : 'ltr');
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
      setLanguageState(lang);
      
      const newDirection = lang === 'ar' ? 'rtl' : 'ltr';
      setDirection(newDirection);
      
      const shouldRTL = newDirection === 'rtl';
      if (I18nManager.isRTL !== shouldRTL) {
        I18nManager.allowRTL(shouldRTL);
        I18nManager.forceRTL(shouldRTL);
      }
    } catch (error) {
      console.error('Error setting language:', error);
      throw error;
    }
  };

  const value: LanguageContextType = {
    language,
    direction,
    t: translations[language],
    setLanguage,
    isRTL: direction === 'rtl',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export default LanguageContext;
