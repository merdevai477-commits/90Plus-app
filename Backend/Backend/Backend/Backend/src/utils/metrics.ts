/**
 * Performance Metrics Tracking
 * 
 * Tracks response times, error rates, cache performance, and API usage
 * to establish baseline and measure optimization impact.
 */

import { logger } from './logger';

export interface EndpointMetrics {
  endpoint: string;
  method: string;
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  errorCount: number;
  rateLimitCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface RequestMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  cacheHit: boolean;
  timestamp: number;
}

class MetricsCollector {
  private metrics = new Map<string, EndpointMetrics>();
  private requestHistory: RequestMetrics[] = [];
  private readonly MAX_HISTORY = 10000; // Keep last 10k requests

  /**
   * Record a request metric
   */
  recordRequest(metrics: RequestMetrics): void {
    const key = `${metrics.method}:${metrics.endpoint}`;
    
    // Add to history (with size limit)
    this.requestHistory.push(metrics);
    if (this.requestHistory.length > this.MAX_HISTORY) {
      this.requestHistory.shift();
    }

    // Update aggregated metrics
    const existing = this.metrics.get(key) || {
      endpoint: metrics.endpoint,
      method: metrics.method,
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errorCount: 0,
      rateLimitCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    existing.count++;
    existing.totalTime += metrics.responseTime;
    existing.minTime = Math.min(existing.minTime, metrics.responseTime);
    existing.maxTime = Math.max(existing.maxTime, metrics.responseTime);

    if (metrics.statusCode >= 400) {
      existing.errorCount++;
    }

    if (metrics.statusCode === 429) {
      existing.rateLimitCount++;
    }

    if (metrics.cacheHit) {
      existing.cacheHits++;
    } else {
      existing.cacheMisses++;
    }

    this.metrics.set(key, existing);
  }

  /**
   * Calculate percentiles for an endpoint
   */
  calculatePercentiles(endpoint: string, method: string): { p50: number; p95: number; p99: number } {
    const key = `${method}:${endpoint}`;
    const times = this.requestHistory
      .filter(m => m.endpoint === endpoint && m.method === method)
      .map(m => m.responseTime)
      .sort((a, b) => a - b);

    if (times.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const p50 = times[Math.floor(times.length * 0.5)] || 0;
    const p95 = times[Math.floor(times.length * 0.95)] || 0;
    const p99 = times[Math.floor(times.length * 0.99)] || 0;

    return { p50, p95, p99 };
  }

  /**
   * Get metrics for a specific endpoint
   */
  getEndpointMetrics(endpoint: string, method: string): EndpointMetrics | null {
    const key = `${method}:${endpoint}`;
    const metrics = this.metrics.get(key);
    
    if (!metrics) {
      return null;
    }

    // Calculate percentiles
    const percentiles = this.calculatePercentiles(endpoint, method);
    metrics.p50 = percentiles.p50;
    metrics.p95 = percentiles.p95;
    metrics.p99 = percentiles.p99;

    return metrics;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): EndpointMetrics[] {
    const allMetrics: EndpointMetrics[] = [];
    
    for (const [key, metrics] of this.metrics.entries()) {
      const percentiles = this.calculatePercentiles(metrics.endpoint, metrics.method);
      allMetrics.push({
        ...metrics,
        p50: percentiles.p50,
        p95: percentiles.p95,
        p99: percentiles.p99,
      });
    }

    return allMetrics;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRequests: number;
    totalErrors: number;
    totalRateLimits: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    averageResponseTime: number;
    endpoints: number;
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalRateLimits = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;
    let totalTime = 0;

    for (const metrics of this.metrics.values()) {
      totalRequests += metrics.count;
      totalErrors += metrics.errorCount;
      totalRateLimits += metrics.rateLimitCount;
      totalCacheHits += metrics.cacheHits;
      totalCacheMisses += metrics.cacheMisses;
      totalTime += metrics.totalTime;
    }

    return {
      totalRequests,
      totalErrors,
      totalRateLimits,
      totalCacheHits,
      totalCacheMisses,
      averageResponseTime: totalRequests > 0 ? totalTime / totalRequests : 0,
      endpoints: this.metrics.size,
    };
  }

  /**
   * Reset all metrics (useful for testing or periodic resets)
   */
  reset(): void {
    this.metrics.clear();
    this.requestHistory = [];
  }

  /**
   * Log metrics summary (for periodic reporting)
   */
  logSummary(): void {
    const summary = this.getSummary();
    const rateLimitRate = summary.totalRequests > 0 
      ? (summary.totalRateLimits / summary.totalRequests * 100).toFixed(2)
      : '0.00';
    const cacheHitRate = (summary.totalCacheHits + summary.totalCacheMisses) > 0
      ? (summary.totalCacheHits / (summary.totalCacheHits + summary.totalCacheMisses) * 100).toFixed(2)
      : '0.00';

    logger.info('📊 Metrics Summary:', {
      totalRequests: summary.totalRequests,
      totalErrors: summary.totalErrors,
      rateLimitRate: `${rateLimitRate}%`,
      cacheHitRate: `${cacheHitRate}%`,
      averageResponseTime: `${summary.averageResponseTime.toFixed(2)}ms`,
      endpoints: summary.endpoints,
    });
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Log summary every 5 minutes
setInterval(() => {
  metricsCollector.logSummary();
}, 5 * 60 * 1000);

