import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Match } from '../components/Matches/matchCardUtils';
import {
  fetchWorldCupMatchesByDate,
  formatLocalDateKey,
  getLocalTodayKey,
} from '../components/Matches/leagueApiUtils';
import { ApiFootballService } from '../services/apiFootball';
import { logger } from '../utils/logger';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import { LIVE_FIXTURE_CALENDAR_POLL_MS } from '../src/store/liveFixtureStore.types';
import { useRegisterLiveFixtures } from './useLiveFixture';
import { snapshotToMatchRow } from '../src/utils/snapshotToMatchRow';

interface UseWorldCupMatchesResult {
  matches: Match[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasLive: boolean;
}

const memoryCache = new Map<string, { data: Match[]; ts: number }>();
const TTL_IDLE_MS = 8_000;
const CORNERS_REFRESH_MS = 20_000;

function overlaySnapshots(
  calendarRows: Match[],
  snapshots: Record<number, import('../src/store/liveFixtureStore.types').LiveFixtureSnapshot>,
): Match[] {
  return calendarRows.map((row) => {
    const id = parseInt(row.id, 10);
    if (Number.isNaN(id)) return row;
    const snap = snapshots[id];
    if (!snap) return row;
    if (row.status === 'live' || snap.phase === 'live' || snap.phase === 'finished') {
      return snapshotToMatchRow(snap);
    }
    return row;
  });
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
  enrichCorners = true,
): UseWorldCupMatchesResult {
  const [calendarMatches, setCalendarMatches] = useState<Match[]>([]);
  const snapshots = useLiveFixtureStore((s) => s.snapshots);
  const matches = useMemo(
    () => overlaySnapshots(calendarMatches, snapshots),
    [calendarMatches, snapshots],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const hasDataRef = useRef(false);
  const lastCornersFetchRef = useRef(0);

  const dateString = formatLocalDateKey(selectedDate);
  const isToday = dateString === getLocalTodayKey();

  const liveFixtureIds = useMemo(
    () =>
      calendarMatches
        .filter((m) => m.status === 'live')
        .map((m) => parseInt(m.id, 10))
        .filter((id) => !Number.isNaN(id) && id > 0),
    [calendarMatches],
  );
  useRegisterLiveFixtures(enabled && isToday ? liveFixtureIds : []);

  const hasLive = matches.some((m) => m.status === 'live');

  const load = useCallback(async () => {
    if (!enabled) {
      setCalendarMatches([]);
      setLoading(false);
      hasDataRef.current = false;
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const mem = memoryCache.get(dateString);
    const ttl = TTL_IDLE_MS;
    if (mem && Date.now() - mem.ts < ttl && !mem.data.some((m) => m.status === 'live')) {
      setCalendarMatches(mem.data);
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
      const liveNow = list.some((m) => m.status === 'live');
      if (liveNow && enrichCorners) {
        const now = Date.now();
        if (now - lastCornersFetchRef.current >= CORNERS_REFRESH_MS) {
          lastCornersFetchRef.current = now;
          list = await enrichLiveCorners(list);
        } else {
          const prev = memoryCache.get(dateString)?.data;
          if (prev?.length) {
            const cornersById = new Map(
              prev.filter((m) => m.corners).map((m) => [m.id, m.corners!]),
            );
            if (cornersById.size > 0) {
              list = list.map((m) => {
                const corners = cornersById.get(m.id);
                return corners ? { ...m, corners } : m;
              });
            }
          }
        }
      }
      memoryCache.set(dateString, { data: list, ts: Date.now() });
      setCalendarMatches(list);
      hasDataRef.current = list.length > 0;
    } catch (e) {
      logger.warn('useWorldCupMatches failed:', e);
      setError('load_failed');
      setCalendarMatches([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [dateString, enabled, enrichCorners, isToday, leagueId, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !isToday) return;
    const id = setInterval(() => void load(), LIVE_FIXTURE_CALENDAR_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, isToday, load]);

  return { matches, loading, error, refetch: load, hasLive };
}
