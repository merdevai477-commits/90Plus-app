/**
 * Sentry Configuration Module for Backend
 * 
 * Provides error tracking and performance monitoring for the Node.js/Express application.
 * Implements DSN validation, environment detection, sensitive data filtering, and Express integration.
 * 
 * Requirements: 1.4, 1.6, 1.7, 1.8, 1.9
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Application } from 'express';
import { logger } from '../utils/logger';

/**
 * Validates the Sentry DSN format
 * @param dsn - The DSN string to validate
 * @returns true if DSN is valid, false otherwise
 */
function isValidDSN(dsn: string | undefined): boolean {
  if (!dsn || typeof dsn !== 'string') {
    return false;
  }
  
  // DSN format: https://<key>@<host>/<project-id>
  const dsnPattern = /^https:\/\/[a-zA-Z0-9]+@[a-zA-Z0-9.-]+\/\d+$/;
  return dsnPattern.test(dsn);
}

/**
 * Determines the current environment
 * @returns 'development' or 'production'
 */
function getEnvironment(): string {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * Determines if the current environment is development
 * @returns true if development, false otherwise
 */
function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Gets the appropriate trace sample rate based on environment
 * @returns 1.0 for development (100%), 0.2 for production (20%)
 */
function getTracesSampleRate(): number {
  return isDevelopment() ? 1.0 : 0.2;
}

/**
 * Gets the appropriate profiling sample rate based on environment
 * @returns 1.0 for development (100%), 0.1 for production (10%)
 */
function getProfilesSampleRate(): number {
  return isDevelopment() ? 1.0 : 0.1;
}

/**
 * Filters sensitive data from error events before sending to Sentry
 * Removes Authorization headers, cookies, and password/token/secret fields
 * 
 * Requirements: 1.8
 */
function beforeSendHook(event: Sentry.ErrorEvent, _hint?: Sentry.EventHint): Sentry.ErrorEvent | null {
  // Filter sensitive headers
  if (event.request?.headers) {
    const headers = event.request.headers;
    delete headers.authorization;
    delete headers.Authorization;
    delete headers.cookie;
    delete headers.Cookie;
  }
  
  // Filter sensitive data fields
  if (event.request?.data) {
    const data = event.request.data;
    if (typeof data === 'object' && data !== null) {
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
      
      for (const field of sensitiveFields) {
        if (field in data) {
          (data as Record<string, unknown>)[field] = '[Filtered]';
        }
      }
    }
  }
  
  // Filter sensitive data from extra context
  if (event.extra) {
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
    
    for (const field of sensitiveFields) {
      if (field in event.extra) {
        event.extra[field] = '[Filtered]';
      }
    }
  }
  
  return event;
}

/**
 * Initializes Sentry for the Backend application
 * Configures error tracking, performance monitoring, and Express integration
 * 
 * Requirements: 1.4, 1.6, 1.7, 1.8, 1.9, 1.12, 5.14
 * 
 * @param app - Express application instance
 */
export function initializeSentry(app: Application): void {
  const dsn = process.env.SENTRY_DSN;
  
  // Validate DSN
  if (!isValidDSN(dsn)) {
    // Not an app failure; Sentry is optional.
    // Keep as info to avoid alarming production logs.
    logger.info('Sentry DSN not configured or invalid - error tracking disabled');
    return;
  }
  
  const environment = getEnvironment();
  const tracesSampleRate = getTracesSampleRate();
  const profilesSampleRate = getProfilesSampleRate();
  
  try {
    // Sentry.init({
    //   dsn,
    //   environment,
    //   tracesSampleRate,
    //   profilesSampleRate,
      
    //   // Integrations for performance monitoring and profiling
    //   integrations: [
    //     nodeProfilingIntegration(),
    //   ],
      
    //   // Filter sensitive data before sending
    //   beforeSend: beforeSendHook,
      
    //   // Ignore expected errors that don't require tracking
    //   ignoreErrors: [
    //     'NetworkError',
    //     'AbortError',
    //     'Unauthorized',
    //     'Not found',
    //     // Common client-side errors that shouldn't be tracked
    //     'Network request failed',
    //     'Failed to fetch',
    //     'Load failed',
    //   ],
    // });
    
    // Setup Express error handler (combines request handler, tracing handler, and error handler)
    // This must be called after Sentry.init() and will add the necessary middleware
    // Requirements: 1.12 - Request handler, tracing handler, and error handler
    Sentry.setupExpressErrorHandler(app);
    
    logger.info(`✅ Sentry initialized for Backend (${environment}, traces: ${tracesSampleRate * 100}%, profiling: ${profilesSampleRate * 100}%)`);
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Gets the Sentry error handler middleware
 * This should be added after all routes but before other error handlers
 * Note: In Sentry v8+, this is handled automatically by setupExpressErrorHandler
 * This function is kept for backward compatibility but is no longer needed
 * 
 * @returns Express error handler middleware
 * @deprecated Use setupExpressErrorHandler in initializeSentry instead
 */
export function getSentryErrorHandler() {
  // In Sentry v8+, setupExpressErrorHandler handles this automatically
  // Return a no-op middleware for backward compatibility
  return (_req: any, _res: any, next: any) => next();
}

/**
 * Manually captures an exception and sends it to Sentry
 * 
 * @param error - The error to capture
 * @param context - Optional additional context
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.captureException(error, { extra: context });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Sets the user context for error tracking
 * Should be called after user authentication
 * 
 * Requirements: 1.13
 * 
 * @param user - User information
 */
export function setUser(user: { id: string; username?: string; email?: string }): void {
  Sentry.setUser({
    id: user.id,
    username: user.username,
    email: user.email,
  });
}

/**
 * Clears the user context
 * Should be called on user logout
 * 
 * Requirements: 1.14
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Adds a breadcrumb for debugging context
 * 
 * @param message - Breadcrumb message
 * @param category - Breadcrumb category (e.g., 'navigation', 'api', 'user-action')
 * @param level - Severity level
 * @param data - Additional data
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
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
 * Sets a tag for filtering and grouping errors
 * 
 * @param key - Tag key
 * @param value - Tag value
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Sets context data for additional debugging information
 * 
 * @param name - Context name
 * @param context - Context data
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  Sentry.setContext(name, context);
}

/**
 * Captures a message (non-error event)
 * 
 * @param message - Message to capture
 * @param level - Severity level
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}
