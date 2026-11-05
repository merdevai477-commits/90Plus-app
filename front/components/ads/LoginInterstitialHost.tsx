import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useBootReady } from '@/contexts/BootReadyContext';
import {
  cancelPendingLoginInterstitial,
  isPostAuthDestination,
  presentPendingLoginInterstitial,
} from '@/services/loginInterstitialAd';

/**
 * Shows the login interstitial only after a successful sign-in has navigated
 * away from the auth stack. Renders nothing. Failures never block navigation.
 */
export function LoginInterstitialHost() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const { navigationReady } = useBootReady();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      cancelPendingLoginInterstitial();
      return;
    }

    if (!navigationReady || !isPostAuthDestination(pathname)) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      void presentPendingLoginInterstitial();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [isLoaded, isSignedIn, navigationReady, pathname]);

  return null;
}
