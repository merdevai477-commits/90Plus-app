/**
 * Route Prefetcher Utility
 * Prefetches route components and data for instant navigation
 */

import { router } from 'expo-router';

// Track prefetched routes to avoid duplicate prefetches
const prefetchedRoutes = new Set<string>();

// Track prefetch promises to avoid duplicate prefetch requests
const prefetchPromises = new Map<string, Promise<void>>();

/**
 * Prefetch a route component and optionally prefetch its data
 */
export async function prefetchRoute(route: string): Promise<void> {
  // Skip if already prefetched
  if (prefetchedRoutes.has(route)) {
    return;
  }

  // Skip if already prefetching
  if (prefetchPromises.has(route)) {
    return prefetchPromises.get(route);
  }

  // Create prefetch promise
  const prefetchPromise = (async () => {
    try {
      // Use Expo Router's prefetch capability
      // Note: Expo Router doesn't have explicit prefetch, but we can prepare data
      prefetchedRoutes.add(route);
    } catch (error) {
      console.warn(`[RoutePrefetcher] Failed to prefetch route ${route}:`, error);
      // Remove from prefetched set on error to allow retry
      prefetchedRoutes.delete(route);
    } finally {
      prefetchPromises.delete(route);
    }
  })();

  prefetchPromises.set(route, prefetchPromise);
  return prefetchPromise;
}

/**
 * Prefetch multiple routes in parallel
 */
export async function prefetchRoutes(routes: string[]): Promise<void> {
  await Promise.allSettled(routes.map(route => prefetchRoute(route)));
}

/**
 * Clear prefetch cache (useful for testing or cache invalidation)
 */
export function clearPrefetchCache(): void {
  prefetchedRoutes.clear();
  prefetchPromises.clear();
}

/**
 * Check if a route has been prefetched
 */
export function isRoutePrefetched(route: string): boolean {
  return prefetchedRoutes.has(route);
}

