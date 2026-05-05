/**
 * useAutoRefresh Hook
 * Automatically refreshes data when:
 * - Screen comes into focus
 * - App returns from background
 * - After a certain time interval
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

interface UseAutoRefreshOptions {
  /** Function to call for refresh */
  onRefresh: () => void | Promise<void>;
  /** Refresh when screen gains focus (default: true) */
  refreshOnFocus?: boolean;
  /** Refresh when app returns from background (default: true) */
  refreshOnAppFocus?: boolean;
  /** Minimum time between refreshes in ms (default: 30000 = 30s) */
  minRefreshInterval?: number;
  /** Auto refresh interval in ms (default: 0 = disabled) */
  autoRefreshInterval?: number;
  /** Only refresh if data is stale (older than this in ms) */
  staleTime?: number;
}

export function useAutoRefresh(options: UseAutoRefreshOptions) {
  const {
    onRefresh,
    refreshOnFocus = true,
    refreshOnAppFocus = true,
    minRefreshInterval = 30000, // 30 seconds
    autoRefreshInterval = 0, // disabled by default
    staleTime = 60000, // 1 minute
  } = options;

  const lastRefreshRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if we should refresh based on time
  const shouldRefresh = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;
    return timeSinceLastRefresh >= minRefreshInterval;
  }, [minRefreshInterval]);

  // Perform refresh with throttling
  const performRefresh = useCallback(async () => {
    if (!shouldRefresh()) {
      return;
    }

    lastRefreshRef.current = Date.now();
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('[useAutoRefresh] Refresh failed:', error);
    }
  }, [onRefresh, shouldRefresh]);

  // Handle screen focus
  useFocusEffect(
    useCallback(() => {
      if (refreshOnFocus) {
        performRefresh();
      }

      return () => {
        // Cleanup if needed
      };
    }, [refreshOnFocus, performRefresh])
  );

  // Handle app state changes (background/foreground)
  useEffect(() => {
    if (!refreshOnAppFocus) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        performRefresh();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refreshOnAppFocus, performRefresh]);

  // Auto refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      performRefresh();
    }, autoRefreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefreshInterval, performRefresh]);

  // Manual refresh function (bypasses throttle)
  const forceRefresh = useCallback(async () => {
    lastRefreshRef.current = Date.now();
    await onRefresh();
  }, [onRefresh]);

  // Check if data is stale
  const isStale = useCallback(() => {
    const now = Date.now();
    return now - lastRefreshRef.current >= staleTime;
  }, [staleTime]);

  return {
    refresh: performRefresh,
    forceRefresh,
    isStale,
    lastRefresh: lastRefreshRef.current,
  };
}

/**
 * Simple hook for refreshing on screen focus only
 */
export function useRefreshOnFocus(onRefresh: () => void | Promise<void>) {
  const isFirstRender = useRef(true);

  useFocusEffect(
    useCallback(() => {
      // Skip first render (initial mount)
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }

      onRefresh();
    }, [onRefresh])
  );
}

/**
 * Hook for refreshing when app returns from background
 */
export function useRefreshOnAppFocus(onRefresh: () => void | Promise<void>) {
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        onRefresh();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [onRefresh]);
}

export default useAutoRefresh;
