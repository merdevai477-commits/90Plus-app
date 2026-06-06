/**
 * Reliable Clerk session token for API calls.
 * iOS SecureStore can lag briefly after sign-in — retry before failing auth.
 */

type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;

export async function getClerkBearerToken(
  getToken: GetTokenFn,
  options?: { retries?: number; baseDelayMs?: number },
): Promise<string | null> {
  const retries = options?.retries ?? 8;
  const baseDelayMs = options?.baseDelayMs ?? 200;

  for (let attempt = 0; attempt < retries; attempt++) {
    const token = await getToken(
      attempt === retries - 1 ? { skipCache: true } : undefined,
    );
    if (token) return token;
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  return null;
}

export function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...extra,
  };
}
