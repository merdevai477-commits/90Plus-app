/**
 * Centralized legal & support page URLs.
 * Derived from the API base URL so all environments stay in sync.
 */
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
