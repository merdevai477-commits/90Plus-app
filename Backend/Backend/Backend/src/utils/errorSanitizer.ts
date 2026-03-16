/**
 * 🐉 DRAGON MODE: Production Error Sanitizer
 * Strips internal details from error messages in production
 * Prevents information leakage
 */

import { logger } from './logger';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Sensitive patterns to remove from error messages
 */
const SENSITIVE_PATTERNS = [
  /DATABASE_URL=.*/gi,
  /password[=:]\s*\S+/gi,
  /api[_-]?key[=:]\s*\S+/gi,
  /secret[=:]\s*\S+/gi,
  /token[=:]\s*\S+/gi,
  /bearer\s+\S+/gi,
  /postgresql:\/\/[^@]+@/gi, // Database connection strings
  /mongodb:\/\/[^@]+@/gi,
  /redis:\/\/[^@]+@/gi,
  /\/home\/[^\/]+/gi, // Home directories
  /\/Users\/[^\/]+/gi,
  /C:\\Users\\[^\\]+/gi,
];

/**
 * Generic error messages for production
 */
const GENERIC_ERRORS: Record<string, string> = {
  'ECONNREFUSED': 'Service temporarily unavailable',
  'ETIMEDOUT': 'Request timeout',
  'ENOTFOUND': 'Service not found',
  'ECONNRESET': 'Connection reset',
  'EPIPE': 'Connection closed',
  'P2002': 'Duplicate entry',
  'P2003': 'Foreign key constraint failed',
  'P2025': 'Record not found',
};

/**
 * Sanitize error message for production
 */
export function sanitizeError(error: any): string {
  if (!isProduction) {
    // In development, return full error
    return error?.message || 'Unknown error';
  }

  let message = error?.message || 'Internal server error';

  // Check for known error codes
  if (error?.code && GENERIC_ERRORS[error.code]) {
    return GENERIC_ERRORS[error.code];
  }

  // Remove sensitive information
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, '[REDACTED]');
  }

  // Remove file paths
  message = message.replace(/at\s+.*\(.*:\d+:\d+\)/g, '');
  message = message.replace(/\s+at\s+.*/g, '');

  // Remove stack traces
  if (message.includes('\n')) {
    message = message.split('\n')[0];
  }

  // If message is too technical, use generic message
  if (
    message.includes('prisma') ||
    message.includes('database') ||
    message.includes('query') ||
    message.includes('SQL') ||
    message.includes('connection')
  ) {
    return 'Database operation failed';
  }

  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('ECONNREFUSED')
  ) {
    return 'Network request failed';
  }

  if (message.length > 100) {
    return 'Internal server error';
  }

  return message;
}

/**
 * Create safe error response for API
 */
export function createErrorResponse(error: any, defaultMessage: string = 'Operation failed') {
  const sanitizedMessage = sanitizeError(error);
  
  // Log full error internally
  logger.error('Error occurred:', {
    message: error?.message,
    code: error?.code,
    stack: error?.stack,
    sanitized: sanitizedMessage,
  });

  return {
    status: 'ERROR',
    message: sanitizedMessage || defaultMessage,
  };
}

/**
 * Sanitize error for client response
 */
export function sanitizeErrorForClient(error: any): {
  message: string;
  code?: string;
} {
  const message = sanitizeError(error);
  
  // Only include error code if it's safe
  const safeCode = error?.code && !error.code.includes('P') ? error.code : undefined;
  
  return {
    message,
    ...(safeCode && { code: safeCode }),
  };
}
