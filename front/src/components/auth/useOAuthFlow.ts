/**
 * useOAuthFlow
 *
 * Wraps Clerk's `useOAuth` hook for the two strategies the app exposes
 * (Google + Apple) and returns a single `start()` callback per strategy
 * that drives the in-app browser, sets the active session on success, and
 * navigates to the home tab. Errors are surfaced via Alert and the optional
 * `onError` callback so the caller can also reset its `isSubmitting` state.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth, useOAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { navigateAfterAuth } from '@/src/utils/postAuthNavigation';
import {
  isOAuthUserCancelled,
  resolveOAuthRedirectUrl,
} from '@/src/utils/authSession';
import { completeOAuthMissingRequirements } from '@/src/utils/oauthSignUpCompletion';

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
  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: 'oauth_apple' });

  const handle = useCallback(
    async (
      flow: typeof startGoogleFlow,
      providerLabel: string,
    ): Promise<void> => {
      try {
        const redirectUrl = resolveOAuthRedirectUrl();
        const result = await flow({ redirectUrl });

        const sessionId = resolveSessionId(result);
        if (sessionId && result.setActive) {
          await result.setActive({ session: sessionId });
          if (beforeNavigate) {
            await beforeNavigate();
          }
          await navigateAfterAuth(router, getToken);
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
            await navigateAfterAuth(router, getToken);
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

        const error = err as { errors?: Array<{ longMessage?: string }>; message?: string };
        const msg =
          error?.errors?.[0]?.longMessage ||
          error?.message ||
          `${providerLabel} sign-in failed`;
        onError?.(msg);
        Alert.alert(`${providerLabel} sign-in error`, msg);
      }
    },
    [router, onError, beforeNavigate, getToken, legalAccepted, onEmailVerificationNeeded],
  );

  const startGoogle = useCallback(() => handle(startGoogleFlow, 'Google'), [handle, startGoogleFlow]);
  const startApple = useCallback(() => handle(startAppleFlow, 'Apple'), [handle, startAppleFlow]);

  return { startGoogle, startApple };
}
