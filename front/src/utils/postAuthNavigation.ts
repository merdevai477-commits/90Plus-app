import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Router } from 'expo-router';

export const AGE_VERIFIED_KEY = '@90plus_age_verified';

/** Route to Home when age is verified, otherwise mandatory age gate. */
export async function navigateAfterAuth(router: Router): Promise<void> {
  try {
    const verified = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
    if (verified === 'true') {
      router.replace('/(tabs)/Home');
      return;
    }
  } catch {
    // fall through to age gate
  }
  router.replace('/age-gate');
}

/** Call after successful age verification (ADULT or TEEN with consent pending). */
export async function markAgeVerified(): Promise<void> {
  await AsyncStorage.setItem(AGE_VERIFIED_KEY, 'true');
}
