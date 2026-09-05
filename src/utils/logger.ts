/**
 * Centralized Logger Service
 * Provides environment-aware logging with consistent formatting
 * Integrates with Sentry for error tracking in production
 * 
 * Requirements: 4.1, 4.2, 4.3, 6.14
 */

import * as Sentry from '@sentry/node';
import { allowSentryReport } from './sentry-report-limiter';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableInProduction: boolean;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Custom Sentry Transport for Winston-style logging
 * Forwards error and warn level logs to Sentry for centralized error tracking
 * 
 * Requirements: 6.14
 */
class SentryTransport {
  /**
   * Logs a message and forwards to Sentry if appropriate
   * @param level - Log level
   * @param message - Log message
   * @param metadata - Additional metadata
   */
  log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    // Only send to Sentry in production with valid DSN
    if (!isProduction() || !process.env.SENTRY_DSN) {
      return;
    }

    try {
      const sentryLevel = level === 'error' ? 'error' : 'warn';
      if (!allowSentryReport(sentryLevel, String(message), metadata)) {
        return;
      }
      if (level === 'error') {
        // For error level, capture as exception
        // Create an Error object from the message string
        const error = new Error(String(message));
        Sentry.captureException(error, {
          level: 'error',
          extra: metadata || {},
        });
      } else if (level === 'warn') {
        // For warn level, capture as message
        Sentry.captureMessage(String(message), {
          level: 'warning',
          extra: metadata || {},
        });
      }
    } catch (error) {
      // Silently fail if Sentry capture fails - don't break logging
      console.error('Failed to send log to Sentry:', error);
    }
  }
}

/**
 * Determines if the current environment is production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Formats a log message with timestamp and level
 */
export function formatLogMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();
  return `[${timestamp}] [${levelUpper}] ${message}`;
}

/**
 * Determines if a message at the given level should be logged
 * based on the configured minimum level and environment
 */
export function shouldLog(
  messageLevel: LogLevel,
  configLevel: LogLevel,
  isProductionEnv: boolean
): boolean {
  // In production, suppress debug messages regardless of config
  if (isProductionEnv && messageLevel === 'debug') {
    return false;
  }
  
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configLevel];
}

/**
 * Creates a logger instance with the specified configuration
 * Automatically integrates with Sentry in production
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  const defaultConfig: LoggerConfig = {
    level: 'debug',
    enableTimestamp: true,
    enableInProduction: true,
  };

  const finalConfig = { ...defaultConfig, ...config };
  const productionEnv = isProduction();
  
  // Create Sentry transport for production error tracking
  const sentryTransport = new SentryTransport();

  const log = (level: LogLevel, message: string, ...args: unknown[]): void => {
    if (!shouldLog(level, finalConfig.level, productionEnv)) {
      return;
    }

    const formattedMessage = finalConfig.enableTimestamp
      ? formatLogMessage(level, message)
      : `[${level.toUpperCase()}] ${message}`;

    // Console logging
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        break;
    }
    
    // Forward to Sentry transport (only in production with valid DSN)
    if (level === 'error' || level === 'warn') {
      // Extract metadata from args if present
      const metadata = args.length > 0 && typeof args[0] === 'object' 
        ? args[0] as Record<string, unknown>
        : undefined;
      
      sentryTransport.log(level, message, metadata);
    }
  };

  return {
    debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
    info: (message: string, ...args: unknown[]) => log('info', message, ...args),
    warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
    error: (message: string, ...args: unknown[]) => log('error', message, ...args),
  };
}

// Default logger instance for the application
export const logger = createLogger();

export default logger;
