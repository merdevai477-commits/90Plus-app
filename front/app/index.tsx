import { Redirect } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { BootSplashScreen } from '../components/splash/BootSplashScreen';
import { globalState } from '../globalState';
import { logger } from '../services/logger';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Fix 7: move store mutations out of render into useEffect
  useEffect(() => {
    if (!isSignedIn) return;
    try {
      globalState.setUserType('diamond');
    } catch (err) {
      logger.warn('[Index] State update error:', err);
    }
  }, [isSignedIn]);

  if (!isLoaded) {
    return <BootSplashScreen />;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)/matches" />;
  }

  return <Redirect href="/auth/login" />;
}
