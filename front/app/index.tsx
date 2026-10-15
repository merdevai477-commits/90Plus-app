import { Redirect, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { BootSplashScreen } from '../components/splash/BootSplashScreen';
import { globalState } from '../globalState';
import { logger } from '../services/logger';
import {
  parseProfileUsernameFromUrl,
  parseReelIdFromUrl,
  parseReferralCodeFromUrl,
} from '../constants/shareLinks';
import {
  hasPendingDeepLink,
  setPendingDeepLink,
  subscribePendingDeepLink,
  wasDeepLinkConsumedThisLaunch,
} from '../utils/pendingDeepLink';

function isShareDeepLink(url: string | null | undefined): boolean {
  if (!url) return false;
  return Boolean(
    parseProfileUsernameFromUrl(url) ||
      parseReelIdFromUrl(url) ||
      parseReferralCodeFromUrl(url),
  );
}

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const [initialUrlSettled, setInitialUrlSettled] = useState(false);
  const [pendingShareLink, setPendingShareLink] = useState(hasPendingDeepLink);
  const [deepLinkHoldExpired, setDeepLinkHoldExpired] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    try {
      globalState.setUserType('diamond');
    } catch (err) {
      logger.warn('[Index] State update error:', err);
    }
  }, [isSignedIn]);

  useEffect(() => {
    let cancelled = false;

    Linking.getInitialURL()
      .then((url) => {
        if (cancelled) return;
        if (url && isShareDeepLink(url)) {
          setPendingDeepLink(url);
          setPendingShareLink(true);
        }
        setInitialUrlSettled(true);
      })
      .catch(() => {
        if (!cancelled) setInitialUrlSettled(true);
      });

    const unsub = subscribePendingDeepLink((url) => {
      setPendingShareLink(isShareDeepLink(url));
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Safety: if deep-link navigation never leaves `/`, fall through to home.
  useEffect(() => {
    if (!pendingShareLink && !wasDeepLinkConsumedThisLaunch()) return;
    const t = setTimeout(() => setDeepLinkHoldExpired(true), 3500);
    return () => clearTimeout(t);
  }, [pendingShareLink]);

  if (!isLoaded || !initialUrlSettled) {
    return <BootSplashScreen />;
  }

  const onIndexRoute = pathname === '/' || pathname === '/index' || pathname === '';

  /*
   * Share/QR cold start: hold the splash so we do not Redirect to matches and
   * wipe the profile open. Once the stack leaves `/`, stay quiet.
   */
  if (!deepLinkHoldExpired && (pendingShareLink || wasDeepLinkConsumedThisLaunch())) {
    if (!onIndexRoute) return null;
    return <BootSplashScreen />;
  }

  if (!onIndexRoute) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)/matches" />;
  }

  return <Redirect href="/auth" />;
}
