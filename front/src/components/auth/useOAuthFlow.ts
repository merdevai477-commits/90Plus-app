/**
 * useOAuthFlow
 *
 * Wraps Clerk's `useSSO` hook for Google + Apple. Prefer `useSSO` over the
 * older `useOAuth`: the latter crashes with
 * `Cannot read property 'toString' of null` when Clerk returns no redirect URL
 * (network blip / incomplete sign-in). `useSSO` null-checks and throws a
 * clear error we surface via Alert.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth, useSSO } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { navigateAfterAuth } from '@/src/utils/postAuthNavigation';
import {
  isOAuthUserCancelled,
  resolveOAuthRedirectUrl,
} from '@/src/utils/authSession';
import { completeOAuthMissingRequirements } from '@/src/utils/oauthSignUpCompletion';
import { getReferralUnsafeMetadata } from '../../../utils/pendingReferral';
import { logger } from '../../../utils/logger';

interface OAuthFlowOptions {
  onError?: (message: string) => void;
  /** Runs after session is active, before post-auth navigation (e.g. age attestation at signup). */
  beforeNavigate?: () => Promise<void>;
  /** User accepted Terms & Privacy (required for OAuth sign-up in production). */
  legalAccepted?: boolean;
  /** Called when OAuth sign-up still needs email OTP after legal consent. */
  onEmailVerificationNeeded?: () => void;
}

interface OAuthFlowReturn {
  startGoogle: () => Promise<void>;
  startApple: () => Promise<void>;
}

type OAuthStrategy = 'oauth_google' | 'oauth_apple';

function resolveSessionId(result: {
  createdSessionId?: string | null;
  signIn?: { createdSessionId?: string | null; status?: string | null };
  signUp?: { createdSessionId?: string | null; status?: string | null };
}): string | null {
  return (
    result.createdSessionId ??
    result.signIn?.createdSessionId ??
    result.signUp?.createdSessionId ??
    null
  );
}

export function useOAuthFlow({
  onError,
  beforeNavigate,
  legalAccepted = false,
  onEmailVerificationNeeded,
}: OAuthFlowOptions = {}): OAuthFlowReturn {
  const router = useRouter();
  const { getToken } = useAuth();
  const { startSSOFlow } = useSSO();

  const handle = useCallback(
    async (strategy: OAuthStrategy, providerLabel: string): Promise<void> => {
      try {
        const redirectUrl = resolveOAuthRedirectUrl();
        const referralMeta = await getReferralUnsafeMetadata();
        if (referralMeta) {
          logger.info('[Referral] signup_stamped', { path: 'oauth' });
        }
        const result = await startSSOFlow({
          strategy,
          redirectUrl,
          ...(referralMeta ? { unsafeMetadata: referralMeta } : {}),
        });

        const sessionId = resolveSessionId(result);
        if (sessionId && result.setActive) {
          await result.setActive({ session: sessionId });
          if (beforeNavigate) {
            await beforeNavigate();
          }
          const firstRegistration = Boolean(result.signUp?.createdSessionId) && !result.signIn?.createdSessionId;
          await navigateAfterAuth(router, getToken, { afterOnboarding: firstRegistration });
          return;
        }

        const signInStatus = result.signIn?.status;
        const signUpStatus = result.signUp?.status;

        if (signUpStatus === 'missing_requirements' && result.signUp) {
          const completion = await completeOAuthMissingRequirements(result.signUp, {
            legalAccepted,
          });

          if (completion.kind === 'session' && result.setActive) {
            await result.setActive({ session: completion.sessionId });
            if (beforeNavigate) {
              await beforeNavigate();
            }
            await navigateAfterAuth(router, getToken, { afterOnboarding: true });
            return;
          }

          if (completion.kind === 'email_verification') {
            onEmailVerificationNeeded?.();
            Alert.alert(
              'Verify your email',
              'We sent a verification code to your email. Enter it to finish signing up.',
            );
            return;
          }

          if (!legalAccepted) {
            Alert.alert(
              'Terms required',
              'Please accept the Terms & Privacy Policy before continuing with Google or Apple.',
            );
            return;
          }

          Alert.alert(
            'Sign-up incomplete',
            'We could not finish your account setup. Try email sign-up or contact support.',
          );
          return;
        }

        if (signInStatus === 'needs_first_factor') {
          Alert.alert(
            'Verification required',
            'Please finish the verification step in your email or phone to continue.',
          );
          return;
        }

        if (signInStatus === 'complete' || signUpStatus === 'complete') {
          Alert.alert(
            'Sign-in incomplete',
            'Your account needs an extra step. Try email sign-in or contact support.',
          );
        }
      } catch (err: unknown) {
        if (isOAuthUserCancelled(err)) return;

        const error = err as {
          errors?: Array<{ longMessage?: string; message?: string }>;
          message?: string;
        };
        const raw =
          error?.errors?.[0]?.longMessage ||
          error?.errors?.[0]?.message ||
          error?.message ||
          '';
        const lower = raw.toLowerCase();
        const looksLikeNetwork =
          /network|failed to fetch|network_error|network request failed|offline|aborted/i.test(
            lower,
          ) || /external verification redirect|toString|of null/i.test(lower);
        const msg = looksLikeNetwork
          ? 'Could not reach sign-in servers. Check your internet connection and try again.'
          : raw || `${providerLabel} sign-in failed`;
        logger.warn('[OAuth] sign-in failed', { provider: providerLabel, raw });
        onError?.(msg);
        Alert.alert(`${providerLabel} sign-in error`, msg);
      }
    },
    [router, onError, beforeNavigate, getToken, legalAccepted, onEmailVerificationNeeded, startSSOFlow],
  );

  const startGoogle = useCallback(
    () => handle('oauth_google', 'Google'),
    [handle],
  );
  const startApple = useCallback(
    () => handle('oauth_apple', 'Apple'),
    [handle],
  );

  return { startGoogle, startApple };
}
