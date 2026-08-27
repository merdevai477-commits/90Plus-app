import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import { fetchAgeStatus } from '../../hooks/useAgeVerification';
import { AuthService } from '@/src/services/authService';
import { waitForClerkToken } from './authSession';

export const AGE_VERIFIED_KEY = '@90plus_age_verified';

type GetToken = () => Promise<string | null>;

async function routeFromAgeStatus(
  router: Router,
  status: Awaited<ReturnType<typeof fetchAgeStatus>>,
): Promise<void> {
  if (!status.ok || !status.ageVerified) {
    router.replace('/(tabs)/matches');
    return;
  }

  await markAgeVerified();

  if (status.ageTier === 'TEEN' && status.parentalConsent !== true) {
    router.replace('/parental-consent');
    return;
  }

  router.replace('/(tabs)/matches');
}

/** Route to matches after sign-in — waits for JWT + backend user sync when possible. */
export async function navigateAfterAuth(
  router: Router,
  getToken?: GetToken,
): Promise<void> {
  if (getToken) {
    const token = await waitForClerkToken(getToken);
    if (token) {
      // Sync the backend user, retrying once on a flaky network before warning.
      // The Clerk webhook also provisions the user server-side, so even a total
      // client-sync failure self-heals on the next matches focus — we only alert to
      // explain a transient hiccup, never block entry.
      try {
        await AuthService.syncUserWithBackend(token);
      } catch {
        try {
          await new Promise((r) => setTimeout(r, 1200));
          await AuthService.syncUserWithBackend(token);
        } catch {
          Alert.alert(
            'Connection issue',
            'Signed in, but we could not sync your profile. Pull to refresh or try again.',
          );
        }
      }

      try {
        const status = await fetchAgeStatus(token);
        await routeFromAgeStatus(router, status);
        return;
      } catch {
        // fall through to local age flag
      }
    }
  }

  try {
    const verified = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
    if (verified === 'true') {
      router.replace('/(tabs)/matches');
      return;
    }
  } catch {
    // fall through
  }

  router.replace('/(tabs)/matches');
}

/** Call after successful age verification (ADULT or TEEN with consent pending). */
export async function markAgeVerified(): Promise<void> {
  await AsyncStorage.setItem(AGE_VERIFIED_KEY, 'true');
}
