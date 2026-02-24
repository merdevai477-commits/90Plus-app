import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator, Text } from 'react-native';
import { COLORS } from '../components/reels/constants';
import { globalState } from '../globalState';
import { useHomeStore } from '../src/store/home.store';

export default function Index() {
  const [error, setError] = React.useState<string | null>(null);
  
  // Wrap auth check in try-catch
  let isSignedIn = false;
  let isLoaded = false;
  
  try {
    const auth = useAuth();
    isSignedIn = auth.isSignedIn || false;
    isLoaded = auth.isLoaded || false;
  } catch (err) {
    console.error('[Index] Auth error:', err);
    setError('Authentication service unavailable');
  }

  // Show error state if auth failed
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.deepBlack, padding: 20 }}>
        <Text style={{ color: '#ef4444', fontSize: 18, marginBottom: 20, textAlign: 'center' }}>
          {error}
        </Text>
        <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>
          Please restart the app
        </Text>
      </View>
    );
  }

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
    try {
      // Set user type in globalState
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


