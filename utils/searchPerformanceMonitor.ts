/**
 * Search Performance Monitor
 * Tracks search performance and identifies slow operations
 */

interface SearchMetrics {
  query: string;
  endpoint: string;
  responseTime: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

class SearchPerformanceMonitor {
  private metrics: SearchMetrics[] = [];
  private readonly MAX_METRICS = 100; // Keep last 100 searches

  /**
   * Record a search operation
   */
  recordSearch(
    query: string,
    endpoint: string,
    responseTime: number,
    success: boolean,
    error?: string
  ): void {
    const metric: SearchMetrics = {
      query,
      endpoint,
      responseTime,
      success,
      timestamp: Date.now(),
      error
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow searches
    if (responseTime > 5000) {
      console.warn(`🐌 Slow search detected: ${query} on ${endpoint} took ${responseTime}ms`);
    }

    // Log failed searches
    if (!success) {
      console.error(`❌ Search failed: ${query} on ${endpoint} - ${error}`);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    totalSearches: number;
    averageResponseTime: number;
    successRate: number;
    slowSearches: number;
    recentErrors: SearchMetrics[];
  } {
    if (this.metrics.length === 0) {
      return {
        totalSearches: 0,
        averageResponseTime: 0,
        successRate: 0,
        slowSearches: 0,
        recentErrors: []
      };
    }

    const totalSearches = this.metrics.length;
    const successfulSearches = this.metrics.filter(m => m.success).length;
    const averageResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalSearches;
    const slowSearches = this.metrics.filter(m => m.responseTime > 3000).length;
    const recentErrors = this.metrics
      .filter(m => !m.success)
      .slice(-5); // Last 5 errors

    return {
      totalSearches,
      averageResponseTime: Math.round(averageResponseTime),
      successRate: Math.round((successfulSearches / totalSearches) * 100),
      slowSearches,
      recentErrors
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get metrics for a specific endpoint
   */
  getEndpointStats(endpoint: string): SearchMetrics[] {
    return this.metrics.filter(m => m.endpoint === endpoint);
  }
}

// Export singleton instance
export const searchPerformanceMonitor = new SearchPerformanceMonitor();

/**
 * Decorator function to monitor search performance
 */
export function monitorSearchPerformance<T extends any[], R>(
  endpoint: string,
  searchFunction: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const query = args[1] as string || 'unknown'; // Assume query is second parameter
    const startTime = Date.now();
    
    try {
      const result = await searchFunction(...args);
      const responseTime = Date.now() - startTime;
      
      searchPerformanceMonitor.recordSearch(
        query,
        endpoint,
        responseTime,
        true
      );
      
      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      searchPerformanceMonitor.recordSearch(
        query,
        endpoint,
        responseTime,
        false,
        error.message
      );
      
      throw error;
    }
  };
}