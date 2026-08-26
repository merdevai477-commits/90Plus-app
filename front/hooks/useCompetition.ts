import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CompetitionEntryInfo,
  CompetitionInfo,
  CompetitionsService,
} from '../services/competitions.service';
import { logger } from '../utils/logger';

export interface PredictionInput {
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  predictedWinner?: 'home' | 'draw' | 'away';
}

export function useCompetition(id: string | undefined) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [competition, setCompetition] = useState<CompetitionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clerk's `getToken` is not referentially stable. Holding it in a ref keeps
  // `refresh` stable, so the load effect cannot re-fire on every render.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const signedInRef = useRef(isSignedIn);
  signedInRef.current = isSignedIn;

  /** Guards against overlapping submits (rapid double-tap on the CTA). */
  const submitInFlight = useRef(false);
  /** Ignores responses from a superseded competition id. */
  const requestSeq = useRef(0);
  /**
   * Separate counter for spinner-showing loads. Sharing `requestSeq` with the
   * silent post-submit refetch would let that refetch supersede a visible load
   * whose `finally` then declines to clear `loading` — stranding the screen on
   * its spinner.
   */
  const visibleSeq = useRef(0);

  const resolveToken = useCallback(async () => {
    if (!signedInRef.current) return null;
    try {
      return await getTokenRef.current();
    } catch {
      return null;
    }
  }, []);

  /**
   * `silent` re-fetches without dropping the screen back to its spinner — used
   * after a successful prediction, where the form must stay on screen while the
   * server's version of the entry replaces the optimistic one.
   */
  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!id) {
        setLoading(false);
        setError('NOT_FOUND');
        return;
      }
      const seq = ++requestSeq.current;
      const vSeq = opts.silent ? visibleSeq.current : ++visibleSeq.current;
      if (!opts.silent) setLoading(true);
      try {
        const token = await resolveToken();
        const data = await CompetitionsService.getById(token, id);
        if (seq !== requestSeq.current) return;
        setCompetition(data);
        setError(null);
      } catch (err: any) {
        if (seq !== requestSeq.current) return;
        logger.error('[useCompetition] refresh failed:', err);
        // A silent refresh must not tear down a screen that is already
        // rendering valid data — the user has just submitted successfully.
        if (opts.silent) return;
        // Leaving `error` null here would strand the screen on its spinner.
        setError(err?.message || 'LOAD_FAILED');
      } finally {
        if (!opts.silent && vSeq === visibleSeq.current) setLoading(false);
      }
    },
    [id, resolveToken],
  );

  const refresh = useCallback(() => load(), [load]);

  /**
   * Clerk resolves after first render. Fetching before that would ask as an
   * anonymous caller, so `myEntry` would come back null and a returning
   * entrant would be shown an empty prediction form.
   */
  const authKey = !isLoaded ? 'pending' : isSignedIn ? 'in' : 'out';
  useEffect(() => {
    if (authKey === 'pending') return;
    void load();
  }, [authKey, load]);

  /**
   * Returns the saved entry, or `null` when the call was dropped because one
   * was already in flight. Callers must not report success on `null` — a
   * double-tap would otherwise show "تم إرسال توقعك" for a request that never
   * happened.
   */
  const predict = useCallback(
    async (prediction: PredictionInput): Promise<CompetitionEntryInfo | null> => {
      if (!id || submitInFlight.current) return null;
      submitInFlight.current = true;
      setSubmitting(true);
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('NOT_AUTHENTICATED');
        const entry = await CompetitionsService.predict(token, id, prediction);
        setCompetition((prev) =>
          prev
            ? {
                ...prev,
                myEntry: entry,
                // Editing an existing prediction must not inflate the count.
                participantsCount: prev.myEntry
                  ? prev.participantsCount
                  : prev.participantsCount + 1,
              }
            : prev,
        );
        // Reconcile with the server: the optimistic patch above guesses the
        // participant count and knows nothing about a status the settlement
        // job may have changed while the form was open.
        void load({ silent: true });
        return entry;
      } finally {
        submitInFlight.current = false;
        setSubmitting(false);
      }
    },
    [id, load],
  );

  return { competition, loading, submitting, error, refresh, predict };
}
