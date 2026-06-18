import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Match } from '../components/Matches/matchCardUtils';
import {
  fetchWorldCupMatchesByDate,
  fetchLiveMatches,
  formatLocalDateKey,
  getLocalTodayKey,
} from '../components/Matches/leagueApiUtils';
import { ApiFootballService } from '../services/apiFootball';
import { logger } from '../utils/logger';
import { useLiveFixtureStore } from '../src/store/liveFixtureStore';
import { LIVE_FIXTURE_CALENDAR_POLL_MS } from '../src/store/liveFixtureStore.types';
import { useRegisterLiveFixtures } from './useLiveFixture';
import { snapshotToMatchRow } from '../src/utils/snapshotToMatchRow';
import { registerWorldCupMemoryCacheClear } from '../services/footballCacheEpochSync';
import { getAppLanguageCode } from '../utils/appLanguage';
import { useLanguageStore } from '../src/i18n/store';

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

registerWorldCupMemoryCacheClear(() => memoryCache.clear());

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

function mergeWorldCupCalendarWithLiveFeed(
  calendar: Match[],
  liveFeed: Match[],
  leagueId: number,
): Match[] {
  const map = new Map<string, Match>();
  for (const row of calendar) {
    map.set(row.id, row);
  }
  for (const liveRow of liveFeed) {
    if (liveRow.status !== 'live') continue;
    if (liveRow.league?.id !== leagueId) continue;
    const existing = map.get(liveRow.id);
    map.set(
      liveRow.id,
      existing
        ? {
            ...existing,
            ...liveRow,
            status: 'live',
            score: liveRow.score,
            minute: liveRow.minute ?? existing.minute,
            elapsed: liveRow.elapsed ?? existing.elapsed,
            statusShort: liveRow.statusShort ?? existing.statusShort,
          }
        : liveRow,
    );
  }
  return Array.from(map.values());
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
  const appLang = useLanguageStore((s) => s.language);

  const liveFixtureIds = useMemo(
    () =>
      matches
        .filter((m) => m.status === 'live')
        .map((m) => parseInt(m.id, 10))
        .filter((id) => !Number.isNaN(id) && id > 0),
    [matches],
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

    const lang = appLang.startsWith('en') ? 'en' : 'ar';
    const memKey = `${dateString}:${lang}`;
    const mem = memoryCache.get(memKey);
    const ttl = TTL_IDLE_MS;
    if (!isToday && mem && mem.data.length > 0 && Date.now() - mem.ts < ttl) {
      setCalendarMatches(mem.data);
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    if (!hasDataRef.current) setLoading(true);
    setError(null);
    try {
      let list = await fetchWorldCupMatchesByDate(selectedDate, {
        skipDiskCache: true,
      });
      if (isToday) {
        const liveFeed = await fetchLiveMatches();
        list = mergeWorldCupCalendarWithLiveFeed(list, liveFeed, leagueId);
      }
      const liveNow = isToday && list.some((m) => m.status === 'live');
      if (liveNow && enrichCorners) {
        const now = Date.now();
        if (now - lastCornersFetchRef.current >= CORNERS_REFRESH_MS) {
          lastCornersFetchRef.current = now;
          list = await enrichLiveCorners(list);
        } else {
          const prev = memoryCache.get(memKey)?.data;
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
      memoryCache.set(memKey, { data: list, ts: Date.now() });
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
  }, [appLang, dateString, enabled, enrichCorners, isToday, leagueId, selectedDate]);

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
