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

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setCompetitionId(null);
      setStatus(null);
      setWinnerAwardedAt(null);
      setLoading(false);
      return;
    }

    const ticket = ++seq.current;
    setLoading(true);
    try {
      const token = await getClerkBearerToken(getToken, { retries: 2, baseDelayMs: 150 });
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
  }, [getToken, isSignedIn]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoaded) return;
      void refresh();
    }, [isLoaded, refresh]),
  );

  return {
    variant: deriveAddPrizeVariant(status, { winnerAwardedAt }),
    competitionId,
    loading,
  };
}
