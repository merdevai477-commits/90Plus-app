export interface Translation {
  [key: string]: string | Translation;
}

export interface LanguageState {
  current: string;
  available: string[];
  direction: 'ltr' | 'rtl';
  fallback: string;
  translations?: Record<string, Translation>;
  autoDetect: boolean;
}