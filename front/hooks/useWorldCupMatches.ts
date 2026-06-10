import { useCallback, useEffect, useRef, useState } from 'react';
import { Match } from '../components/Matches/matchCardUtils';
import {
  fetchLiveMatches,
  fetchWorldCupMatchesByDate,
  formatLocalDateKey,
  getLocalTodayKey,
} from '../components/Matches/leagueApiUtils';
import { ApiFootballService } from '../services/apiFootball';
import { logger } from '../utils/logger';

interface UseWorldCupMatchesResult {
  matches: Match[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasLive: boolean;
}

const memoryCache = new Map<string, { data: Match[]; ts: number }>();
const TTL_IDLE_MS = 15_000;
const TTL_LIVE_MS = 3_000;
const POLL_LIVE_MS = 3_000;
const POLL_TODAY_MS = 8_000;
const POLL_CAMPAIGN_LIVE_MS = 3_000;
const POLL_CAMPAIGN_TODAY_MS = 5_000;

function mergeLive(wc: Match[], live: Match[], leagueId: number): Match[] {
  const liveWc = live.filter((m) => m.league?.id === leagueId);
  if (liveWc.length === 0) return wc;
  const map = new Map(wc.map((m) => [m.id, m]));
  for (const lm of liveWc) {
    map.set(lm.id, lm);
  }
  return [...map.values()];
}

function cornerValue(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

async function enrichLiveCorners(matches: Match[]): Promise<Match[]> {
  const live = matches.filter((m) => m.status === 'live');
  if (live.length === 0) return matches;

  const cornerById = new Map<string, { home: number; away: number }>();
  await Promise.all(
    live.map(async (m) => {
      try {
        const stats = await ApiFootballService.getFixtureStatistics(parseInt(m.id, 10));
        if (!stats || stats.length < 2) return;
        const homeRow = stats.find((s) => s.team?.name === m.homeTeam?.name) ?? stats[0];
        const awayRow = stats.find((s) => s.team?.name !== homeRow.team?.name) ?? stats[1];
        const homeCorners = cornerValue(
          homeRow.statistics?.find((s) => s.type === 'Corner Kicks')?.value,
        );
        const awayCorners = cornerValue(
          awayRow.statistics?.find((s) => s.type === 'Corner Kicks')?.value,
        );
        if (homeCorners != null && awayCorners != null) {
          cornerById.set(m.id, { home: homeCorners, away: awayCorners });
        }
      } catch {
        // non-fatal — list still shows scores/minutes
      }
    }),
  );

  if (cornerById.size === 0) return matches;
  return matches.map((m) => {
    const corners = cornerById.get(m.id);
    return corners ? { ...m, corners } : m;
  });
}

export function useWorldCupMatches(
  selectedDate: Date,
  enabled: boolean,
  leagueId: number,
  campaignMode = false,
): UseWorldCupMatchesResult {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLive, setHasLive] = useState(false);
  const fetchingRef = useRef(false);
  const hasDataRef = useRef(false);

  const dateString = formatLocalDateKey(selectedDate);
  const isToday = dateString === getLocalTodayKey();

  const load = useCallback(async () => {
    if (!enabled) {
      setMatches([]);
      setHasLive(false);
      setLoading(false);
      hasDataRef.current = false;
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const mem = memoryCache.get(dateString);
    const ttl = mem?.data.some((m) => m.status === 'live') ? TTL_LIVE_MS : TTL_IDLE_MS;
    if (mem && Date.now() - mem.ts < ttl && !mem.data.some((m) => m.status === 'live')) {
      setMatches(mem.data);
      setHasLive(mem.data.some((m) => m.status === 'live'));
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    if (!hasDataRef.current) setLoading(true);
    setError(null);
    try {
      let list = await fetchWorldCupMatchesByDate(selectedDate, {
        skipDiskCache: isToday,
      });
      if (isToday) {
        const live = await fetchLiveMatches();
        list = mergeLive(list, live, leagueId);
      }
      if (list.some((m) => m.status === 'live')) {
        list = await enrichLiveCorners(list);
      }
      const liveNow = list.some((m) => m.status === 'live');
      memoryCache.set(dateString, { data: list, ts: Date.now() });
      setMatches(list);
      setHasLive(liveNow);
      hasDataRef.current = list.length > 0;
    } catch (e) {
      logger.warn('useWorldCupMatches failed:', e);
      setError('load_failed');
      setMatches([]);
      setHasLive(false);
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
    const period = hasLive
      ? campaignMode
        ? POLL_CAMPAIGN_LIVE_MS
        : POLL_LIVE_MS
      : campaignMode
        ? POLL_CAMPAIGN_TODAY_MS
        : POLL_TODAY_MS;
    const id = setInterval(() => void load(), period);
    return () => clearInterval(id);
  }, [campaignMode, enabled, hasLive, isToday, load]);

  return { matches, loading, error, refetch: load, hasLive };
}
