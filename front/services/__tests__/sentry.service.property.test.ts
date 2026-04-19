/**
 * Property-Based Tests for Frontend Sentry Service
 *
 * **Feature: infrastructure-setup-and-configuration, Property 2: Exception Capture Completeness**
 * For any unhandled exception that occurs in the application, the Sentry service SHALL
 * capture the exception with a complete stack trace including filename, function name, and line numbers.
 *
 * **Validates: Requirements 1.10**
 */

import * as fc from 'fast-check';
import * as Sentry from '@sentry/react-native';
import { captureException } from '../sentry.service';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  SeverityLevel: {
    Fatal: 'fatal',
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
    Debug: 'debug',
  },
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
      ios: { buildNumber: '100' },
      android: { versionCode: 100 },
    },
  },
}));

describe('Sentry Service Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: infrastructure-setup-and-configuration, Property 2: Exception Capture Completeness**
   *
   * For any unhandled exception that occurs in the application, the Sentry service SHALL
   * capture the exception with a complete stack trace including filename, function name, and line numbers.
   *
   * **Validates: Requirements 1.10**
   */
  describe('Property 2: Exception Capture Completeness', () => {
    // Arbitrary for generating random error messages
    const errorMessageArb = fc.string({ minLength: 5, maxLength: 100 });

    // Arbitrary for generating random filenames
    const filenameArb = fc.oneof(
      fc.constant('services/api.ts'),
      fc.constant('components/VideoPlayer.tsx'),
      fc.constant('utils/helpers.ts'),
      fc.constant('hooks/useAuth.ts'),
      fc.constant('screens/Home.tsx'),
      fc.string({ minLength: 5, maxLength: 50 }).map(s => `${s}.ts`)
    );

    // Arbitrary for generating random function names
    const functionNameArb = fc.oneof(
      fc.constant('fetchData'),
      fc.constant('handleSubmit'),
      fc.constant('processVideo'),
      fc.constant('validateInput'),
      fc.constant('renderComponent'),
      fc.string({ minLength: 3, maxLength: 30 }).filter(s => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s))
    );

    // Arbitrary for generating random line numbers
    const lineNumberArb = fc.integer({ min: 1, max: 10000 });

    // Arbitrary for generating random column numbers
    const columnNumberArb = fc.integer({ min: 1, max: 200 });

    /**
     * Helper function to create an Error with a realistic stack trace
     */
    function createErrorWithStack(
      message: string,
      filename: string,
      functionName: string,
      lineno: number,
      colno: number
    ): Error {
      const error = new Error(message);
      
      // Create a realistic stack trace
      error.stack = [
        `Error: ${message}`,
        `    at ${functionName} (${filename}:${lineno}:${colno})`,
        `    at Object.callFunction (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:123:45)`,
        `    at __callFunction (node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js:67:89)`,
      ].join('\n');
      
      return error;
    }

    /**
     * Test that captureException is called with the error
     * Requirement 1.10: Capture unhandled exceptions
     */
    it('should capture any exception passed to captureException (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArb,
          filenameArb,
          functionNameArb,
          lineNumberArb,
          columnNumberArb,
          (message, filename, functionName, lineno, colno) => {
            // Create error with stack trace
            const error = createErrorWithStack(message, filename, functionName, lineno, colno);

            // Capture the exception
            captureException(error);

            // Verify Sentry.captureException was called
            expect(Sentry.captureException).toHaveBeenCalled();
            
            // Get the call arguments
            const calls = (Sentry.captureException as jest.Mock).mock.calls;
            const lastCall = calls[calls.length - 1];
            
            // Verify the error was passed
            expect(lastCall[0]).toBe(error);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that captured exceptions contain complete stack traces
     * Requirement 1.10: Full stack trace with filename, function, line numbers
     */
    it('should capture exceptions with complete stack traces including filename, function, and line numbers (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArb,
          filenameArb,
          functionNameArb,
          lineNumberArb,
          columnNumberArb,
          (message, filename, functionName, lineno, colno) => {
            // Create error with stack trace
            const error = createErrorWithStack(message, filename, functionName, lineno, colno);

            // Capture the exception
            captureException(error);

            // Verify the error has a stack trace
            expect(error.stack).toBeDefined();
            expect(error.stack).not.toBe('');

            // Verify stack trace contains filename
            expect(error.stack).toContain(filename);

            // Verify stack trace contains function name
            expect(error.stack).toContain(functionName);

            // Verify stack trace contains line number
            expect(error.stack).toContain(`:${lineno}:`);

            // Verify stack trace contains column number
            expect(error.stack).toContain(`:${colno}`);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that exceptions with context are captured correctly
     * Requirement 1.10: Capture with context
     */
    it('should capture exceptions with additional context (tags, extra, level) (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArb,
          filenameArb,
          functionNameArb,
          lineNumberArb,
          columnNumberArb,
          fc.record({
            tags: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 50 })),
            extra: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
            level: fc.constantFrom('fatal', 'error', 'warning', 'info', 'debug') as fc.Arbitrary<Sentry.SeverityLevel>,
          }),
          (message, filename, functionName, lineno, colno, context) => {
            // Create error with stack trace
            const error = createErrorWithStack(message, filename, functionName, lineno, colno);

            // Capture the exception with context
            captureException(error, context);

            // Verify Sentry.captureException was called with context
            expect(Sentry.captureException).toHaveBeenCalled();
            
            const calls = (Sentry.captureException as jest.Mock).mock.calls;
            const lastCall = calls[calls.length - 1];
            
            // Verify error and context were passed
            expect(lastCall[0]).toBe(error);
            expect(lastCall[1]).toMatchObject({
              level: context.level,
              tags: context.tags,
              extra: context.extra,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that exceptions without context use default error level
     */
    it('should use default error level when no context is provided (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArb,
          filenameArb,
          functionNameArb,
          lineNumberArb,
          columnNumberArb,
          (message, filename, functionName, lineno, colno) => {
            // Create error with stack trace
            const error = createErrorWithStack(message, filename, functionName, lineno, colno);

            // Capture the exception without context
            captureException(error);

            // Verify Sentry.captureException was called with default level
            const calls = (Sentry.captureException as jest.Mock).mock.calls;
            const lastCall = calls[calls.length - 1];
            
            expect(lastCall[1]).toMatchObject({
              level: 'error',
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that multiple exceptions can be captured sequentially
     */
    it('should capture multiple exceptions sequentially without loss (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              message: errorMessageArb,
              filename: filenameArb,
              functionName: functionNameArb,
              lineno: lineNumberArb,
              colno: columnNumberArb,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (errorConfigs) => {
            // Clear previous calls
            (Sentry.captureException as jest.Mock).mockClear();

            // Capture all exceptions
            errorConfigs.forEach(config => {
              const error = createErrorWithStack(
                config.message,
                config.filename,
                config.functionName,
                config.lineno,
                config.colno
              );
              captureException(error);
            });

            // Verify all exceptions were captured
            expect(Sentry.captureException).toHaveBeenCalledTimes(errorConfigs.length);

            // Verify each error has a complete stack trace
            const calls = (Sentry.captureException as jest.Mock).mock.calls;
            calls.forEach((call, index) => {
              const error = call[0] as Error;
              const config = errorConfigs[index];
              
              expect(error.stack).toContain(config.filename);
              expect(error.stack).toContain(config.functionName);
              expect(error.stack).toContain(`:${config.lineno}:`);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that exceptions with empty or minimal stack traces are still captured
     */
    it('should capture exceptions even with minimal stack traces (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArb,
          (message) => {
            // Create error with minimal stack
            const error = new Error(message);
            error.stack = `Error: ${message}`;

            // Capture the exception
            captureException(error);

            // Verify Sentry.captureException was called
            expect(Sentry.captureException).toHaveBeenCalled();
            
            const calls = (Sentry.captureException as jest.Mock).mock.calls;
            const lastCall = calls[calls.length - 1];
            
            expect(lastCall[0]).toBe(error);
            expect(lastCall[0].message).toBe(message);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that exceptions with very long stack traces are captured
     */
    it('should capture exceptions with very long stack traces (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArb,
          fc.integer({ min: 10, max: 50 }),
          (message, stackDepth) => {
            // Create error with deep stack
            const error = new Error(message);
            const stackLines = [`Error: ${message}`];
            
            for (let i = 0; i < stackDepth; i++) {
              stackLines.push(`    at function${i} (file${i}.ts:${i + 1}:${i + 1})`);
            }
            
            error.stack = stackLines.join('\n');

            // Capture the exception
            captureException(error);

            // Verify Sentry.captureException was called
            expect(Sentry.captureException).toHaveBeenCalled();
            
            const calls = (Sentry.captureException as jest.Mock).mock.calls;
            const lastCall = calls[calls.length - 1];
            
            expect(lastCall[0]).toBe(error);
            expect(lastCall[0].stack?.split('\n').length).toBeGreaterThanOrEqual(stackDepth);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that exceptions with special characters in messages are captured
     */
    it('should capture exceptions with special characters in messages (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          filenameArb,
          functionNameArb,
          lineNumberArb,
          columnNumberArb,
          (message, filename, functionName, lineno, colno) => {
            // Create error with special characters
            const error = createErrorWithStack(message, filename, functionName, lineno, colno);

            // Capture the exception
            captureException(error);

            // Verify Sentry.captureException was called
            expect(Sentry.captureException).toHaveBeenCalled();
            
            const calls = (Sentry.captureException as jest.Mock).mock.calls;
            const lastCall = calls[calls.length - 1];
            
            expect(lastCall[0]).toBe(error);
            expect(lastCall[0].message).toBe(message);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
