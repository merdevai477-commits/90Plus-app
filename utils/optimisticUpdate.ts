/**
 * Optimistic Update Handler Utility
 * 
 * Provides a utility for handling optimistic UI updates with rollback capability.
 * This allows the UI to update immediately before async operations complete,
 * with automatic rollback if the operation fails.
 * 
 * Implements the update, rollback, confirm pattern with retry logic using
 * exponential backoff for resilient backend synchronization.
 * 
 * Requirements: 20.1, 20.2, 20.3
 */

/**
 * Retry configuration for exponential backoff
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Base delay in milliseconds between retries (default: 1000) */
  baseDelay: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

export interface OptimisticUpdateOptions<T> {
  /** Function to execute immediately to update UI optimistically */
  optimisticAction: () => void;
  /** Async function that performs the actual backend operation */
  asyncAction: () => Promise<T>;
  /** Function to rollback UI changes if async operation fails */
  rollbackAction: () => void;
  /** Optional callback on successful completion */
  onSuccess?: (result: T) => void;
  /** Optional callback on error */
  onError?: (error: Error) => void;
  /** Optional retry configuration for exponential backoff */
  retryConfig?: Partial<RetryConfig>;
}

export interface OptimisticUpdateResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  /** Number of attempts made (including initial attempt) */
  attempts?: number;
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff.
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Delays execution for the specified number of milliseconds.
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes an optimistic update with rollback support and retry logic.
 * 
 * The flow is:
 * 1. Execute optimisticAction immediately (UI updates instantly)
 * 2. Execute asyncAction in the background with retry logic
 * 3. If asyncAction succeeds (after any retries), call onSuccess
 * 4. If asyncAction fails after all retries, call rollbackAction to restore previous state, then call onError
 * 
 * Retry behavior:
 * - Uses exponential backoff between retry attempts
 * - Only rolls back and calls onError after ALL retry attempts have failed
 * - Configurable via retryConfig option
 * 
 * @param options - The optimistic update configuration
 * @returns Promise resolving to the result of the operation
 */
export async function executeOptimisticUpdate<T>(
  options: OptimisticUpdateOptions<T>
): Promise<OptimisticUpdateResult<T>> {
  const { 
    optimisticAction, 
    asyncAction, 
    rollbackAction, 
    onSuccess, 
    onError,
    retryConfig: userRetryConfig 
  } = options;

  // Merge user config with defaults
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...userRetryConfig,
  };

  // Step 1: Execute optimistic action immediately
  optimisticAction();

  let lastError: Error | null = null;
  let attempts = 0;

  // Step 2: Execute async action with retry logic
  while (attempts < retryConfig.maxAttempts) {
    attempts++;
    
    try {
      const result = await asyncAction();

      // Step 3: Call success callback if provided
      if (onSuccess) {
        onSuccess(result);
      }

      return { success: true, result, attempts };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If we have more attempts left, wait before retrying
      if (attempts < retryConfig.maxAttempts) {
        const backoffDelay = calculateBackoffDelay(attempts - 1, retryConfig);
        await delay(backoffDelay);
      }
    }
  }

  // Step 4: All retries failed - rollback
  rollbackAction();

  // Call error callback if provided
  if (onError && lastError) {
    onError(lastError);
  }

  return { success: false, error: lastError || new Error('Unknown error'), attempts };
}

/**
 * Creates a reusable optimistic update handler for a specific operation.
 * Useful when you need to perform the same type of optimistic update multiple times.
 * 
 * @param defaultOptions - Default options that can be overridden per execution
 * @returns A function that executes the optimistic update
 */
export function createOptimisticHandler<T>(
  defaultOptions: Partial<OptimisticUpdateOptions<T>>
) {
  return async (
    overrideOptions: Partial<OptimisticUpdateOptions<T>> = {}
  ): Promise<OptimisticUpdateResult<T>> => {
    // Merge retry configs properly
    const mergedRetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...defaultOptions.retryConfig,
      ...overrideOptions.retryConfig,
    };

    const mergedOptions = {
      ...defaultOptions,
      ...overrideOptions,
      retryConfig: mergedRetryConfig,
    } as OptimisticUpdateOptions<T>;

    // Validate required options
    if (!mergedOptions.optimisticAction) {
      throw new Error('optimisticAction is required');
    }
    if (!mergedOptions.asyncAction) {
      throw new Error('asyncAction is required');
    }
    if (!mergedOptions.rollbackAction) {
      throw new Error('rollbackAction is required');
    }

    return executeOptimisticUpdate(mergedOptions);
  };
}

/**
 * Executes an optimistic update without retry logic (single attempt).
 * Use this when you want immediate feedback without retries.
 * 
 * @param options - The optimistic update configuration (retryConfig is ignored)
 * @returns Promise resolving to the result of the operation
 */
export async function executeOptimisticUpdateNoRetry<T>(
  options: Omit<OptimisticUpdateOptions<T>, 'retryConfig'>
): Promise<OptimisticUpdateResult<T>> {
  return executeOptimisticUpdate({
    ...options,
    retryConfig: { maxAttempts: 1, baseDelay: 0, maxDelay: 0, backoffMultiplier: 1 },
  });
}

/**
 * Type guard to check if an OptimisticUpdateResult was successful
 */
export function isOptimisticSuccess<T>(
  result: OptimisticUpdateResult<T>
): result is OptimisticUpdateResult<T> & { success: true; result: T } {
  return result.success === true && 'result' in result;
}

/**
 * Type guard to check if an OptimisticUpdateResult failed
 */
export function isOptimisticFailure<T>(
  result: OptimisticUpdateResult<T>
): result is OptimisticUpdateResult<T> & { success: false; error: Error } {
  return !result.success && result.error !== undefined;
}

// ============================================================================
// Pending Operations Storage (Requirements: 20.4)
// ============================================================================

/**
 * Represents a pending operation that needs to be synced with the backend.
 */
export interface PendingOperation<T = unknown> {
  /** Unique identifier for the operation */
  id: string;
  /** Type of operation (e.g., 'like', 'follow', 'comment') */
  type: string;
  /** Payload data for the operation */
  payload: T;
  /** Timestamp when the operation was created */
  createdAt: number;
  /** Number of sync attempts made */
  attempts: number;
  /** Last error message if sync failed */
  lastError?: string;
}

/**
 * Storage key for pending operations
 */
const PENDING_OPERATIONS_KEY = '@optimistic_pending_operations';

/**
 * Interface for storage adapter (allows for testing with mock storage)
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Default storage adapter using AsyncStorage
 * This is lazily loaded to avoid issues in non-React Native environments
 */
let defaultStorageAdapter: StorageAdapter | null = null;

/**
 * Gets the default storage adapter (AsyncStorage)
 */
async function getDefaultStorageAdapter(): Promise<StorageAdapter> {
  if (!defaultStorageAdapter) {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      defaultStorageAdapter = AsyncStorage;
    } catch {
      // Fallback for non-React Native environments (e.g., testing)
      const memoryStore: Record<string, string> = {};
      defaultStorageAdapter = {
        getItem: async (key: string) => memoryStore[key] ?? null,
        setItem: async (key: string, value: string) => { memoryStore[key] = value; },
        removeItem: async (key: string) => { delete memoryStore[key]; },
      };
    }
  }
  return defaultStorageAdapter;
}

/**
 * Pending Operations Manager
 * 
 * Manages pending operations that need to be synced with the backend.
 * Operations are stored in AsyncStorage and can be synced on app start.
 */
export class PendingOperationsManager {
  private storage: StorageAdapter | null = null;
  private operations: Map<string, PendingOperation> = new Map();
  private initialized = false;
  private syncHandlers: Map<string, (payload: unknown) => Promise<void>> = new Map();

  /**
   * Initializes the manager with a storage adapter.
   * Call this on app start to load pending operations.
   * 
   * @param storage - Optional custom storage adapter (defaults to AsyncStorage)
   */
  async initialize(storage?: StorageAdapter): Promise<void> {
    if (this.initialized) return;

    this.storage = storage ?? await getDefaultStorageAdapter();
    await this.loadFromStorage();
    this.initialized = true;
  }

  /**
   * Registers a sync handler for a specific operation type.
   * 
   * @param type - The operation type
   * @param handler - Async function to sync the operation with backend
   */
  registerSyncHandler(type: string, handler: (payload: unknown) => Promise<void>): void {
    this.syncHandlers.set(type, handler);
  }

  /**
   * Adds a pending operation to be synced later.
   * 
   * @param type - The operation type
   * @param payload - The operation payload
   * @returns The created pending operation
   */
  async addOperation<T>(type: string, payload: T): Promise<PendingOperation<T>> {
    await this.ensureInitialized();

    const operation: PendingOperation<T> = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };

    this.operations.set(operation.id, operation as PendingOperation);
    await this.saveToStorage();

    return operation;
  }

  /**
   * Removes a pending operation (after successful sync).
   * 
   * @param id - The operation ID to remove
   */
  async removeOperation(id: string): Promise<void> {
    await this.ensureInitialized();

    this.operations.delete(id);
    await this.saveToStorage();
  }

  /**
   * Gets all pending operations.
   * 
   * @returns Array of pending operations
   */
  async getOperations(): Promise<PendingOperation[]> {
    await this.ensureInitialized();
    return Array.from(this.operations.values());
  }

  /**
   * Gets pending operations of a specific type.
   * 
   * @param type - The operation type to filter by
   * @returns Array of pending operations of the specified type
   */
  async getOperationsByType(type: string): Promise<PendingOperation[]> {
    await this.ensureInitialized();
    return Array.from(this.operations.values()).filter(op => op.type === type);
  }

  /**
   * Syncs all pending operations with the backend.
   * Uses registered sync handlers for each operation type.
   * 
   * @param retryConfig - Optional retry configuration
   * @returns Object with success count and failed operations
   */
  async syncAll(retryConfig?: Partial<RetryConfig>): Promise<{
    successCount: number;
    failedOperations: PendingOperation[];
  }> {
    await this.ensureInitialized();

    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    const operations = Array.from(this.operations.values());
    let successCount = 0;
    const failedOperations: PendingOperation[] = [];

    for (const operation of operations) {
      const handler = this.syncHandlers.get(operation.type);
      
      if (!handler) {
        // No handler registered for this type, keep it pending
        failedOperations.push(operation);
        continue;
      }

      let success = false;
      let lastError: string | undefined;

      // Try to sync with retries
      for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        try {
          await handler(operation.payload);
          success = true;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          
          if (attempt < config.maxAttempts - 1) {
            const delay = calculateBackoffDelay(attempt, config);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (success) {
        await this.removeOperation(operation.id);
        successCount++;
      } else {
        // Update operation with attempt info
        operation.attempts += config.maxAttempts;
        operation.lastError = lastError;
        this.operations.set(operation.id, operation);
        failedOperations.push(operation);
      }
    }

    // Save updated operations
    await this.saveToStorage();

    return { successCount, failedOperations };
  }

  /**
   * Clears all pending operations.
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    this.operations.clear();
    await this.saveToStorage();
  }

  /**
   * Gets the count of pending operations.
   */
  async getCount(): Promise<number> {
    await this.ensureInitialized();
    return this.operations.size;
  }

  /**
   * Checks if there are any pending operations.
   */
  async hasPending(): Promise<boolean> {
    return (await this.getCount()) > 0;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async loadFromStorage(): Promise<void> {
    if (!this.storage) return;

    try {
      const data = await this.storage.getItem(PENDING_OPERATIONS_KEY);
      if (data) {
        const parsed = JSON.parse(data) as PendingOperation[];
        this.operations = new Map(parsed.map(op => [op.id, op]));
      }
    } catch {
      // If loading fails, start with empty operations
      this.operations = new Map();
    }
  }

  private async saveToStorage(): Promise<void> {
    if (!this.storage) return;

    try {
      const data = Array.from(this.operations.values());
      await this.storage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(data));
    } catch {
      // Silently fail - operations will be lost but app continues
    }
  }
}

/**
 * Singleton instance of PendingOperationsManager
 */
export const pendingOperations = new PendingOperationsManager();

/**
 * Executes an optimistic update and stores the operation for later sync if it fails.
 * 
 * @param options - The optimistic update options
 * @param operationType - The type of operation for pending storage
 * @param operationPayload - The payload to store if sync fails
 * @returns Promise resolving to the result of the operation
 */
export async function executeOptimisticUpdateWithPending<T, P = unknown>(
  options: OptimisticUpdateOptions<T>,
  operationType: string,
  operationPayload: P
): Promise<OptimisticUpdateResult<T>> {
  const result = await executeOptimisticUpdate(options);

  // If the operation failed after all retries, store it for later sync
  if (!result.success) {
    await pendingOperations.addOperation(operationType, operationPayload);
  }

  return result;
}
