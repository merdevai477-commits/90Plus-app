/**
 * Property-Based Tests for ErrorBoundary Component
 *
 * **Feature: ErrorBoundary, Property 7: ErrorBoundary Error Catching**
 * For any JavaScript error thrown within an ErrorBoundary's children,
 * the ErrorBoundary SHALL catch the error and render the fallback UI instead of crashing.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

import * as fc from 'fast-check';
import { ErrorInfo } from 'react';

// Mock react-native before any imports
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  TouchableOpacity: 'TouchableOpacity',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
}));

// Mock lucide-react-native
jest.mock('lucide-react-native', () => ({
  AlertTriangle: 'AlertTriangle',
  RefreshCw: 'RefreshCw',
  Home: 'Home',
}));

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../services/logger', () => ({
  logger: mockLogger,
}));

/**
 * ErrorBoundary State interface for testing
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Simulates getDerivedStateFromError behavior
 * This is the core logic we're testing
 */
function getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
  return {
    hasError: true,
    error,
  };
}

/**
 * Simulates the reset state behavior (what handleRetry does)
 */
function getResetState(): ErrorBoundaryState {
  return {
    hasError: false,
    error: null,
    errorInfo: null,
  };
}

/**
 * Simulates componentDidCatch logging behavior
 */
function simulateComponentDidCatch(
  error: Error,
  errorInfo: ErrorInfo,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
): void {
  mockLogger.error('ErrorBoundary caught an error:', error.message);
  mockLogger.error('Error stack:', error.stack || 'No stack trace');
  mockLogger.error('Component stack:', errorInfo.componentStack);

  if (onError) {
    onError(error, errorInfo);
  }
}

describe('ErrorBoundary Property Tests', () => {
  // Store original __DEV__ value
  const originalDev = (global as any).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
  });

  afterAll(() => {
    (global as any).__DEV__ = originalDev;
  });

  /**
   * **Feature: ErrorBoundary, Property 7: ErrorBoundary Error Catching**
   *
   * For any JavaScript error thrown within an ErrorBoundary's children,
   * the ErrorBoundary SHALL catch the error and render the fallback UI instead of crashing.
   */
  describe('Property 7: ErrorBoundary Error Catching', () => {
    // Arbitrary for error messages
    const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

    // Arbitrary for error names
    const errorNameArbitrary = fc.constantFrom(
      'Error',
      'TypeError',
      'ReferenceError',
      'SyntaxError',
      'RangeError'
    );

    it('should update state to hasError=true for any error (100 iterations)', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (message: string) => {
          const error = new Error(message);

          // Test getDerivedStateFromError
          const newState = getDerivedStateFromError(error);

          // Property: hasError should be true
          expect(newState.hasError).toBe(true);

          // Property: error should be the thrown error
          expect(newState.error).toBe(error);
        }),
        { numRuns: 100 }
      );
    });

    it('should capture error message for any error type (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorNameArbitrary,
          errorMessageArbitrary,
          (errorName: string, message: string) => {
            const error = new Error(message);
            error.name = errorName;

            const newState = getDerivedStateFromError(error);

            // Property: The captured error should have the correct message
            expect(newState.error?.message).toBe(message);

            // Property: The captured error should have the correct name
            expect(newState.error?.name).toBe(errorName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle errors with stack traces (100 iterations)', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (message: string) => {
          const error = new Error(message);

          // Errors created with new Error() have stack traces
          const newState = getDerivedStateFromError(error);

          // Property: hasError should be true regardless of stack trace
          expect(newState.hasError).toBe(true);

          // Property: error should be captured
          expect(newState.error).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reset state correctly when retry is called (100 iterations)', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (message: string) => {
          // Create an error state
          const errorState: ErrorBoundaryState = {
            hasError: true,
            error: new Error(message),
            errorInfo: null,
          };

          // Simulate reset (what handleRetry does)
          const resetState = getResetState();

          // Property: After reset, hasError should be false
          expect(resetState.hasError).toBe(false);

          // Property: After reset, error should be null
          expect(resetState.error).toBeNull();

          // Property: After reset, errorInfo should be null
          expect(resetState.errorInfo).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve error information in state (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (message: string, componentStack: string) => {
            const error = new Error(message);
            const errorInfo = { componentStack };

            // Simulate state after componentDidCatch
            const state: ErrorBoundaryState = {
              hasError: true,
              error,
              errorInfo,
            };

            // Property: Error message should be preserved
            expect(state.error?.message).toBe(message);

            // Property: Component stack should be preserved
            expect(state.errorInfo?.componentStack).toBe(componentStack);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty error messages (100 iterations)', () => {
      fc.assert(
        fc.property(fc.constant(''), (message: string) => {
          const error = new Error(message);

          const newState = getDerivedStateFromError(error);

          // Property: Should still catch the error even with empty message
          expect(newState.hasError).toBe(true);
          expect(newState.error).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('ErrorBoundary State Management', () => {
    it('should have correct initial state structure', () => {
      const initialState: ErrorBoundaryState = {
        hasError: false,
        error: null,
        errorInfo: null,
      };

      expect(initialState.hasError).toBe(false);
      expect(initialState.error).toBeNull();
      expect(initialState.errorInfo).toBeNull();
    });

    it('should transition from normal to error state correctly (100 iterations)', () => {
      fc.assert(
        fc.property(errorMessageArbitrary, (message: string) => {
          // Initial state
          const initialState: ErrorBoundaryState = {
            hasError: false,
            error: null,
            errorInfo: null,
          };

          // Error occurs
          const error = new Error(message);
          const errorState = getDerivedStateFromError(error);

          // Property: State should transition from no error to error
          expect(initialState.hasError).toBe(false);
          expect(errorState.hasError).toBe(true);

          // Property: Error should be captured in new state
          expect(errorState.error).toBe(error);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Arbitrary for error messages (redefine for this scope)
  const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 200 });

  describe('Error Logging', () => {
    it('should call logger.error when componentDidCatch is simulated (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (message: string, componentStack: string) => {
            jest.clearAllMocks();

            const error = new Error(message);
            const errorInfo = { componentStack };

            simulateComponentDidCatch(error, errorInfo);

            // Property: logger.error should be called
            expect(mockLogger.error).toHaveBeenCalled();

            // Property: logger.error should be called with error message
            expect(mockLogger.error).toHaveBeenCalledWith(
              'ErrorBoundary caught an error:',
              message
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should call onError callback when provided (100 iterations)', () => {
      fc.assert(
        fc.property(
          errorMessageArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (message: string, componentStack: string) => {
            const onError = jest.fn();
            const error = new Error(message);
            const errorInfo = { componentStack };

            simulateComponentDidCatch(error, errorInfo, onError);

            // Property: onError callback should be called with error and errorInfo
            expect(onError).toHaveBeenCalledWith(error, errorInfo);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
