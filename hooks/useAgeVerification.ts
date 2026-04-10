/**
 * Age Verification Hook
 * 
 * Checks age verification status and routes user accordingly
 * 
 * Features:
 * - Check if age verified
 * - Check age tier
 * - Check parental consent status
 * - Auto-redirect to appropriate screen
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { logger } from '../services/logger';
import { captureException } from '../services/sentry.service';
import { getApiEndpoint } from '../config/api.config';

interface AgeStatus {
  ageVerified: boolean;
  ageTier: 'BLOCKED' | 'TEEN' | 'ADULT' | null;
  parentalConsent: boolean;
  parentalConsentPending: boolean;
  restrictions: {
    canChat: boolean;
    canCreateReels: boolean;
    canComment: boolean;
    canFollow: boolean;
    canUseRealMoney: boolean;
    profilePublicByDefault: boolean;
    canShareLocation: boolean;
  };
}

export function useAgeVerification() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ageStatus, setAgeStatus] = useState<AgeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ✅ FIX: Use ref to prevent re-running when getToken reference changes
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // ⛔ DISABLED: age-status endpoint not deployed yet - causes infinite 404 loop
    // Re-enable when backend endpoint is ready
    setLoading(false);
  }, []);

  const checkAgeStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getTokenRef.current();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(getApiEndpoint('auth/age-status'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // If age not verified, redirect to age gate
        if (data.code === 'AGE_NOT_VERIFIED') {
          logger.info('[AgeVerification] Age not verified, redirecting to age gate');
          router.replace('/age-gate');
          return;
        }

        throw new Error(data.message || 'Failed to check age status');
      }

      setAgeStatus(data);

      // Route based on status
      if (!data.ageVerified) {
        logger.info('[AgeVerification] Not verified, redirecting to age gate');
        router.replace('/age-gate');
      } else if (data.ageTier === 'BLOCKED') {
        logger.info('[AgeVerification] Blocked tier, redirecting to blocked screen');
        router.replace('/blocked');
      } else if (data.ageTier === 'TEEN' && !data.parentalConsent) {
        if (data.parentalConsentPending) {
          logger.info('[AgeVerification] Consent pending, redirecting to waiting screen');
          router.replace('/waiting-consent');
        } else {
          logger.info('[AgeVerification] Consent required, redirecting to consent screen');
          router.replace('/parental-consent');
        }
      }
      // If ADULT or TEEN with consent, allow access (no redirect)

    } catch (err: any) {
      logger.error('[AgeVerification] Check failed:', err);
      captureException(err, {
        tags: { hook: 'useAgeVerification' },
      });
      
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canAccessFeature = (feature: keyof AgeStatus['restrictions']): boolean => {
    if (!ageStatus) return false;
    return ageStatus.restrictions[feature];
  };

  return {
    loading,
    ageStatus,
    error,
    checkAgeStatus,
    canAccessFeature,
  };
}
