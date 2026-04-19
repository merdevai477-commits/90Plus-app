/**
 * Request Deduplication Service
 * 
 * Prevents duplicate API calls by caching in-flight requests.
 * If multiple components request the same endpoint with the same params,
 * only one request is made and all components receive the same promise.
 */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestDeduplicator {
  // Cache of in-flight requests
  private pendingRequests = new Map<string, PendingRequest>();
  
  // TTL for pending requests (1 second - prevents stale promises)
  private readonly PENDING_TTL = 1000;

  /**
   * Generate cache key from endpoint and params
   */
  private getCacheKey(endpoint: string, params?: Record<string, any>, userId?: string): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    const userStr = userId ? `:user:${userId}` : '';
    return `${endpoint}${paramsStr}${userStr}`;
  }

  /**
   * Execute a request with deduplication
   * If the same request is already in-flight, returns the existing promise
   */
  async execute<T>(
    endpoint: string,
    requestFn: () => Promise<T>,
    params?: Record<string, any>,
    userId?: string
  ): Promise<T> {
    const key = this.getCacheKey(endpoint, params, userId);
    
    // Check if request is already in-flight
    const pending = this.pendingRequests.get(key);
    if (pending) {
      const age = Date.now() - pending.timestamp;
      if (age < this.PENDING_TTL) {
        // Request still in-flight, return existing promise
        return pending.promise as Promise<T>;
      } else {
        // Request is stale, remove it
        this.pendingRequests.delete(key);
      }
    }

    // Create new request
    const promise = requestFn().finally(() => {
      // Remove from pending after completion (with small delay to allow concurrent calls)
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, 100);
    });

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Clear all pending requests (useful for testing or cleanup)
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests (for debugging)
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

// Singleton instance
export const requestDeduplicator = new RequestDeduplicator();

export default requestDeduplicator;

