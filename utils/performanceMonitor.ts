/**
 * Performance monitoring utilities for FlashList and app performance
 * Tracks metrics like blank area, render times, memory usage
 */

interface PerformanceMetrics {
  blankArea: number;
  renderTime: number;
  memoryUsage?: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private readonly MAX_METRICS_PER_COMPONENT = 100;

  /**
   * Track FlashList blank area
   * Blank area should be < 5% for optimal performance
   */
  trackBlankArea(componentName: string, blankArea: number): void {
    if (!__DEV__) return;

    const metrics = this.getMetrics(componentName);
    metrics.push({
      blankArea,
      renderTime: 0,
      timestamp: Date.now(),
    });

    // Warn if blank area is too high
    if (blankArea > 50) {
      console.warn(
        `[Performance] ${componentName}: High blank area detected (${blankArea}px). ` +
        `Consider adjusting estimatedItemSize or optimizing renderItem.`
      );
    }

    this.trimMetrics(componentName);
  }

  /**
   * Track component render time
   * Warns if render time exceeds 16ms (60fps threshold)
   */
  trackRenderTime(componentName: string, renderTime: number): void {
    if (!__DEV__) return;

    const metrics = this.getMetrics(componentName);
    metrics.push({
      blankArea: 0,
      renderTime,
      timestamp: Date.now(),
    });

    // Warn if render is slow
    if (renderTime > 16) {
      console.warn(
        `[Performance] ${componentName}: Slow render detected (${renderTime.toFixed(2)}ms). ` +
        `Target: <16ms for 60fps.`
      );
    }

    this.trimMetrics(componentName);
  }

  /**
   * Track memory usage (if available)
   */
  trackMemoryUsage(componentName: string): void {
    if (!__DEV__) return;

    const memory = (performance as any).memory;
    if (!memory) return;

    const metrics = this.getMetrics(componentName);
    const usedMB = memory.usedJSHeapSize / 1048576;

    metrics.push({
      blankArea: 0,
      renderTime: 0,
      memoryUsage: usedMB,
      timestamp: Date.now(),
    });

    // Warn if memory usage is high
    const limitMB = memory.jsHeapSizeLimit / 1048576;
    const usagePercent = (usedMB / limitMB) * 100;

    if (usagePercent > 80) {
      console.warn(
        `[Performance] ${componentName}: High memory usage (${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB = ${usagePercent.toFixed(1)}%)`
      );
    }

    this.trimMetrics(componentName);
  }

  /**
   * Get average metrics for a component
   */
  getAverageMetrics(componentName: string): {
    avgBlankArea: number;
    avgRenderTime: number;
    avgMemoryUsage: number;
  } {
    const metrics = this.getMetrics(componentName);

    if (metrics.length === 0) {
      return { avgBlankArea: 0, avgRenderTime: 0, avgMemoryUsage: 0 };
    }

    const sum = metrics.reduce(
      (acc, metric) => ({
        blankArea: acc.blankArea + metric.blankArea,
        renderTime: acc.renderTime + metric.renderTime,
        memoryUsage: acc.memoryUsage + (metric.memoryUsage || 0),
      }),
      { blankArea: 0, renderTime: 0, memoryUsage: 0 }
    );

    return {
      avgBlankArea: sum.blankArea / metrics.length,
      avgRenderTime: sum.renderTime / metrics.length,
      avgMemoryUsage: sum.memoryUsage / metrics.length,
    };
  }

  /**
   * Log performance report for a component
   */
  logReport(componentName: string): void {
    if (!__DEV__) return;

    const metrics = this.getMetrics(componentName);
    if (metrics.length === 0) {
      console.log(`[Performance] No metrics recorded for ${componentName}`);
      return;
    }

    const avg = this.getAverageMetrics(componentName);

    console.log(`[Performance Report] ${componentName}:`, {
      samples: metrics.length,
      avgBlankArea: `${avg.avgBlankArea.toFixed(2)}px`,
      avgRenderTime: `${avg.avgRenderTime.toFixed(2)}ms`,
      avgMemoryUsage: avg.avgMemoryUsage > 0 ? `${avg.avgMemoryUsage.toFixed(2)}MB` : 'N/A',
      status: this.getPerformanceStatus(avg),
    });
  }

  /**
   * Clear metrics for a component
   */
  clearMetrics(componentName: string): void {
    this.metrics.delete(componentName);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
  }

  // Private methods

  private getMetrics(componentName: string): PerformanceMetrics[] {
    if (!this.metrics.has(componentName)) {
      this.metrics.set(componentName, []);
    }
    return this.metrics.get(componentName)!;
  }

  private trimMetrics(componentName: string): void {
    const metrics = this.getMetrics(componentName);
    if (metrics.length > this.MAX_METRICS_PER_COMPONENT) {
      metrics.shift(); // Remove oldest metric
    }
  }

  private getPerformanceStatus(avg: {
    avgBlankArea: number;
    avgRenderTime: number;
  }): string {
    if (avg.avgBlankArea > 50 || avg.avgRenderTime > 16) {
      return '❌ Poor';
    } else if (avg.avgBlankArea > 20 || avg.avgRenderTime > 10) {
      return '⚠️ Fair';
    } else {
      return '✅ Good';
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook to track component performance
 */
export const usePerformanceTracking = (componentName: string): (() => void) => {
  if (!__DEV__) return () => {};

  const startTime = performance.now();

  // Track render time on unmount
  return () => {
    const renderTime = performance.now() - startTime;
    performanceMonitor.trackRenderTime(componentName, renderTime);
  };
};

/**
 * Measure function execution time
 */
export const measureExecutionTime = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();

  try {
    const result = await fn();
    const executionTime = performance.now() - startTime;

    if (__DEV__) {
      console.log(`[Performance] ${name} took ${executionTime.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const executionTime = performance.now() - startTime;

    if (__DEV__) {
      console.error(`[Performance] ${name} failed after ${executionTime.toFixed(2)}ms`, error);
    }

    throw error;
  }
};

/**
 * Log app startup performance
 */
export const logStartupPerformance = (): void => {
  if (!__DEV__) return;

  const timing = performance.timing;
  if (!timing) return;

  const loadTime = timing.loadEventEnd - timing.navigationStart;
  const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
  const renderTime = timing.domComplete - timing.domLoading;

  console.log('[Performance] App Startup:', {
    totalLoadTime: `${loadTime}ms`,
    domReadyTime: `${domReadyTime}ms`,
    renderTime: `${renderTime}ms`,
  });
};

export default performanceMonitor;
