/**
 * Request Queue Service
 * Limits concurrent requests to prevent overloading the server
 * 
 * Issue #6: Excessive Parallel Requests
 * - Max 3 concurrent requests
 * - Queue remaining requests
 * - Automatic retry with exponential backoff
 */

import { logger } from './logger';

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
  maxRetries: number;
  priority: number;
}

class RequestQueueService {
  private queue: QueuedRequest<any>[] = [];
  private activeRequests = 0;
  private readonly MAX_CONCURRENT = 3;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

  /**
   * Add a request to the queue
   */
  async enqueue<T>(
    fn: () => Promise<T>,
    options: {
      priority?: number;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const { priority = 0, maxRetries = this.MAX_RETRIES } = options;

    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        fn,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        priority,
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      logger.debug(`[RequestQueue] 📥 Request queued (${this.queue.length} waiting, ${this.activeRequests} active)`);

      // Try to process queue
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    // Check if we can process more requests
    while (this.activeRequests < this.MAX_CONCURRENT && this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      this.activeRequests++;
      logger.debug(`[RequestQueue] 🚀 Processing request (${this.activeRequests} active, ${this.queue.length} waiting)`);

      // Execute request
      this.executeRequest(request);
    }
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error: any) {
      // Check if we should retry
      if (request.retries < request.maxRetries && this.shouldRetry(error)) {
        request.retries++;
        const delay = this.RETRY_DELAYS[Math.min(request.retries - 1, this.RETRY_DELAYS.length - 1)];
        
        logger.debug(`[RequestQueue] 🔄 Retrying request (attempt ${request.retries}/${request.maxRetries}) after ${delay}ms`);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Re-queue with higher priority
        request.priority += 10;
        const insertIndex = this.queue.findIndex(r => r.priority < request.priority);
        if (insertIndex === -1) {
          this.queue.push(request);
        } else {
          this.queue.splice(insertIndex, 0, request);
        }
      } else {
        // Max retries reached or non-retryable error
        logger.debug(`[RequestQueue] ❌ Request failed after ${request.retries} retries`);
        request.reject(error);
      }
    } finally {
      this.activeRequests--;
      
      // Process next request in queue
      this.processQueue();
    }
  }

  /**
   * Determine if an error is retryable
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx errors
    if (error.message?.includes('timeout')) return true;
    if (error.message?.includes('network')) return true;
    if (error.message?.includes('fetch')) return true;
    if (error.statusCode && error.statusCode >= 500) return true;
    
    // Don't retry on 4xx errors (except 429 rate limit)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return error.statusCode === 429;
    }

    return true; // Default to retry
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    activeRequests: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.MAX_CONCURRENT,
    };
  }

  /**
   * Clear the queue (for testing or reset)
   */
  clear(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    logger.debug('[RequestQueue] 🧹 Queue cleared');
  }
}

export const requestQueueService = new RequestQueueService();
export default requestQueueService;
