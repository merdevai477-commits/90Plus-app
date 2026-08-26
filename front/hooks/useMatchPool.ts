import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CompetitionsService, MatchPoolEntry } from '../services/competitions.service';
import { logger } from '../utils/logger';

/**
 * The admin-curated daily match pool behind the sponsor wizard's
 * "اختر المباراة" dropdown.
 *
 * This lives in a hook rather than inline in the wizard because of the bug it
 * exists to prevent. `@clerk/clerk-expo`'s `useAuth` builds `getToken` as a
 * bare `const getToken = (opts) => …` in the hook body — a new function
 * reference on *every* render, never memoised. The wizard's loader listed it
 * as an effect dependency and ended in `setMatches(pool)`, which is always a
 * fresh array, so the effect re-armed itself forever:
 *
 *     effect → GET /match-pool → setMatches → render → new getToken → effect …
 *
 * The endpoint was called continuously from the moment step 2 opened. The fix
 * is to key the effect on the things that actually change what is requested —
 * the step and an explicit reload nonce — and to read the token function
 * through a ref, which is the pattern `useCompetitions` and `useCompetition`
 * already document.
 */
export function useMatchPool(enabled: boolean) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [matches, setMatches] = useState<MatchPoolEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** Bumped by `reload`; the only other thing that re-runs the request. */
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const token = await getTokenRef.current();
        // The endpoint requires auth, so a missing session is a failure state.
        // Reporting it as an empty pool told the sponsor there were no matches
        // today when the truth was that the request was never made.
        if (!token) throw new Error('AUTH_REQUIRED');
        const pool = await CompetitionsService.getMatchPool(token);
        if (!cancelled) setMatches(pool);
      } catch (err) {
        if (cancelled) return;
        logger.error('[useMatchPool] load failed:', err);
        setMatches([]);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  return { matches, loading, error, reload };
}
