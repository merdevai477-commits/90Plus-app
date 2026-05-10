/**
 * 🐉 DRAGON MODE: Safe Async Execution Utilities
 * Provides bulletproof wrappers for async operations
 */

import { logger } from '../services/logger';

/**
 * Wraps an async function to catch and log errors without crashing
 * Use for fire-and-forget operations, intervals, and background tasks
 */
export function safeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorMessage: string = 'Async operation failed'
): (...args: Parameters<T>) => Promise<void> {
  return async (...args: Parameters<T>) => {
    try {
      await fn(...args);
    } catch (error) {
      logger.error(`${errorMessage}:`, error);
      // Swallow error to prevent crash
    }
  };
}

/**
 * Creates a safe interval that catches errors in async callbacks
 */
export function safeInterval(
  callback: () => Promise<void>,
  intervalMs: number,
  errorMessage: string = 'Interval callback failed'
): ReturnType<typeof setTimeout> {
  const safeCallback = async () => {
    try {
      await callback();
    } catch (error) {
      logger.error(`${errorMessage}:`, error);
      // Continue interval despite errors
    }
  };

  return setInterval(safeCallback, intervalMs);
}

/**
 * Creates a safe timeout that catches errors in async callbacks
 */
export function safeTimeout(
  callback: () => Promise<void>,
  timeoutMs: number,
  errorMessage: string = 'Timeout callback failed'
): ReturnType<typeof setTimeout> {
  const safeCallback = async () => {
    try {
      await callback();
    } catch (error) {
      logger.error(`${errorMessage}:`, error);
    }
  };

  return setTimeout(safeCallback, timeoutMs);
}

/**
 * Wraps Promise.all with individual error isolation
 * Returns results with success/failure status for each promise
 */
export async function safePromiseAll<T>(
  promises: Promise<T>[],
  errorMessage: string = 'Promise failed'
): Promise<Array<{ success: boolean; data?: T; error?: any }>> {
  const results = await Promise.allSettled(promises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return { success: true, data: result.value };
    } else {
      logger.error(`${errorMessage} [${index}]:`, result.reason);
      return { success: false, error: result.reason };
    }
  });
}

/**
 * Retry async operation with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        
        if (onRetry) {
          onRetry(attempt + 1, error);
        }
        
        logger.warn(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
