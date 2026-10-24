import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { navigateShareDeepLink } from '../utils/navigateShareDeepLink';
import {
  setPendingDeepLink,
  consumePendingDeepLink,
  peekPendingDeepLink,
  subscribePendingDeepLink,
} from '../utils/pendingDeepLink';
import { useBootReady } from '../contexts/BootReadyContext';
import { logger } from '../services/logger';

function isAuthCallback(url: string): boolean {
  return /auth-callback/i.test(url);
}

/**
 * Owns share / QR / universal-link opens. Lives under BootReady + Clerk so it
 * can wait until navigation will stick, then route to the profile/reel/invite
 * — or to registration when the visitor has no account.
 */
export function DeepLinkHandler() {
  const { navigationReady } = useBootReady();
  const { isLoaded, isSignedIn } = useAuth();
  const [pendingUrl, setPendingUrl] = useState<string | null>(peekPendingDeepLink);
  const handledUrls = useRef(new Set<string>());

  useEffect(() => subscribePendingDeepLink(setPendingUrl), []);

  useEffect(() => {
    const park = (url: string | null) => {
      if (!url || isAuthCallback(url)) return;
      setPendingDeepLink(url);
      logger.debug('[DeepLink] Parked:', url);
    };

    Linking.getInitialURL()
      .then(park)
      .catch(() => undefined);

    const sub = Linking.addEventListener('url', (event) => {
      park(event.url);
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!navigationReady || !isLoaded || !pendingUrl) return;
    if (isAuthCallback(pendingUrl)) {
      consumePendingDeepLink();
      return;
    }
    if (handledUrls.current.has(pendingUrl)) {
      consumePendingDeepLink();
      return;
    }

    // Navigate while the URL is still "pending" so Index keeps holding splash,
    // then clear — otherwise Index Redirect races the profile open.
    const timer = requestAnimationFrame(() => {
      const pending = peekPendingDeepLink();
      if (!pending || isAuthCallback(pending)) {
        consumePendingDeepLink();
        return;
      }
      if (handledUrls.current.has(pending)) {
        consumePendingDeepLink();
        return;
      }
      handledUrls.current.add(pending);
      logger.debug('[DeepLink] Navigating:', pending, { isSignedIn: Boolean(isSignedIn) });
      navigateShareDeepLink(pending, Boolean(isSignedIn));
      // Clear on next tick after router.replace is scheduled.
      setTimeout(() => consumePendingDeepLink(), 0);
    });

    return () => cancelAnimationFrame(timer);
  }, [navigationReady, isLoaded, isSignedIn, pendingUrl]);

  return null;
}
