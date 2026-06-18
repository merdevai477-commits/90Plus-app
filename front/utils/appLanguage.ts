import { useLanguageStore } from '../src/i18n/store';

export type AppLanguageCode = 'ar' | 'en';

/** Current app UI language — same store as useTranslation / settings screen. */
export function getAppLanguageCode(): AppLanguageCode {
  const current = useLanguageStore.getState().language ?? 'ar';
  return current.startsWith('en') ? 'en' : 'ar';
}

export function acceptLanguageHeader(lang: AppLanguageCode = getAppLanguageCode()): string {
  return lang === 'ar' ? 'ar,en;q=0.9' : 'en,ar;q=0.9';
}
