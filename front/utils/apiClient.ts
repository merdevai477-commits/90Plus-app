/**
 * API Client with Sentry Breadcrumb Tracking
 * 
 * Wraps fetch to automatically add breadcrumbs for all API calls
 * 
 * Requirements: 6.3 - Capture breadcrumbs for API calls with endpoint and method
 */

import { addBreadcrumb } from '../services/sentry.service';
import { logger } from '../services/logger';

/**
 * Enhanced fetch that adds Sentry breadcrumbs for API calls
 * 
 * Usage:
 * ```typescript
 * import { trackedFetch } from '@/utils/apiClient';
 * 
 * const response = await trackedFetch('https://api.example.com/users', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 * ```
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method || 'GET';
  const startTime = Date.now();

  // Extract endpoint path (remove query params and base URL for cleaner breadcrumb)
  const endpoint = extractEndpoint(url);

  // Add breadcrumb before request
  try {
    addBreadcrumb(
      `API ${method} ${endpoint}`,
      'http',
      'info',
      {
        url,
        method,
        endpoint,
      }
    );
  } catch (error) {
    // Silently fail - don't break API call if Sentry fails
    logger.warn('[API Client] Failed to add request breadcrumb:', error);
  }

  try {
    // Make the actual fetch call
    const response = await fetch(input, init);
    const duration = Date.now() - startTime;

    // Add breadcrumb for response
    try {
      addBreadcrumb(
        `API ${method} ${endpoint} - ${response.status}`,
        'http',
        response.ok ? 'info' : 'warning',
        {
          url,
          method,
          endpoint,
          status: response.status,
          statusText: response.statusText,
          duration,
          ok: response.ok,
        }
      );
    } catch (error) {
      logger.warn('[API Client] Failed to add response breadcrumb:', error);
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Add breadcrumb for error
    try {
      addBreadcrumb(
        `API ${method} ${endpoint} - Failed`,
        'http',
        'error',
        {
          url,
          method,
          endpoint,
          duration,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    } catch (breadcrumbError) {
      logger.warn('[API Client] Failed to add error breadcrumb:', breadcrumbError);
    }

    // Re-throw the original error
    throw error;
  }
}

/**
 * Extract clean endpoint path from URL
 * Removes base URL, query params, and sensitive data
 */
function extractEndpoint(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Get pathname without query params
    let endpoint = urlObj.pathname;
    
    // Remove /api prefix if present
    endpoint = endpoint.replace(/^\/api/, '');
    
    // If empty, use root
    if (!endpoint || endpoint === '/') {
      endpoint = '/';
    }
    
    return endpoint;
  } catch (error) {
    // If URL parsing fails, return the original URL (might be relative)
    return url.split('?')[0]; // Remove query params at least
  }
}

/**
 * Helper function to create a tracked fetch with default options
 * 
 * Usage:
 * ```typescript
 * const api = createAPIClient({
 *   baseURL: 'https://api.example.com',
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * 
 * const response = await api.get('/users');
 * const data = await api.post('/users', { name: 'John' });
 * ```
 */
export function createAPIClient(defaultOptions: {
  baseURL?: string;
  headers?: HeadersInit;
  timeout?: number;
}) {
  const { baseURL = '', headers: defaultHeaders = {}, timeout } = defaultOptions;

  async function request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${baseURL}${endpoint}`;
    
    const mergedHeaders = {
      ...defaultHeaders,
      ...options.headers,
    };

    const requestOptions: RequestInit = {
      ...options,
      headers: mergedHeaders,
    };

    // Add timeout if specified
    if (timeout) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      requestOptions.signal = controller.signal;
      
      try {
        const response = await trackedFetch(url, requestOptions);
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    return trackedFetch(url, requestOptions);
  }

  return {
    request,
    
    async get(endpoint: string, options?: RequestInit): Promise<Response> {
      return request(endpoint, { ...options, method: 'GET' });
    },
    
    async post(endpoint: string, body?: any, options?: RequestInit): Promise<Response> {
      return request(endpoint, {
        ...options,
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
    },
    
    async put(endpoint: string, body?: any, options?: RequestInit): Promise<Response> {
      return request(endpoint, {
        ...options,
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
    },
    
    async patch(endpoint: string, body?: any, options?: RequestInit): Promise<Response> {
      return request(endpoint, {
        ...options,
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
    },
    
    async delete(endpoint: string, options?: RequestInit): Promise<Response> {
      return request(endpoint, { ...options, method: 'DELETE' });
    },
  };
}

/**
 * Export both the tracked fetch and a convenience API client
 */
export default {
  trackedFetch,
  createAPIClient,
};
