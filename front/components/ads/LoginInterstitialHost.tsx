import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useBootReady } from '@/contexts/BootReadyContext';
import {
  cancelPendingLoginInterstitial,
  isPostAuthDestination,
  preloadLoginInterstitial,
  presentPendingLoginInterstitial,
} from '@/services/loginInterstitialAd';

/**
 * Presents a login interstitial that was armed during sign-in, once the user
 * is past auth and onboarding. Returning sign-in starts the ad immediately
 * from navigateAfterAuth. Renders nothing.
 */
export function LoginInterstitialHost() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const { navigationReady } = useBootReady();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      cancelPendingLoginInterstitial();
      preloadLoginInterstitial();
      return;
    }

    if (!navigationReady || !isPostAuthDestination(pathname)) return;

    void presentPendingLoginInterstitial();
  }, [isLoaded, isSignedIn, navigationReady, pathname]);

  return null;
}
