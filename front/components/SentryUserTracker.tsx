/**
 * Sentry User Tracker Component
 * 
 * Monitors authentication state and updates Sentry user context
 * 
 * Requirements: 1.13, 1.14
 * - Sets user context on login/signup (user ID, username, email)
 * - Clears user context on logout
 */

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { setUser, clearUser } from '../services/sentry.service';
import { logger } from '../services/logger';

export function SentryUserTracker() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Wait for auth to load
    if (!isLoaded) return;

    // User is signed in - set Sentry user context
    if (isSignedIn && user) {
      try {
        setUser({
          id: user.id,
          username: user.username || undefined,
          email: user.primaryEmailAddress?.emailAddress || undefined,
        });
        
        logger.debug('[SentryUserTracker] User context set', {
          userId: user.id,
          username: user.username,
        });
      } catch (error) {
        logger.warn('[SentryUserTracker] Failed to set user context:', error);
      }
    } 
    // User is signed out - clear Sentry user context
    else if (!isSignedIn) {
      try {
        clearUser();
        logger.debug('[SentryUserTracker] User context cleared');
      } catch (error) {
        logger.warn('[SentryUserTracker] Failed to clear user context:', error);
      }
    }
  }, [isSignedIn, isLoaded, user?.id, user?.username, user?.primaryEmailAddress?.emailAddress]);

  // This component doesn't render anything
  return null;
}
