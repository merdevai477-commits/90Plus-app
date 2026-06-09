/**
 * Reliable Clerk session token for API calls.
 * iOS SecureStore can lag briefly after sign-in — retry before failing auth.
 */

export type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;

/** Use before protected API calls — avoids 401 spam when Clerk is still loading. */
export function canMakeAuthenticatedRequests(
  isLoaded: boolean,
  isSignedIn: boolean,
): boolean {
  return isLoaded === true && isSignedIn === true;
}

export async function getClerkBearerToken(
  getToken: GetTokenFn,
  options?: { retries?: number; baseDelayMs?: number; forceRefresh?: boolean },
): Promise<string | null> {
  const retries = options?.retries ?? 8;
  const baseDelayMs = options?.baseDelayMs ?? 200;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const useSkipCache = options?.forceRefresh || attempt === retries - 1;
      const token = await getToken(useSkipCache ? { skipCache: true } : undefined);
      if (token) return token;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/signed out/i.test(msg)) {
        return null;
      }
      throw err;
    }
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  return null;
}

/** Stable getter for preloadManager / long-lived callbacks. */
export function createClerkTokenGetter(getToken: GetTokenFn): () => Promise<string | null> {
  return () => getClerkBearerToken(getToken, { retries: 10, baseDelayMs: 250 });
}

export function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...extra,
  };
}

/**
 * Authenticated fetch — never sends a protected request without a token.
 * On 401, refreshes the Clerk JWT once and retries (handles stale session cache).
 */
export async function fetchWithClerkAuth(
  getToken: GetTokenFn,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response | null> {
  const token = await getClerkBearerToken(getToken);
  if (!token) return null;

  const buildInit = (bearer: string): RequestInit => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${bearer}`);
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }
    return { ...init, headers };
  };

  let response = await fetch(input, buildInit(token));

  if (response.status === 401) {
    const fresh = await getClerkBearerToken(getToken, {
      retries: 4,
      baseDelayMs: 300,
      forceRefresh: true,
    });
    if (fresh) {
      response = await fetch(input, buildInit(fresh));
    }
  }

  return response;
}
