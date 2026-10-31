import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

/** Must match Clerk Dashboard → Redirect URLs / Native allowlist */
export const OAUTH_REDIRECT_URL = 'ninetyplus://auth-callback';

/**
 * OAuth redirect for Google/Apple.
 * Prefer the production custom scheme everywhere the native binary owns
 * `ninetyplus://` (standalone + dev client). Only Expo Go needs `exp://…`,
 * and those URLs must be allowlisted in Clerk or OAuth returns no redirect.
 */
export function resolveOAuthRedirectUrl(): string {
  // Expo Go only — custom/dev/store builds all have the app scheme.
  if (Constants.appOwnership === 'expo') {
    const url = Linking.createURL('auth-callback');
    return url.replace(':///', '://');
  }
  return OAUTH_REDIRECT_URL;
}

/** Clerk session JWT is sometimes unavailable immediately after setActive(). */
export async function waitForClerkToken(
  getToken: () => Promise<string | null>,
  maxAttempts = 10,
  delayMs = 300,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = await getToken();
    if (token) return token;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

export function isOAuthUserCancelled(err: unknown): boolean {
  const e = err as { code?: string; message?: string; errors?: Array<{ code?: string; message?: string }> };
  const code = e?.code ?? e?.errors?.[0]?.code ?? '';
  const msg = (e?.message ?? e?.errors?.[0]?.message ?? '').toLowerCase();
  return (
    code === 'oauth_cancelled' ||
    code === 'user_cancelled' ||
    msg.includes('cancel') ||
    msg.includes('dismiss')
  );
}
