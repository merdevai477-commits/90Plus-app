import { Redirect } from 'expo-router';
import React, { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { AppSplashScreen } from '../components/splash/AppSplashScreen';
import { globalState } from '../globalState';
import { useHomeStore } from '../src/store/home.store';
import { logger } from '../services/logger';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Fix 7: move store mutations out of render into useEffect
  useEffect(() => {
    if (!isSignedIn) return;
    try {
      globalState.setUserType('diamond');
      useHomeStore.getState().setUserMode('diamond');
    } catch (err) {
      logger.warn('[Index] State update error:', err);
    }
  }, [isSignedIn]);

  if (!isLoaded) {
    return <AppSplashScreen />;
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)/Home" />;
  }

  return <Redirect href="/auth" />;
}
