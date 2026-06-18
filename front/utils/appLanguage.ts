import { useAppSettings } from '../src/store/useAppSettings';

export type AppLanguageCode = 'ar' | 'en';

/** Current app UI language — drives backend + 365Scores langId. */
export function getAppLanguageCode(): AppLanguageCode {
  const current = useAppSettings.getState().language?.current ?? 'ar';
  return current.startsWith('en') ? 'en' : 'ar';
}

export function acceptLanguageHeader(lang: AppLanguageCode = getAppLanguageCode()): string {
  return lang === 'ar' ? 'ar,en;q=0.9' : 'en,ar;q=0.9';
}
