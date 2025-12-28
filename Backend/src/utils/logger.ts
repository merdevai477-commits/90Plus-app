/**
 * Centralized Logger Service
 * Provides environment-aware logging with consistent formatting
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

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
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  const defaultConfig: LoggerConfig = {
    level: 'debug',
    enableTimestamp: true,
    enableInProduction: true,
  };

  const finalConfig = { ...defaultConfig, ...config };
  const productionEnv = isProduction();

  const log = (level: LogLevel, message: string, ...args: unknown[]): void => {
    if (!shouldLog(level, finalConfig.level, productionEnv)) {
      return;
    }

    const formattedMessage = finalConfig.enableTimestamp
      ? formatLogMessage(level, message)
      : `[${level.toUpperCase()}] ${message}`;

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
