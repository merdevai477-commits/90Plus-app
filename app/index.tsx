import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { AppSplashScreen } from '../components/splash/AppSplashScreen';
import { globalState } from '../globalState';
import { useHomeStore } from '../src/store/home.store';
import { logger } from '../services/logger';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <AppSplashScreen />;
  }

  // If user is signed in
  if (isSignedIn) {
    try {
      globalState.setUserType('diamond');
      useHomeStore.getState().setUserMode('diamond');
    } catch (err) {
      logger.warn('[Index] State update error:', err);
    }

    return <Redirect href="/(tabs)/Home" />;
  }

  // If not signed in, go to auth
  return <Redirect href="/auth" />;
}
