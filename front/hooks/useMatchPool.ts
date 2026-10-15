import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CompetitionsService, MatchPoolEntry } from '../services/competitions.service';
import { logger } from '../utils/logger';

/**
 * The match pool behind the sponsor wizard's "اختر المباراة" dropdown.
 *
 * Supports an optional search query (`q`) so advertisers can find any upcoming
 * fixture (kickoff at least 1 hour away). See `useMatchPool` comments in git
 * history for why `getToken` is read through a ref.
 */
export function useMatchPool(enabled: boolean, q = '') {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [matches, setMatches] = useState<MatchPoolEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** Bumped by `reload`; the only other thing that re-runs the request. */
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const trimmedQ = q.trim();
  const [debouncedQ, setDebouncedQ] = useState(trimmedQ);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(trimmedQ), 280);
    return () => clearTimeout(handle);
  }, [trimmedQ]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('AUTH_REQUIRED');
        const pool = await CompetitionsService.getMatchPool(token, {
          q: debouncedQ || undefined,
        });
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
  }, [enabled, nonce, debouncedQ]);

  return { matches, loading, error, reload };
}
