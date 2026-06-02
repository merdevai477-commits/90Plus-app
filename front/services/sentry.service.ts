/**
 * Sentry Error Tracking Service
 * 
 * Provides centralized error tracking and monitoring
 * 
 * Setup:
 * 1. npm install @sentry/react-native
 * 2. Set EXPO_PUBLIC_SENTRY_DSN in .env
 * 3. Initialize in app/_layout.tsx
 * 
 * Requirements: 1.3, 1.5, 1.7, 1.8, 1.9
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { logger } from './logger';

/**
 * Validate DSN format
 * DSN should be in format: https://<key>@<host>/<project-id>
 */
function validateDSN(dsn: string): boolean {
  if (!dsn || typeof dsn !== 'string') {
    return false;
  }
  
  // Basic DSN format validation
  const dsnPattern = /^https:\/\/.+@.+\/.+$/;
  return dsnPattern.test(dsn);
}

/**
 * Initialize Sentry
 * Call this in app/_layout.tsx before rendering
 * 
 * Requirements:
 * - 1.3: Initialize with valid DSN from environment variables
 * - 1.5: Configure with environment detection (development vs production)
 * - 1.7: Set appropriate sample rates (100% dev, 20% prod)
 * - 1.8: Filter sensitive data from error reports
 * - 1.9: Include release version and build number
 */
export function initSentry(): void {
  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    (Constants.expoConfig?.extra?.sentryDsn as string | undefined);
  
  // Validate DSN presence
  if (!dsn) {
    logger.warn('Sentry DSN not configured - error tracking disabled');
    return;
  }
  
  // Validate DSN format
  if (!validateDSN(dsn)) {
    logger.warn('Sentry DSN format invalid - error tracking disabled');
    return;
  }
  
  // Detect environment
  const environment = __DEV__ ? 'development' : 'production';
  
  // Configure sample rates based on environment
  const tracesSampleRate = __DEV__ ? 1.0 : 0.2; // 100% in dev, 20% in prod
  
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode?.toString() ||
    '0';
  const bundleId =
    Constants.expoConfig?.ios?.bundleIdentifier ||
    Constants.expoConfig?.android?.package ||
    'com.mhmdsh1892.ninetyplusapp';

  // Group issues per App Store / TestFlight build (filter dist:107 in Sentry).
  const release = `${bundleId}@${version}+${buildNumber}`;
  const dist = buildNumber;

  Sentry.init({
    dsn,
    environment,

    tracesSampleRate,

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    release,
    dist,

    enableAutoSessionTracking: true,
    enableNativeCrashHandling: true,
    attachStacktrace: true,

    // Enable in production only (disable in dev to avoid noise)
    enabled: !__DEV__,
    
    // Filter sensitive data before sending to Sentry
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.Authorization;
        delete event.request.headers.cookie;
        delete event.request.headers.Cookie;
      }
      
      // Remove all cookies
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      
      // Filter sensitive fields from request data
      if (event.request?.data && typeof event.request.data === 'object' && event.request.data !== null) {
        const data = event.request.data as Record<string, any>;
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
        sensitiveFields.forEach(field => {
          if (field in data) {
            data[field] = '[Filtered]';
          }
        });
      }
      
      // Filter sensitive fields from extra context
      if (event.extra && typeof event.extra === 'object' && event.extra !== null) {
        const extra = event.extra as Record<string, any>;
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
        sensitiveFields.forEach(field => {
          if (field in extra) {
            extra[field] = '[Filtered]';
          }
        });
      }
      
      return event;
    },
    
    // Ignore expected errors that don't require tracking
    ignoreErrors: [
      // Network errors (expected in mobile environments)
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'Network Error',
      
      // User cancellations (intentional actions)
      'AbortError',
      'User cancelled',
      'User canceled',
      
      // Expected HTTP errors (handled by application)
      'Unauthorized',
      'Not found',
      '401',
      '404',
    ],
  });
  
  logger.info('Sentry initialized', {
    environment,
    tracesSampleRate,
    release,
    dist,
  });
}

/** Breadcrumb for reels / video debugging in Sentry Issues. */
export function addReelsBreadcrumb(
  message: string,
  data?: Record<string, string | number | boolean | null | undefined>,
): void {
  Sentry.addBreadcrumb({
    category: 'reels',
    message,
    level: 'info',
    data: data as Record<string, unknown> | undefined,
  });
}

/**
 * Capture exception with context
 * 
 * @param error - The error to capture
 * @param context - Optional context including tags, extra data, and severity level
 * 
 * Requirements: 1.10 - Capture unhandled exceptions with full stack trace
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
  }
): void {
  logger.error('Capturing exception:', error);
  
  Sentry.captureException(error, {
    level: context?.level || 'error',
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Capture message
 * 
 * @param message - The message to capture
 * @param level - Severity level (default: 'info')
 * @param context - Optional context including tags and extra data
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }
): void {
  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Set user context
 * 
 * @param user - User information to associate with error reports
 * 
 * Requirements: 1.13 - Set user context on authentication
 */
export function setUser(user: {
  id: string;
  username?: string;
  email?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    username: user.username,
    email: user.email,
  });
}

/**
 * Clear user context
 * 
 * Requirements: 1.14 - Clear user context on logout
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb
 * 
 * @param message - Breadcrumb message
 * @param category - Breadcrumb category (e.g., 'navigation', 'user-action', 'http')
 * @param level - Severity level (default: 'info')
 * @param data - Additional data to attach to breadcrumb
 * 
 * Requirements: 6.1, 6.2, 6.3 - Capture breadcrumbs for user actions, navigation, and API calls
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set tag
 * 
 * @param key - Tag key
 * @param value - Tag value
 * 
 * Requirements: 6.4 - Set tags for feature context
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Set context
 * 
 * @param name - Context name
 * @param context - Context data
 * 
 * Requirements: 6.5 - Set context for additional debugging information
 */
export function setContext(name: string, context: Record<string, any>): void {
  Sentry.setContext(name, context);
}

/**
 * Measure async operation performance
 * 
 * @param name - Operation name for tracking
 * @param operation - Async operation to measure
 * @returns Result of the operation
 * 
 * Requirements: 6.6 - Track performance spans for critical operations
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await operation();
    const duration = Date.now() - start;
    
    logger.debug(`[Sentry] ${name} completed in ${duration}ms`);
    
    // Add breadcrumb for performance tracking
    addBreadcrumb(
      `${name} completed`,
      'performance',
      'info',
      { duration }
    );
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`[Sentry] ${name} failed after ${duration}ms`, error);
    
    // Add breadcrumb for failed operation
    addBreadcrumb(
      `${name} failed`,
      'performance',
      'error',
      { duration, error: error instanceof Error ? error.message : String(error) }
    );
    
    throw error;
  }
}

/**
 * Example usage in components
 */
export const SentryExample = {
  // Capture error with context
  captureError: (error: Error, feature: string) => {
    captureException(error, {
      tags: {
        feature,
        platform: 'mobile',
      },
      extra: {
        timestamp: new Date().toISOString(),
      },
      level: 'error',
    });
  },
  
  // Track user action
  trackAction: (action: string, data?: Record<string, any>) => {
    addBreadcrumb(action, 'user-action', 'info', data);
  },
  
  // Track navigation
  trackNavigation: (screen: string) => {
    addBreadcrumb(`Navigated to ${screen}`, 'navigation', 'info');
  },
  
  // Track API call
  trackAPICall: (endpoint: string, method: string) => {
    addBreadcrumb(
      `API ${method} ${endpoint}`,
      'http',
      'info',
      { endpoint, method }
    );
  },
};

// Export all functions
export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  setTag,
  setContext,
  measureAsync,
};
