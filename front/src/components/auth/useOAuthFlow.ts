/**
 * useOAuthFlow
 *
 * Wraps Clerk's `useOAuth` hook for the two strategies the app exposes
 * (Google + Apple) and returns a single `start()` callback per strategy
 * that drives the in-app browser, sets the active session on success, and
 * navigates to the home tab. Errors are surfaced via Alert and the optional
 * `onError` callback so the caller can also reset its `isSubmitting` state.
 *
 * Usage:
 *   const { startGoogle, startApple } = useOAuthFlow({ onError });
 *   <Button onPress={startGoogle} />
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { navigateAfterAuth } from '@/src/utils/postAuthNavigation';

interface OAuthFlowOptions {
  onError?: (message: string) => void;
}

interface OAuthFlowReturn {
  startGoogle: () => Promise<void>;
  startApple: () => Promise<void>;
}

export function useOAuthFlow({ onError }: OAuthFlowOptions = {}): OAuthFlowReturn {
  const router = useRouter();
  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: 'oauth_apple' });

  const handle = useCallback(
    async (
      flow: typeof startGoogleFlow,
      providerLabel: string,
    ): Promise<void> => {
      try {
        const redirectUrl = Linking.createURL('/auth-callback');
        const result = await flow({ redirectUrl });

        if (result.createdSessionId && result.setActive) {
          await result.setActive({ session: result.createdSessionId });
          await navigateAfterAuth(router);
          return;
        }

        // User cancelled, or further sign-up steps needed (rare for OAuth).
        if (result.signIn?.status === 'needs_first_factor' || result.signUp?.status === 'missing_requirements') {
          // Clerk will surface a verification step in the dashboard config.
          Alert.alert(
            'Almost there',
            'Please finish the verification step in your email or phone to continue.',
          );
          return;
        }
      } catch (err: unknown) {
        const error = err as { errors?: Array<{ longMessage?: string }>; message?: string };
        const msg =
          error?.errors?.[0]?.longMessage ||
          error?.message ||
          `${providerLabel} sign-in failed`;
        onError?.(msg);
        Alert.alert(`${providerLabel} sign-in error`, msg);
      }
    },
    [router, onError],
  );

  const startGoogle = useCallback(() => handle(startGoogleFlow, 'Google'), [handle, startGoogleFlow]);
  const startApple = useCallback(() => handle(startAppleFlow, 'Apple'), [handle, startAppleFlow]);

  return { startGoogle, startApple };
}
