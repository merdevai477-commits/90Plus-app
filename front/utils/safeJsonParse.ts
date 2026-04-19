/**
 * Safe JSON parsing utility for handling empty or invalid responses
 * Prevents "JSON Parse error: Unexpected end of input" errors
 */

import { logger } from '../services/logger';

/**
 * Safely parse JSON from a Response object
 * Returns null if response is empty or invalid
 * 
 * @param response - Fetch Response object
 * @param fallback - Optional fallback value if parsing fails
 * @returns Parsed JSON data or fallback value
 */
export async function safeJsonParse<T = any>(
  response: Response,
  fallback: T | null = null
): Promise<T | null> {
  try {
    // Check if response has content
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
      logger.warn('[safeJsonParse] Empty response (content-length: 0)');
      return fallback;
    }

    // Clone response to read text first (to check if empty)
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();
    
    // Check if text is empty
    if (!text || text.trim() === '') {
      logger.warn('[safeJsonParse] Empty response body');
      return fallback;
    }

    // Try to parse JSON
    try {
      const data = JSON.parse(text);
      return data as T;
    } catch (parseError) {
      logger.error('[safeJsonParse] JSON parse error:', {
        error: parseError,
        text: text.substring(0, 100), // Log first 100 chars
        status: response.status,
        statusText: response.statusText,
      });
      return fallback;
    }
  } catch (error) {
    logger.error('[safeJsonParse] Unexpected error:', error);
    return fallback;
  }
}

/**
 * Safely parse JSON with error handling for 502/503 errors
 * Returns a structured error response for server errors
 * 
 * @param response - Fetch Response object
 * @returns Parsed JSON data or error object
 */
export async function safeJsonParseWithServerError<T = any>(
  response: Response
): Promise<{ data: T | null; error: string | null; isServerError: boolean }> {
  // Handle 502/503 errors (server down/cold start)
  if (response.status === 502 || response.status === 503) {
    return {
      data: null,
      error: 'Server is starting up. Please wait a moment and try again.',
      isServerError: true,
    };
  }

  // Handle other error status codes
  if (!response.ok) {
    const errorData = await safeJsonParse<any>(response, null);
    return {
      data: null,
      error: errorData?.message || errorData?.error || `HTTP ${response.status}: ${response.statusText}`,
      isServerError: false,
    };
  }

  // Parse successful response
  const data = await safeJsonParse<T>(response, null);
  return {
    data,
    error: data === null ? 'Empty response from server' : null,
    isServerError: false,
  };
}

/**
 * Check if response is likely from a cold-started server
 * Returns true for 502/503 or empty responses
 */
export function isColdStartError(response: Response): boolean {
  return response.status === 502 || response.status === 503;
}
