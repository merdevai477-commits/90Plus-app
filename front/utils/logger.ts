/**
 * Production-safe logger
 * ✅ Disables console.log in production to improve performance
 */

const isDevelopment = __DEV__;

class Logger {
  log(...args: any[]): void {
    if (isDevelopment) {
      console.log(...args);
    }
  }

  error(...args: any[]): void {
    // Always log errors, even in production
    console.error(...args);
  }

  warn(...args: any[]): void {
    if (isDevelopment) {
      console.warn(...args);
    }
  }

  debug(...args: any[]): void {
    if (isDevelopment) {
      console.debug(...args);
    }
  }

  info(...args: any[]): void {
    if (isDevelopment) {
      console.info(...args);
    }
  }
}

export const logger = new Logger();

// Export as default for convenience
export default logger;

