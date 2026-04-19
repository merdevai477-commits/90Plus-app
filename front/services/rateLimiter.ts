/**
 * Rate Limiter Service
 * Prevents exceeding API rate limits
 */

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class RateLimiter {
  private queue: QueueItem[] = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();
  
  // API-Football Free Plan: 10 requests per minute
  private readonly MAX_REQUESTS = 10;
  private readonly WINDOW_MS = 60 * 1000; // 1 minute
  private readonly MIN_DELAY = 6000; // 6 seconds between requests (10 per minute)

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we need to reset the window
      const now = Date.now();
      if (now - this.windowStart >= this.WINDOW_MS) {
        this.requestCount = 0;
        this.windowStart = now;
      }

      // Check if we've hit the rate limit
      if (this.requestCount >= this.MAX_REQUESTS) {
        const waitTime = this.WINDOW_MS - (now - this.windowStart);
        console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.windowStart = Date.now();
      }

      const item = this.queue.shift();
      if (!item) break;

      try {
        const result = await item.fn();
        item.resolve(result);
        this.requestCount++;
        
        // Wait minimum delay between requests
        if (this.queue.length > 0) {
          await this.sleep(this.MIN_DELAY);
        }
      } catch (error) {
        item.reject(error);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      requestCount: this.requestCount,
      queueLength: this.queue.length,
      timeUntilReset: Math.max(0, this.WINDOW_MS - (Date.now() - this.windowStart)),
    };
  }
}

export const rateLimiter = new RateLimiter();
export default rateLimiter;
