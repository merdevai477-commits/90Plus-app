import * as Linking from 'expo-linking';

/** Must match Clerk Dashboard → Redirect URLs / Native allowlist */
export const OAUTH_REDIRECT_URL = 'ninetyplus://auth-callback';

/**
 * OAuth redirect for Google/Apple. Normalizes accidental `scheme:///path` (triple slash).
 * Dev builds may return an Expo URL — register that URL in Clerk if it differs.
 */
export function resolveOAuthRedirectUrl(): string {
  const url = Linking.createURL('auth-callback');
  return url.replace(':///', '://');
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
