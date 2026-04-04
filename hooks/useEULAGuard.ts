/**
 * useEULAGuard Hook
 * Apple Compliance - Guideline 1.2
 * 
 * Checks if user has accepted EULA before accessing UGC content
 * Redirects to EULA screen if not accepted
 */

import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

const EULA_VERSION = '1.0';

export const useEULAGuard = () => {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isChecking, setIsChecking] = useState(true);
  const [eulaAccepted, setEulaAccepted] = useState(false);

  useEffect(() => {
    checkEULAStatus();
  }, [isSignedIn]);

  const checkEULAStatus = async () => {
    try {
      // Skip check if not signed in or on auth/eula screens
      if (!isSignedIn) {
        setIsChecking(false);
        return;
      }

      const currentPath = segments.join('/');
      if (currentPath.includes('auth') || currentPath.includes('eula')) {
        setIsChecking(false);
        return;
      }

      // Check AsyncStorage first (faster)
      const localAccepted = await AsyncStorage.getItem('eula_accepted');
      const localVersion = await AsyncStorage.getItem('eula_version');

      if (localAccepted === 'true' && localVersion === EULA_VERSION) {
        setEulaAccepted(true);
        setIsChecking(false);
        return;
      }

      // Verify with backend
      const token = await getToken();
      if (!token) {
        setIsChecking(false);
        return;
      }

      const response = await fetch(`${getApiUrl()}/eula/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data.eulaAccepted) {
        // Sync with AsyncStorage
        await AsyncStorage.setItem('eula_accepted', 'true');
        await AsyncStorage.setItem('eula_version', data.data.eulaVersion || EULA_VERSION);
        setEulaAccepted(true);
      } else {
        // EULA not accepted - redirect to EULA screen
        setEulaAccepted(false);
        router.replace('/eula');
      }
    } catch (error: any) {
      logger.error('EULA check error:', error);
      // On error, assume EULA not accepted (safe default)
      setEulaAccepted(false);
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isChecking,
    eulaAccepted,
    checkEULAStatus,
  };
};
