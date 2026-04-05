import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../components/reels/constants';
import { globalState } from '../globalState';
import { useHomeStore } from '../src/store/home.store';
import { logger } from '../services/logger';

export default function Index() {
  // ✅ FIXED: Hooks must always be called at the top level, never inside try/catch.
  // Calling useAuth() inside try/catch was a Rules of Hooks violation and the
  // likely cause of the iPad crash (React throws an error when hooks are called
  // conditionally or inside error-handling blocks).
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [checkingAge, setCheckingAge] = useState(false);
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);

  // Check age verification status when signed in
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const checkAgeStatus = async () => {
      try {
        setCheckingAge(true);
        const token = await getToken();
        
        if (!token) {
          logger.warn('[Index] No auth token, skipping age check');
          setAgeVerified(false);
          return;
        }

        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/age-status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          // Age not verified
          if (data.code === 'AGE_NOT_VERIFIED') {
            logger.info('[Index] Age not verified');
            setAgeVerified(false);
            return;
          }
          
          // Other errors - allow access (fail open for now)
          logger.warn('[Index] Age check failed, allowing access:', data.message);
          setAgeVerified(true);
          return;
        }

        // Check age tier and consent
        if (!data.ageVerified) {
          logger.info('[Index] Age not verified');
          setAgeVerified(false);
        } else if (data.ageTier === 'BLOCKED') {
          logger.info('[Index] User blocked (under 13)');
          setAgeVerified(false);
        } else if (data.ageTier === 'TEEN' && !data.parentalConsent) {
          logger.info('[Index] Parental consent required');
          setAgeVerified(false);
        } else {
          logger.info('[Index] Age verified, tier:', data.ageTier);
          setAgeVerified(true);
        }

      } catch (err) {
        logger.error('[Index] Age check error:', err);
        // Fail open - allow access on error
        setAgeVerified(true);
      } finally {
        setCheckingAge(false);
      }
    };

    checkAgeStatus();
  }, [isSignedIn, isLoaded, getToken]);

  // Wait for Clerk to finish loading
  if (!isLoaded || (isSignedIn && checkingAge)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.deepBlack }}>
        <ActivityIndicator size="large" color={COLORS.neonGreen} />
      </View>
    );
  }

  // If user is signed in
  if (isSignedIn) {
    try {
      // Set user type in globalState (non-hook, safe inside try/catch)
      globalState.setUserType('diamond');
      useHomeStore.getState().setUserMode('diamond');
    } catch (err) {
      console.error('[Index] State update error:', err);
      // Continue anyway - not critical
    }

    // Check age verification
    if (ageVerified === false) {
      logger.info('[Index] Redirecting to age gate');
      return <Redirect href="/age-gate" />;
    }

    // Age verified or check not complete - go to Home
    return <Redirect href="/(tabs)/Home" />;
  }

  // If not signed in, go to auth
  return <Redirect href="/auth" />;
}
