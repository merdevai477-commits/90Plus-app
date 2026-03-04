import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../components/reels/constants';
import { globalState } from '../globalState';
import { useHomeStore } from '../src/store/home.store';

export default function Index() {
  // ✅ FIXED: Hooks must always be called at the top level, never inside try/catch.
  // Calling useAuth() inside try/catch was a Rules of Hooks violation and the
  // likely cause of the iPad crash (React throws an error when hooks are called
  // conditionally or inside error-handling blocks).
  const { isSignedIn, isLoaded } = useAuth();

  // Wait for Clerk to finish loading
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.deepBlack }}>
        <ActivityIndicator size="large" color={COLORS.neonGreen} />
      </View>
    );
  }

  // If user is signed in, go to Home
  if (isSignedIn) {
    try {
      // Set user type in globalState (non-hook, safe inside try/catch)
      globalState.setUserType('diamond');
      useHomeStore.getState().setUserMode('diamond');
    } catch (err) {
      console.error('[Index] State update error:', err);
      // Continue anyway - not critical
    }
    return <Redirect href="/(tabs)/Home" />;
  }

  // If not signed in, go to auth
  return <Redirect href="/auth" />;
}
