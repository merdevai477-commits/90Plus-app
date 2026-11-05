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
 * Shows the login interstitial only after a successful sign-in has navigated
 * away from the auth stack. The ad loads while the auth screen is open, so it
 * can appear as soon as sign-in finishes. Renders nothing. Failures never block navigation.
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
