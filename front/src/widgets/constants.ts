import Constants from 'expo-constants';

/** Shared AsyncStorage key — main app writes, Android widget task reads. */
export const WIDGET_MATCHES_STORAGE_KEY = '@90plus/widget_matches_payload_v1';

export const WIDGET_NAME = 'MatchesWidget';

const DEFAULT_API = 'https://90plus.pro/api';

export function getWidgetApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && typeof fromEnv === 'string') {
    return fromEnv.replace(/\/$/, '');
  }
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) {
    return fromExtra.replace(/\/$/, '');
  }
  return DEFAULT_API;
}

/** Top leagues + regional — same priority as home.store */
export const WIDGET_PRIORITY_LEAGUE_IDS = new Set([
  39, 140, 78, 135, 61, 2, 3, 1, 307, 233, 200, 12, 13, 6,
]);
