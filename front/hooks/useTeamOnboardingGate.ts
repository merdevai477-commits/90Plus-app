import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { AuthService } from '../src/services/authService';
import { needsTeamOnboarding } from '../utils/teamOnboarding';
import { logger } from '../services/logger';

/**
 * Existing users who never finished teams onboarding land on Matches after
 * update — send them through /onboarding once. Fail open if /me errors.
 */
export function useTeamOnboardingGate(): void {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || attemptedRef.current) return;
    attemptedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const user = await AuthService.syncUserWithBackend(token);
        if (cancelled) return;
        if (needsTeamOnboarding(user)) {
          router.replace('/onboarding');
        }
      } catch (err) {
        logger.warn('[team-onboarding-gate] skipped', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, router]);
}
