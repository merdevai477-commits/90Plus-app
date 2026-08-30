import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function read(key: string): string {
  const fromEnv = process.env[key]?.trim();
  if (fromEnv) return fromEnv;
  const camel = key
    .replace(/^EXPO_PUBLIC_/, '')
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const fromExtra = extra[camel];
  return typeof fromExtra === 'string' ? fromExtra.trim() : '';
}

/** Platform-specific Places API key (Android / iOS restrictions in Google Cloud). */
export function getGooglePlacesApiKey(): string {
  if (Platform.OS === 'android') {
    return read('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_ANDROID');
  }
  if (Platform.OS === 'ios') {
    return read('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_IOS');
  }
  return read('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_ANDROID') || read('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_IOS');
}

/**
 * Maps JavaScript API key for the in-app WebView picker.
 * Android/iOS-restricted keys do NOT work here — use a separate web key.
 */
export function getGoogleMapsJsApiKey(): string {
  const web = read('EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY');
  if (web) return web;
  return getGooglePlacesApiKey();
}

export function hasGooglePlacesApiKey(): boolean {
  return getGooglePlacesApiKey().length > 0;
}

export function hasGoogleMapsJsApiKey(): boolean {
  return getGoogleMapsJsApiKey().length > 0;
}
