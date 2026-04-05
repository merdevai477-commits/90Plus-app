/**
 * Fetch with Retry - Exponential Backoff
 * 
 * Handles backend cold start timeouts with intelligent retry logic
 * 
 * Features:
 * - ✅ Exponential backoff (1s, 2s, 4s)
 * - ✅ Max retries (3)
 * - ✅ Timeout configuration (30s)
 * - ✅ Offline detection
 * - ✅ Request queueing
 * - ✅ Error categorization
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import NetInfo from '@react-native-community/netinfo';
import { logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  timeout?: number;
  retryDelay?: number;
  retryOn?: number[]; // HTTP status codes to retry on
  onRetry?: (attempt: number, error: Error) => void;
}

export interface QueuedRequest {
  url: string;
  options: FetchWithRetryOptions;
  resolve: (value: Response) => void;
  reject: (reason: Error) => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const DEFAULT_RETRY_ON = [408, 429, 500, 502, 503, 504]; // Retry on these status codes

// ============================================================================
// REQUEST QUEUE (for offline support)
// ============================================================================

const requestQueue: QueuedRequest[] = [];
let isOnline = true;

// Monitor network status
NetInfo.addEventListener(state => {
  const wasOffline = !isOnline;
  isOnline = state.isConnected ?? false;

  if (wasOffline && isOnline) {
    logger.info('📶 Network restored, processing queued requests...');
    processQueue();
  }
});

/**
 * Process queued requests when network is restored
 */
async function processQueue() {
  while (requestQueue.length > 0 && isOnline) {
    const request = requestQueue.shift();
    if (!request) continue;

    try {
      const response = await fetchWithRetry(request.url, request.options);
      request.resolve(response);
    } catch (error) {
      request.reject(error as Error);
    }
  }
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

/**
 * Fetch with exponential backoff retry
 * 
 * @param url - URL to fetch
 * @param options - Fetch options with retry configuration
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    retryDelay = DEFAULT_RETRY_DELAY,
    retryOn = DEFAULT_RETRY_ON,
    onRetry,
    ...fetchOptions
  } = options;

  // Check if offline
  if (!isOnline) {
    logger.warn('📵 Offline - queueing request');
    return new Promise((resolve, reject) => {
      requestQueue.push({
        url,
        options,
        resolve,
        reject,
      });
    });
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Perform fetch
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if we should retry based on status code
      if (retryOn.includes(response.status)) {
        throw new Error(`Server returned ${response.status}`);
      }

      // Success - return response
      return response;

    } catch (error: any) {
      lastError = error;

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        logger.error(`⏱️ Request timeout after ${timeout}ms`);
        
        if (attempt < maxRetries) {
          logger.info(`🔄 Retrying (${attempt}/${maxRetries})...`);
          if (onRetry) {
            onRetry(attempt, error);
          }
        } else {
          throw new Error(`Request timeout after ${maxRetries} attempts`);
        }
      }

      // Don't retry on network errors (offline)
      if (error.message?.includes('Network request failed')) {
        logger.error('📵 Network error - going offline');
        isOnline = false;
        throw error;
      }

      // Retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        logger.warn(`⚠️ Request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        
        if (onRetry) {
          onRetry(attempt, error);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Request failed after all retries');
}

// ============================================================================
// HELPER: Fetch JSON with Retry
// ============================================================================

/**
 * Fetch JSON with retry
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Promise<T>
 */
export async function fetchJSONWithRetry<T = any>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// HELPER: Check if Online
// ============================================================================

/**
 * Check if device is online
 * 
 * @returns boolean
 */
export function isDeviceOnline(): boolean {
  return isOnline;
}

// ============================================================================
// HELPER: Get Queue Length
// ============================================================================

/**
 * Get number of queued requests
 * 
 * @returns number
 */
export function getQueueLength(): number {
  return requestQueue.length;
}

// ============================================================================
// HELPER: Clear Queue
// ============================================================================

/**
 * Clear all queued requests
 */
export function clearQueue(): void {
  requestQueue.length = 0;
  logger.info('🗑️ Request queue cleared');
}
