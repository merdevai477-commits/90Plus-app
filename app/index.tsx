import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../components/reels/constants';
import { globalState } from '../globalState';
import { useHomeStore } from '../src/store/home.store';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Wait for Clerk to load
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.deepBlack }}>
        <ActivityIndicator size="large" color={COLORS.neonGreen} />
      </View>
    );
  }

  // If user is signed in, go to Home
  if (isSignedIn) {
    // Set user type in globalState
    globalState.setUserType('diamond');
    useHomeStore.getState().setUserMode('diamond');
    return <Redirect href="/(tabs)/Home" />;
  }

  // If not signed in, go to auth
  return <Redirect href="/auth" />;
}


