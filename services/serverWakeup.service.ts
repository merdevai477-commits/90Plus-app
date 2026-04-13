/**
 * Server Wakeup Service
 * Handles Railway cold start problem by:
 * 1. Pinging server on app start to wake it up
 * 2. Queuing requests while server is waking
 * 3. Implementing circuit breaker pattern
 * 
 * Issue #4: Railway Cold Start Problem
 */

import { getApiUrl } from '../config/api.config';
import { logger } from './logger';

interface QueuedRequest {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  fn: () => Promise<any>;
  timestamp: number;
}

class ServerWakeupService {
  private isWakingUp = false;
  private isAwake = false;
  private requestQueue: QueuedRequest[] = [];
  private wakeupPromise: Promise<boolean> | null = null;
  private lastWakeupAttempt = 0;
  private readonly WAKEUP_COOLDOWN = 30000; // 30 seconds between wakeup attempts
  private readonly QUEUE_TIMEOUT = 15000; // 15 seconds max wait in queue
  private readonly WAKEUP_TIMEOUT = 8000; // Fix 4: reduced from 20s to 8s

  /**
   * Check if server is awake, wake it up if needed
   */
  async ensureServerAwake(): Promise<boolean> {
    // If already awake, return immediately
    if (this.isAwake) {
      return true;
    }

    // If currently waking up, wait for that to complete
    if (this.isWakingUp && this.wakeupPromise) {
      return this.wakeupPromise;
    }

    // Check cooldown - don't spam wakeup attempts
    const now = Date.now();
    if (now - this.lastWakeupAttempt < this.WAKEUP_COOLDOWN) {
      logger.debug('[ServerWakeup] In cooldown period, skipping wakeup');
      return false;
    }

    // Start wakeup process
    this.lastWakeupAttempt = now;
    this.isWakingUp = true;
    
    this.wakeupPromise = this.wakeupServer();
    const result = await this.wakeupPromise;
    
    this.isWakingUp = false;
    this.wakeupPromise = null;
    
    return result;
  }

  /**
   * Wake up the server with a health check ping
   */
  private async wakeupServer(): Promise<boolean> {
    const apiUrl = getApiUrl();
    logger.debug('[ServerWakeup] 🔄 Waking up server...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.WAKEUP_TIMEOUT);

      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.isAwake = true;
        logger.debug('[ServerWakeup] ✅ Server is awake');
        
        // Process queued requests
        this.processQueue();
        
        return true;
      }

      logger.warn('[ServerWakeup] ⚠️ Server responded but not healthy');
      return false;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn('[ServerWakeup] ⏱️ Wakeup timeout - server still sleeping');
      } else {
        logger.warn('[ServerWakeup] ❌ Wakeup failed:', error.message);
      }
      return false;
    }
  }

  /**
   * Queue a request to be executed when server is awake
   */
  async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    // If server is awake, execute immediately
    if (this.isAwake) {
      return fn();
    }

    // Create queued request
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        resolve,
        reject,
        fn,
        timestamp: Date.now(),
      };

      this.requestQueue.push(queuedRequest);
      logger.debug(`[ServerWakeup] 📥 Request queued (${this.requestQueue.length} in queue)`);

      // Set timeout for this request
      setTimeout(() => {
        const index = this.requestQueue.indexOf(queuedRequest);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Request timeout while waiting for server to wake up'));
        }
      }, this.QUEUE_TIMEOUT);

      // Try to wake up server if not already trying
      if (!this.isWakingUp) {
        this.ensureServerAwake().catch(err => {
          logger.error('[ServerWakeup] Failed to wake server:', err);
        });
      }
    });
  }

  /**
   * Process all queued requests
   */
  private async processQueue(): Promise<void> {
    logger.debug(`[ServerWakeup] 📤 Processing ${this.requestQueue.length} queued requests`);

    const queue = [...this.requestQueue];
    this.requestQueue = [];

    for (const request of queue) {
      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
  }

  /**
   * Mark server as asleep (call this when detecting server is down)
   */
  markAsleep(): void {
    if (this.isAwake) {
      logger.debug('[ServerWakeup] 💤 Server marked as asleep');
      this.isAwake = false;
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    isAwake: boolean;
    isWakingUp: boolean;
    queueLength: number;
  } {
    return {
      isAwake: this.isAwake,
      isWakingUp: this.isWakingUp,
      queueLength: this.requestQueue.length,
    };
  }

  /**
   * Reset service (for testing or manual reset)
   */
  reset(): void {
    this.isAwake = false;
    this.isWakingUp = false;
    this.requestQueue = [];
    this.wakeupPromise = null;
    this.lastWakeupAttempt = 0;
  }
}

export const serverWakeupService = new ServerWakeupService();
export default serverWakeupService;
