/**
 * Navigation Tracking Hook
 * 
 * Tracks screen navigation events and sends breadcrumbs to Sentry
 * 
 * Requirements: 6.2 - Capture breadcrumbs for navigation events
 */

import { useEffect, useRef } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { addBreadcrumb } from '../services/sentry.service';
import { logger } from '../services/logger';

/**
 * Hook to track navigation changes and send breadcrumbs to Sentry
 * 
 * Usage:
 * ```tsx
 * // In your root layout or navigation component
 * useNavigationTracking();
 * ```
 */
export function useNavigationTracking() {
  const pathname = usePathname();
  const segments = useSegments();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    // Skip initial mount
    if (previousPathname.current === null) {
      previousPathname.current = pathname;
      return;
    }

    // Skip if pathname hasn't changed
    if (previousPathname.current === pathname) {
      return;
    }

    // Get screen name from pathname
    const screenName = getScreenName(pathname, segments);

    // Log navigation
    logger.debug(`[Navigation] Navigated to: ${screenName} (${pathname})`);

    // Add breadcrumb to Sentry
    try {
      addBreadcrumb(
        `Navigated to ${screenName}`,
        'navigation',
        'info',
        {
          from: previousPathname.current,
          to: pathname,
          screen: screenName,
          segments: segments.join('/'),
        }
      );
    } catch (error) {
      // Silently fail - don't break navigation if Sentry fails
      logger.warn('[Navigation] Failed to add breadcrumb:', error);
    }

    // Update previous pathname
    previousPathname.current = pathname;
  }, [pathname, segments]);
}

/**
 * Extract a human-readable screen name from pathname and segments
 */
function getScreenName(pathname: string, segments: readonly string[]): string {
  // Handle root
  if (pathname === '/') {
    return 'Home';
  }

  // Handle tabs
  if (segments.includes('(tabs)')) {
    const tabIndex = segments.indexOf('(tabs)');
    const tabName = segments[tabIndex + 1];
    if (tabName) {
      return formatScreenName(tabName);
    }
  }

  // Handle auth screens
  if (segments.includes('auth')) {
    return 'Authentication';
  }

  // Handle user profile
  if (segments.includes('user')) {
    return 'User Profile';
  }

  // Handle player profile
  if (pathname.includes('player-profile')) {
    return 'Player Profile';
  }

  // Handle team profile
  if (pathname.includes('team-profile')) {
    return 'Team Profile';
  }

  // Handle onboarding
  if (pathname.includes('onboarding')) {
    return 'Onboarding';
  }

  // Handle modal
  if (pathname.includes('modal')) {
    return 'Modal';
  }

  // Handle not found
  if (pathname.includes('not-found')) {
    return 'Not Found';
  }

  // Default: use last segment or pathname
  const lastSegment = segments[segments.length - 1];
  if (lastSegment) {
    return formatScreenName(lastSegment);
  }

  return formatScreenName(pathname.replace('/', ''));
}

/**
 * Format screen name for display
 */
function formatScreenName(name: string): string {
  // Remove special characters and format
  return name
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
    .join(' ');
}
