import { useRef, useCallback, useMemo, useEffect, useState } from 'react';

/**
 * Deep comparison utility for React.memo
 * Compares specified keys deeply, rest shallowly
 */
export const arePropsEqual = <T extends Record<string, unknown>>(
  prevProps: T,
  nextProps: T,
  keysToCompare?: (keyof T)[]
): boolean => {
  // If no specific keys provided, do shallow comparison
  if (!keysToCompare || keysToCompare.length === 0) {
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);

    if (prevKeys.length !== nextKeys.length) return false;

    return prevKeys.every((key) => prevProps[key] === nextProps[key]);
  }

  // Deep comparison for specified keys
  for (const key of keysToCompare) {
    if (!deepEqual(prevProps[key], nextProps[key])) {
      return false;
    }
  }

  // Shallow comparison for remaining keys
  const remainingKeys = Object.keys(prevProps).filter(
    (key) => !keysToCompare.includes(key as keyof T)
  );

  return remainingKeys.every((key) => prevProps[key] === nextProps[key]);
};

/**
 * Deep equality check for objects and arrays
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a == null || b == null) return a === b;

  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => {
    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];
    return deepEqual(valA, valB);
  });
}

/**
 * Debug hook to track component re-renders in development
 * Logs render count and helps identify problematic components
 */
export const useRenderCount = (componentName: string): void => {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;

    if (__DEV__) {
      console.log(`[Performance] ${componentName} rendered ${renderCount.current} times`);
    }
  });
};

/**
 * Hook that ensures callback references are stable while always having latest closure
 * Better than useCallback for callbacks that need to access latest state/props
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T
): T => {
  const callbackRef = useRef<T>(callback);

  // Update ref with latest callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Return stable callback that calls the latest version
  return useCallback(
    ((...args: any[]) => {
      return callbackRef.current(...args);
    }) as T,
    []
  );
};

/**
 * Performance monitoring utility
 * Tracks render times and provides warnings for slow renders
 */
export const usePerformanceMonitor = (
  componentName: string,
  threshold: number = 16 // 16ms = 60fps
): void => {
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();

    return () => {
      const renderTime = performance.now() - startTime.current;

      if (__DEV__ && renderTime > threshold) {
        console.warn(
          `[Performance Warning] ${componentName} took ${renderTime.toFixed(2)}ms to render (threshold: ${threshold}ms)`
        );
      }
    };
  });
};

/**
 * Debounce hook for expensive operations
 * Returns debounced value that updates after specified delay
 */
export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Throttle hook for limiting function calls
 * Ensures function is called at most once per specified interval
 */
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T => {
  const lastRun = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();

      if (now - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRun.current = Date.now();
        }, delay - (now - lastRun.current));
      }
    }) as T,
    [callback, delay]
  );
};

/**
 * Memory usage monitor (development only)
 * Logs memory usage for component
 */
export const useMemoryMonitor = (componentName: string): void => {
  useEffect(() => {
    if (__DEV__ && (performance as any).memory) {
      const memory = (performance as any).memory;
      console.log(`[Memory] ${componentName}:`, {
        usedJSHeapSize: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
        totalJSHeapSize: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
      });
    }
  });
};

/**
 * Memoize style objects to prevent unnecessary re-renders
 */
export const useMemoizedStyles = <T extends Record<string, any>>(
  styleFactory: () => T,
  deps: any[]
): T => {
  return useMemo(styleFactory, deps);
};
