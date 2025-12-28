/**
 * Property-Based Tests for Logger Service
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 4: Logger Environment Behavior**
 * **Feature: security-technical-fixes, Property 5: Logger Message Format**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import * as fc from 'fast-check';
import {
  formatLogMessage,
  shouldLog,
  LogLevel,
} from '../utils/logger';

// Arbitrary for valid log levels
const logLevelArb = fc.constantFrom<LogLevel>('debug', 'info', 'warn', 'error');

// Arbitrary for non-empty log messages
const logMessageArb = fc.string({ minLength: 1, maxLength: 200 });

describe('Logger Property Tests', () => {
  /**
   * **Feature: security-technical-fixes, Property 4: Logger Environment Behavior**
   * *For any* log message at debug level, when the environment is production,
   * the logger SHALL suppress the output; when the environment is development,
   * the logger SHALL output the message.
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 4: Logger Environment Behavior', () => {
    it('should suppress debug messages in production environment', () => {
      fc.assert(
        fc.property(
          logLevelArb, // config level
          (configLevel) => {
            const isProductionEnv = true;
            const result = shouldLog('debug', configLevel, isProductionEnv);
            
            // Debug should always be suppressed in production
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow debug messages in development environment when config level permits', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<LogLevel>('debug'), // config level must be debug to allow debug messages
          (configLevel) => {
            const isProductionEnv = false;
            const result = shouldLog('debug', configLevel, isProductionEnv);
            
            // Debug should be allowed in development when config level is debug
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow non-debug messages in production when level permits', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<LogLevel>('info', 'warn', 'error'), // message level
          fc.constantFrom<LogLevel>('debug', 'info'), // config level that permits info+
          (messageLevel, configLevel) => {
            const isProductionEnv = true;
            const result = shouldLog(messageLevel, configLevel, isProductionEnv);
            
            // Non-debug messages should be allowed in production if level permits
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect log level hierarchy in development', () => {
      fc.assert(
        fc.property(
          logLevelArb, // message level
          logLevelArb, // config level
          (messageLevel, configLevel) => {
            const isProductionEnv = false;
            const result = shouldLog(messageLevel, configLevel, isProductionEnv);
            
            const levelOrder: Record<LogLevel, number> = {
              debug: 0,
              info: 1,
              warn: 2,
              error: 3,
            };
            
            // Message should be logged if its level >= config level
            const expected = levelOrder[messageLevel] >= levelOrder[configLevel];
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: security-technical-fixes, Property 5: Logger Message Format**
   * *For any* log message created by the logger service, the output SHALL
   * contain a timestamp and log level indicator.
   * **Validates: Requirements 4.3**
   */
  describe('Property 5: Logger Message Format', () => {
    it('should include timestamp in ISO format for any message', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          logMessageArb,
          (level, message) => {
            const formatted = formatLogMessage(level, message);
            
            // Should contain ISO timestamp pattern [YYYY-MM-DDTHH:mm:ss.sssZ]
            const isoTimestampPattern = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
            expect(formatted).toMatch(isoTimestampPattern);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include log level indicator for any message', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          logMessageArb,
          (level, message) => {
            const formatted = formatLogMessage(level, message);
            
            // Should contain the level in uppercase brackets
            const levelUpper = level.toUpperCase();
            expect(formatted).toContain(`[${levelUpper}]`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve the original message content', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          logMessageArb,
          (level, message) => {
            const formatted = formatLogMessage(level, message);
            
            // The original message should be present in the output
            expect(formatted).toContain(message);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format message in correct order: timestamp, level, message', () => {
      fc.assert(
        fc.property(
          logLevelArb,
          logMessageArb,
          (level, message) => {
            const formatted = formatLogMessage(level, message);
            
            // Find positions of each component
            const timestampMatch = formatted.match(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
            const levelMatch = formatted.match(/\[(DEBUG|INFO|WARN|ERROR)\]/);
            const messageIndex = formatted.lastIndexOf(message);
            
            expect(timestampMatch).not.toBeNull();
            expect(levelMatch).not.toBeNull();
            
            const timestampIndex = timestampMatch!.index!;
            const levelIndex = levelMatch!.index!;
            
            // Order should be: timestamp < level < message
            expect(timestampIndex).toBeLessThan(levelIndex);
            expect(levelIndex).toBeLessThan(messageIndex);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
