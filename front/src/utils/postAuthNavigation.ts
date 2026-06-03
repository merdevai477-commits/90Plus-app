import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';
import { fetchAgeStatus } from '../../hooks/useAgeVerification';

export const AGE_VERIFIED_KEY = '@90plus_age_verified';

type GetToken = () => Promise<string | null>;

async function routeFromAgeStatus(
  router: Router,
  status: Awaited<ReturnType<typeof fetchAgeStatus>>,
): Promise<void> {
  if (!status.ok || !status.ageVerified) {
    router.replace('/(tabs)/Home');
    return;
  }

  await markAgeVerified();

  if (
    status.ageTier === 'TEEN' &&
    status.parentalConsent !== true
  ) {
    router.replace('/parental-consent');
    return;
  }

  router.replace('/(tabs)/Home');
}

/** Route to Home (or parental consent if still pending for legacy teen accounts). */
export async function navigateAfterAuth(
  router: Router,
  getToken?: GetToken,
): Promise<void> {
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        const status = await fetchAgeStatus(token);
        await routeFromAgeStatus(router, status);
        return;
      }
    } catch {
      // fall through
    }
  }

  try {
    const verified = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
    if (verified === 'true') {
      router.replace('/(tabs)/Home');
      return;
    }
  } catch {
    // fall through
  }

  router.replace('/(tabs)/Home');
}

/** Call after successful age verification (ADULT or TEEN with consent pending). */
export async function markAgeVerified(): Promise<void> {
  await AsyncStorage.setItem(AGE_VERIFIED_KEY, 'true');
}
