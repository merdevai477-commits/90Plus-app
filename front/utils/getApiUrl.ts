/**
 * Get the API base URL
 *
 * This module re-exports the centralized API configuration.
 * For new code, prefer importing directly from 'config/api.config'.
 *
 * @deprecated Use getApiUrl from 'config/api.config' instead
 */

import { getApiUrl as getApiUrlFromConfig } from '../config/api.config';

/**
 * Get the API base URL based on the environment
 * @deprecated Use getApiUrl from 'config/api.config' instead
 */
export const getApiUrl = (): string => {
  return getApiUrlFromConfig();
};

