import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useBootReady } from '@/contexts/BootReadyContext';
import {
  appOpenScreenBlock,
  decideAppOpenEntry,
  cancelQueuedAppOpenAd,
  prepareAppOpenAd,
  presentAppOpenAd,
  type AppOpenShowContext,
} from '@/services/appOpenAd';
import { noteAdsAppBackground } from '@/services/fullscreenAdCoordinator';
import { logger } from '@/services/logger';

/**
 * Shows an app-open ad when a signed-in session enters the app.
 * The login interstitial owns the foreground created by sign-in, so this host
 * waits for a later cold start or a real return from background.
 */
export function AppOpenAdHost() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const { navigationReady } = useBootReady();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const awayAt = useRef<number | null>(null);
  const coldStartDecided = useRef(false);
  const wasSignedIn = useRef(false);

  if (isSignedIn) wasSignedIn.current = true;
  const loggingOut = wasSignedIn.current && isLoaded && !isSignedIn;

  const context = (entry: AppOpenShowContext['entry']): AppOpenShowContext => ({
    authLoaded: isLoaded,
    signedIn: Boolean(isSignedIn),
    loggingOut,
    pathname,
    entry,
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || loggingOut) {
      cancelQueuedAppOpenAd();
      return;
    }
    prepareAppOpenAd();
  }, [isLoaded, isSignedIn, loggingOut, pathname]);

  useEffect(() => {
    if (!isLoaded || !navigationReady || coldStartDecided.current) return;
    if (!isSignedIn) {
      // This launch opened on the signed-out flow. A later sign-in belongs to
      // the login interstitial, not to the cold-start app-open ad.
      coldStartDecided.current = true;
      return;
    }
    if (appOpenScreenBlock(pathname)) return;
    coldStartDecided.current = true;
    void presentAppOpenAd(context('cold_start'));
  }, [isLoaded, isSignedIn, navigationReady, pathname, loggingOut]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = appState.current;
      if ((next === 'background' || next === 'inactive') && previous === 'active') {
        awayAt.current = Date.now();
      }
      if (next === 'background') noteAdsAppBackground();
      appState.current = next;
      if (next !== 'active') return;

      const decision = decideAppOpenEntry({
        previous,
        next,
        awayMs: awayAt.current == null ? 0 : Date.now() - awayAt.current,
      });
      if ('skip' in decision) {
        if (decision.skip === 'quick_transition') {
          logger.info('APP_OPEN_AD_SKIPPED', { reason: decision.skip });
        }
        return;
      }
      void presentAppOpenAd(context(decision.entry));
    });

    return () => subscription.remove();
  }, [isLoaded, isSignedIn, loggingOut, pathname]);

  return null;
}
