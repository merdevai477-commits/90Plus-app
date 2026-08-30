import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import {
  deriveAddPrizeVariant,
  type AddPrizeButtonVariant,
} from '../components/predictAndWin/AddPrizeFab';
import {
  CompetitionsService,
  type CompetitionStatus,
} from '../services/competitions.service';
import { getClerkBearerToken } from '../utils/clerkAuthToken';

export interface SponsorPrizeCtaState {
  variant: AddPrizeButtonVariant;
  competitionId: string | null;
  loading: boolean;
}

/**
 * TEMP while the sponsor is testing the wizard.
 * `true` keeps the hub CTA as "أضف جائزتك" and always opens create, so they
 * can publish more than once. Flip to `false` when they say «رجعه زي ما كان».
 */
export const ALWAYS_ADD_PRIZE_CTA = true;

/**
 * Latest owned competition for the signed-in sponsor — drives the hub CTA
 * (`add` / `pending` / `winner` / `rejected`).
 */
export function useSponsorPrizeCta(): SponsorPrizeCtaState {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [status, setStatus] = useState<CompetitionStatus | null>(null);
  const [winnerAwardedAt, setWinnerAwardedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  /**
   * Clerk's `getToken` is a new function every render. Closing over it in
   * `refresh` made `useFocusEffect` re-fire forever — the same loop that
   * hammered `/match-pool`. A 500 from `/mine` then re-rendered the hub and
   * the cycle became GET /competitions/mine × dozens per second.
   */
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  const refresh = useCallback(async () => {
    if (!isSignedInRef.current) {
      setCompetitionId(null);
      setStatus(null);
      setWinnerAwardedAt(null);
      setLoading(false);
      return;
    }

    const ticket = ++seq.current;
    setLoading(true);
    try {
      const token = await getClerkBearerToken(getTokenRef.current, { retries: 2, baseDelayMs: 150 });
      if (!token || ticket !== seq.current) return;

      const mine = await CompetitionsService.listMine(token);
      if (ticket !== seq.current) return;

      const latest = mine.items[0];
      setCompetitionId(latest?.id ?? null);
      setStatus((latest?.status as CompetitionStatus) ?? null);
      setWinnerAwardedAt(latest?.winnerAwardedAt ?? null);
    } catch {
      if (ticket === seq.current) {
        setCompetitionId(null);
        setStatus(null);
        setWinnerAwardedAt(null);
      }
    } finally {
      if (ticket === seq.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isLoaded) return;
      void refresh();
    }, [isLoaded, refresh]),
  );

  return {
    variant: ALWAYS_ADD_PRIZE_CTA
      ? 'add'
      : deriveAddPrizeVariant(status, { winnerAwardedAt }),
    competitionId,
    loading: ALWAYS_ADD_PRIZE_CTA ? false : loading,
  };
}
