/**
 * 🐉 DRAGON MODE: Global Fetch Timeout Wrapper
 * Provides universal fetch wrapper with timeout and AbortController
 * Prevents hanging requests and memory leaks
 */

import { logger } from '../services/logger';

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY = 1000;

/**
 * Fetch with automatic timeout and cancellation
 * Prevents hanging requests that never resolve
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        logger.warn(`Request timeout after ${timeout}ms: ${url}`);
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      // Retry on network errors
      if (attempt < retries) {
        logger.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${retryDelay}ms: ${url}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // Final attempt failed
      logger.error(`Fetch failed after ${attempt + 1} attempts: ${url}`, error);
      throw error;
    }
  }

  throw lastError || new Error('Fetch failed');
}

/**
 * Fetch JSON with timeout
 * Convenience wrapper for JSON responses
 */
export async function fetchJSON<T = any>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * POST JSON with timeout
 * Convenience wrapper for POST requests
 */
export async function postJSON<T = any>(
  url: string,
  data: any,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  return fetchJSON<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
}
