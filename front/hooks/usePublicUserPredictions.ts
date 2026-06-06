import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PredictionsService,
  type PublicUserPredictionsPayload,
} from '../services/predictions.service';
import { publicUserPredictionsKey } from '../services/predictionsCacheKeys';
import type { UserPredictionItem } from '../components/profile/ProfileAnalyticsTab';

const EMPTY: PublicUserPredictionsPayload = {
  stats: {
    total: 0,
    correct: 0,
    incorrect: 0,
    pending: 0,
    accuracy: 0,
    resolved: 0,
    totalCoinsWon: 0,
  },
  predictions: [],
};

function toPredictionItems(raw: PublicUserPredictionsPayload['predictions']): UserPredictionItem[] {
  return raw.map((p) => ({
    id: p.id,
    apiMatchId: Number(p.apiMatchId),
    predictionType: p.predictionType,
    homeTeam: p.homeTeam ?? null,
    awayTeam: p.awayTeam ?? null,
    homeTeamLogo: p.homeTeamLogo ?? null,
    awayTeamLogo: p.awayTeamLogo ?? null,
    matchDate: p.matchDate ?? null,
    leagueName: p.leagueName ?? null,
    isCorrect: p.isCorrect ?? null,
    coinsWon: p.coinsWon ?? null,
    coinsSpent: p.coinsSpent ?? 0,
    createdAt: p.createdAt,
  }));
}

export function usePublicUserPredictions(
  username: string | undefined,
  getToken: () => Promise<string | null>,
  enabled = true,
) {
  const [stats, setStats] = useState(EMPTY.stats);
  const [predictions, setPredictions] = useState<UserPredictionItem[]>([]);
  const hydratedRef = useRef(false);

  const applyPayload = useCallback((payload: PublicUserPredictionsPayload) => {
    setStats(payload.stats);
    setPredictions(toPredictionItems(payload.predictions));
  }, []);

  const hydrateFromCache = useCallback(async (user: string) => {
    try {
      const raw = await AsyncStorage.getItem(publicUserPredictionsKey(user));
      if (!raw) return;
      const parsed = JSON.parse(raw) as PublicUserPredictionsPayload;
      if (parsed?.stats) applyPayload(parsed);
    } catch {
      // ignore corrupt cache
    }
  }, [applyPayload]);

  const refresh = useCallback(async (skipCache = false) => {
    if (!username || !enabled) return;
    const key = username.toLowerCase();

    if (!skipCache && !hydratedRef.current) {
      await hydrateFromCache(key);
      hydratedRef.current = true;
    }

    try {
      const token = await getToken();
      const payload = await PredictionsService.getPublicUserPredictions(key, token);
      applyPayload(payload);
      await AsyncStorage.setItem(publicUserPredictionsKey(key), JSON.stringify(payload));
    } catch {
      // keep cached data on network errors
    }
  }, [username, enabled, getToken, hydrateFromCache, applyPayload]);

  useEffect(() => {
    if (!username || !enabled) return;
    hydratedRef.current = false;
    void refresh(false);
  }, [username, enabled, refresh]);

  return { stats, predictions, refresh };
}
