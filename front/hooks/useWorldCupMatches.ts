import { useCallback, useEffect, useRef, useState } from 'react';
import { Match } from '../components/Matches/matchCardUtils';
import {
  fetchLiveMatches,
  fetchWorldCupMatchesByDate,
  formatLocalDateKey,
  getLocalTodayKey,
} from '../components/Matches/leagueApiUtils';
import { logger } from '../utils/logger';

interface UseWorldCupMatchesResult {
  matches: Match[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const memoryCache = new Map<string, { data: Match[]; ts: number }>();
const TTL_MS = 30_000;

function mergeLive(wc: Match[], live: Match[], leagueId: number): Match[] {
  const liveWc = live.filter((m) => m.league?.id === leagueId);
  if (liveWc.length === 0) return wc;
  const map = new Map(wc.map((m) => [m.id, m]));
  for (const lm of liveWc) {
    map.set(lm.id, lm);
  }
  return [...map.values()];
}

export function useWorldCupMatches(
  selectedDate: Date,
  enabled: boolean,
  leagueId: number,
): UseWorldCupMatchesResult {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const dateString = formatLocalDateKey(selectedDate);
  const isToday = dateString === getLocalTodayKey();

  const load = useCallback(async () => {
    if (!enabled) {
      setMatches([]);
      setLoading(false);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const mem = memoryCache.get(dateString);
    if (mem && Date.now() - mem.ts < TTL_MS) {
      setMatches(mem.data);
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let list = await fetchWorldCupMatchesByDate(selectedDate);
      if (isToday) {
        const live = await fetchLiveMatches();
        list = mergeLive(list, live, leagueId);
      }
      memoryCache.set(dateString, { data: list, ts: Date.now() });
      setMatches(list);
    } catch (e) {
      logger.warn('useWorldCupMatches failed:', e);
      setError('load_failed');
      setMatches([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [dateString, enabled, isToday, leagueId, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !isToday) return;
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [enabled, isToday, load]);

  return { matches, loading, error, refetch: load };
}
