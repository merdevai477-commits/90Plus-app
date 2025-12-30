/**
 * Property-Based Tests for Optimistic Update Handler
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import {
  executeOptimisticUpdate,
  OptimisticUpdateOptions,
  OptimisticUpdateResult,
  isOptimisticSuccess,
  isOptimisticFailure,
  calculateBackoffDelay,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from '../optimisticUpdate';

describe('Optimistic Update Property Tests', () => {
  /**
   * **Feature: performance-optimization, Property 1: Optimistic Clear Immediate UI Update**
   * *For any* list of notifications, when the clear all action is triggered,
   * the UI should immediately show an empty list before any async operation completes.
   * **Validates: Requirements 1.1**
   * 
   * This property test verifies that:
   * 1. The optimistic action is called immediately (synchronously)
   * 2. The optimistic action completes before the async action starts
   * 3. The UI state is updated before any network delay
   */
  describe('Property 1: Optimistic Clear Immediate UI Update', () => {
    it('should execute optimistic action immediately before async action completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random list of notification IDs (simulating notifications)
          fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
          // Generate a random delay for the async operation (simulating network latency)
          // Keep delays small to avoid test timeout
          fc.integer({ min: 1, max: 5 }),
          async (notificationIds, asyncDelay) => {
            // Track the order of operations
            const executionOrder: string[] = [];
            let uiState = [...notificationIds]; // Initial UI state with notifications
            let asyncStarted = false;
            let asyncCompleted = false;

            const options: OptimisticUpdateOptions<boolean> = {
              // Optimistic action: Clear UI immediately
              optimisticAction: () => {
                executionOrder.push('optimistic');
                uiState = []; // Clear the UI state immediately
              },
              // Async action: Simulate backend call with delay
              asyncAction: async () => {
                asyncStarted = true;
                executionOrder.push('async_start');
                await new Promise(resolve => setTimeout(resolve, asyncDelay));
                executionOrder.push('async_end');
                asyncCompleted = true;
                return true;
              },
              // Rollback action: Restore notifications if async fails
              rollbackAction: () => {
                executionOrder.push('rollback');
                uiState = [...notificationIds];
              },
            };

            // Execute the optimistic update
            const resultPromise = executeOptimisticUpdate(options);

            // Property 1: Optimistic action should be called first
            expect(executionOrder[0]).toBe('optimistic');

            // Property 2: UI should be cleared immediately (before async completes)
            expect(uiState).toEqual([]);

            // Property 3: Async should have started but not completed yet
            // (This verifies the optimistic action happened before async completion)
            expect(asyncStarted).toBe(true);
            expect(asyncCompleted).toBe(false);

            // Wait for the full operation to complete
            const result = await resultPromise;

            // Property 4: After completion, UI should still be empty (success case)
            expect(uiState).toEqual([]);
            expect(result.success).toBe(true);

            // Property 5: Execution order should be: optimistic -> async_start -> async_end
            expect(executionOrder).toEqual(['optimistic', 'async_start', 'async_end']);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should rollback UI state when async action fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random list of notification IDs
          fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
          // Generate a random error message
          fc.string({ minLength: 1, maxLength: 100 }),
          async (notificationIds, errorMessage) => {
            const executionOrder: string[] = [];
            let uiState = [...notificationIds];
            const originalState = [...notificationIds];

            const options: OptimisticUpdateOptions<boolean> = {
              optimisticAction: () => {
                executionOrder.push('optimistic');
                uiState = [];
              },
              asyncAction: async () => {
                executionOrder.push('async_start');
                throw new Error(errorMessage);
              },
              rollbackAction: () => {
                executionOrder.push('rollback');
                uiState = [...originalState];
              },
              // Disable retries for this test to verify immediate rollback behavior
              retryConfig: { maxAttempts: 1, baseDelay: 0, maxDelay: 0, backoffMultiplier: 1 },
            };

            const result = await executeOptimisticUpdate(options);

            // Property 1: Optimistic action should still be called first
            expect(executionOrder[0]).toBe('optimistic');

            // Property 2: Rollback should be called after async fails
            expect(executionOrder).toContain('rollback');

            // Property 3: UI state should be restored to original
            expect(uiState).toEqual(originalState);

            // Property 4: Result should indicate failure
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should call success callback with result when async succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random result data
          fc.record({
            cleared: fc.boolean(),
            count: fc.integer({ min: 0, max: 1000 }),
          }),
          async (resultData) => {
            let successCallbackCalled = false;
            let receivedResult: typeof resultData | null = null;

            const options: OptimisticUpdateOptions<typeof resultData> = {
              optimisticAction: () => {},
              asyncAction: async () => resultData,
              rollbackAction: () => {},
              onSuccess: (result) => {
                successCallbackCalled = true;
                receivedResult = result;
              },
            };

            await executeOptimisticUpdate(options);

            // Property: Success callback should be called with the result
            expect(successCallbackCalled).toBe(true);
            expect(receivedResult).toEqual(resultData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should call error callback when async fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (errorMessage) => {
            let errorCallbackCalled = false;
            let receivedError: Error | null = null;

            const options: OptimisticUpdateOptions<boolean> = {
              optimisticAction: () => {},
              asyncAction: async () => {
                throw new Error(errorMessage);
              },
              rollbackAction: () => {},
              onError: (error) => {
                errorCallbackCalled = true;
                receivedError = error;
              },
              // Disable retries for this test to verify immediate error callback behavior
              retryConfig: { maxAttempts: 1, baseDelay: 0, maxDelay: 0, backoffMultiplier: 1 },
            };

            await executeOptimisticUpdate(options);

            // Property: Error callback should be called with the error
            expect(errorCallbackCalled).toBe(true);
            expect(receivedError).toBeDefined();
            expect(receivedError?.message).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Type Guards', () => {
    it('isOptimisticSuccess should correctly identify successful results', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Use JSON-safe values to avoid undefined which is a valid result
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.string()),
            fc.record({ id: fc.string(), value: fc.integer() })
          ),
          async (resultValue) => {
            const successResult: OptimisticUpdateResult<typeof resultValue> = {
              success: true,
              result: resultValue,
            };

            const failureResult: OptimisticUpdateResult<typeof resultValue> = {
              success: false,
              error: new Error('test'),
            };

            expect(isOptimisticSuccess(successResult)).toBe(true);
            expect(isOptimisticSuccess(failureResult)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isOptimisticFailure should correctly identify failed results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          async (errorMessage) => {
            const successResult: OptimisticUpdateResult<string> = {
              success: true,
              result: 'test',
            };

            const failureResult: OptimisticUpdateResult<string> = {
              success: false,
              error: new Error(errorMessage),
            };

            expect(isOptimisticFailure(failureResult)).toBe(true);
            expect(isOptimisticFailure(successResult)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: security-technical-fixes, Property 25: Optimistic Update with Retry**
   * *For any* user action with optimistic update, if backend sync fails, the system 
   * SHALL retry before showing an error.
   * **Validates: Requirements 20.1, 20.2, 20.3**
   */
  describe('Property 25: Optimistic Update with Retry', () => {
    it('should retry failed async actions before rolling back', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of failures before success (0 = immediate success)
          fc.integer({ min: 0, max: 5 }),
          // Generate max retry attempts
          fc.integer({ min: 1, max: 5 }),
          async (failuresBeforeSuccess, maxAttempts) => {
            let attemptCount = 0;
            let optimisticCalled = false;
            let rollbackCalled = false;
            let uiState = 'initial';

            const options: OptimisticUpdateOptions<string> = {
              optimisticAction: () => {
                optimisticCalled = true;
                uiState = 'optimistic';
              },
              asyncAction: async () => {
                attemptCount++;
                if (attemptCount <= failuresBeforeSuccess) {
                  throw new Error(`Attempt ${attemptCount} failed`);
                }
                return 'success';
              },
              rollbackAction: () => {
                rollbackCalled = true;
                uiState = 'initial';
              },
              retryConfig: {
                maxAttempts,
                baseDelay: 1, // Use minimal delay for tests
                maxDelay: 10,
                backoffMultiplier: 2,
              },
            };

            const result = await executeOptimisticUpdate(options);

            // Property 1: Optimistic action should always be called first
            expect(optimisticCalled).toBe(true);

            // Property 2: If failures < maxAttempts, should eventually succeed
            if (failuresBeforeSuccess < maxAttempts) {
              expect(result.success).toBe(true);
              expect(result.result).toBe('success');
              expect(rollbackCalled).toBe(false);
              expect(uiState).toBe('optimistic');
              // Should have made exactly failuresBeforeSuccess + 1 attempts
              expect(attemptCount).toBe(failuresBeforeSuccess + 1);
            } else {
              // Property 3: If failures >= maxAttempts, should fail and rollback
              expect(result.success).toBe(false);
              expect(rollbackCalled).toBe(true);
              expect(uiState).toBe('initial');
              // Should have made exactly maxAttempts attempts
              expect(attemptCount).toBe(maxAttempts);
            }

            // Property 4: Result should include attempt count
            expect(result.attempts).toBe(attemptCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use exponential backoff between retry attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate retry config parameters
          fc.integer({ min: 10, max: 100 }), // baseDelay
          fc.integer({ min: 100, max: 1000 }), // maxDelay
          fc.integer({ min: 2, max: 4 }), // backoffMultiplier
          fc.integer({ min: 0, max: 5 }), // attempt number
          async (baseDelay, maxDelay, backoffMultiplier, attempt) => {
            const config: RetryConfig = {
              maxAttempts: 5,
              baseDelay,
              maxDelay,
              backoffMultiplier,
            };

            const calculatedDelay = calculateBackoffDelay(attempt, config);

            // Property 1: Delay should be baseDelay * (multiplier ^ attempt)
            const expectedDelay = baseDelay * Math.pow(backoffMultiplier, attempt);
            
            // Property 2: Delay should never exceed maxDelay
            expect(calculatedDelay).toBeLessThanOrEqual(maxDelay);

            // Property 3: Delay should be the minimum of expected and maxDelay
            expect(calculatedDelay).toBe(Math.min(expectedDelay, maxDelay));

            // Property 4: Delay should always be positive
            expect(calculatedDelay).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only rollback after all retry attempts have failed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // maxAttempts
          async (maxAttempts) => {
            let attemptCount = 0;
            let rollbackCalled = false;
            const rollbackAttempts: number[] = [];

            const options: OptimisticUpdateOptions<string> = {
              optimisticAction: () => {},
              asyncAction: async () => {
                attemptCount++;
                throw new Error(`Attempt ${attemptCount} failed`);
              },
              rollbackAction: () => {
                rollbackCalled = true;
                rollbackAttempts.push(attemptCount);
              },
              retryConfig: {
                maxAttempts,
                baseDelay: 1,
                maxDelay: 10,
                backoffMultiplier: 2,
              },
            };

            await executeOptimisticUpdate(options);

            // Property 1: Rollback should be called exactly once
            expect(rollbackAttempts.length).toBe(1);

            // Property 2: Rollback should only happen after all attempts exhausted
            expect(rollbackAttempts[0]).toBe(maxAttempts);

            // Property 3: Total attempts should equal maxAttempts
            expect(attemptCount).toBe(maxAttempts);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should call error callback only after all retries fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // maxAttempts
          fc.string({ minLength: 1, maxLength: 50 }), // error message
          async (maxAttempts, errorMessage) => {
            let errorCallbackCount = 0;
            let lastErrorMessage: string | null = null;
            let attemptCount = 0;

            const options: OptimisticUpdateOptions<string> = {
              optimisticAction: () => {},
              asyncAction: async () => {
                attemptCount++;
                throw new Error(errorMessage);
              },
              rollbackAction: () => {},
              onError: (error) => {
                errorCallbackCount++;
                lastErrorMessage = error.message;
              },
              retryConfig: {
                maxAttempts,
                baseDelay: 1,
                maxDelay: 10,
                backoffMultiplier: 2,
              },
            };

            const result = await executeOptimisticUpdate(options);

            // Property 1: Error callback should be called exactly once
            expect(errorCallbackCount).toBe(1);

            // Property 2: Error message should match the last error
            expect(lastErrorMessage).toBe(errorMessage);

            // Property 3: Result should indicate failure
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should succeed immediately if first attempt succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // maxAttempts
          fc.string({ minLength: 1, maxLength: 50 }), // result value
          async (maxAttempts, resultValue) => {
            let attemptCount = 0;
            let rollbackCalled = false;

            const options: OptimisticUpdateOptions<string> = {
              optimisticAction: () => {},
              asyncAction: async () => {
                attemptCount++;
                return resultValue;
              },
              rollbackAction: () => {
                rollbackCalled = true;
              },
              retryConfig: {
                maxAttempts,
                baseDelay: 1,
                maxDelay: 10,
                backoffMultiplier: 2,
              },
            };

            const result = await executeOptimisticUpdate(options);

            // Property 1: Should succeed on first attempt
            expect(attemptCount).toBe(1);

            // Property 2: Rollback should not be called
            expect(rollbackCalled).toBe(false);

            // Property 3: Result should be successful with correct value
            expect(result.success).toBe(true);
            expect(result.result).toBe(resultValue);
            expect(result.attempts).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
