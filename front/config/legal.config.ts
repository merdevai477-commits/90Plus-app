/**
 * Centralized legal & support page URLs.
 * Derived from the API base URL so all environments stay in sync.
 */
import { Alert } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { getApiUrl } from './api.config';

export function getWebBaseUrl(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

export const LEGAL_URLS = {
  privacy: `${getWebBaseUrl()}/privacy`,
  terms: `${getWebBaseUrl()}/terms`,
  support: `${getWebBaseUrl()}/support`,
  deleteAccount: `${getWebBaseUrl()}/delete-account`,
} as const;

export async function openLegalUrl(url: string): Promise<void> {
  try {
    await openBrowserAsync(url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  } catch {
    Alert.alert('Unable to open link', 'Please try again later.');
  }
}
