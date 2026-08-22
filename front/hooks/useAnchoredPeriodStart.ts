import { useRef } from 'react';
import {
  normalizeClockPeriod,
  synthesizePeriodStartSec,
} from '../components/Matches/leagueApiUtils';

type Anchor = {
  /** Normalized half: 1H | 2H | ET */
  period: '1H' | '2H' | 'ET';
  /** Last API elapsed used for re-anchor decisions. */
  elapsed: number | null;
  startSec: number;
};

/** Survives MatchHeader remounts (Pitch ↔ Score) and list cell recycling. */
const anchorsByKey = new Map<string, Anchor>();

function normalizeUnixSec(ts: number): number {
  return ts > 1_000_000_000_000 ? Math.floor(ts / 1000) : ts;
}

function localMinuteFromStart(
  period: '1H' | '2H' | 'ET',
  startSec: number,
  nowSec: number,
): number {
  const offsetMin = period === '2H' ? 45 : period === 'ET' ? 90 : 0;
  return Math.floor((nowSec - startSec) / 60) + offsetMin;
}

/**
 * Stable period-start unix seconds for the live MM:SS clock.
 *
 * - Real API `periods.*` timestamps win when present.
 * - Otherwise synthesize once per half and keep ticking so minutes advance
 *   even when API `elapsed` is stale (common mid first half).
 * - `LIVE`/`INT` map onto 1H/2H/ET from elapsed so the clock does not die.
 * - Anchor key is fixture id only (not raw status) so 1H↔LIVE flips keep time.
 */
export function useAnchoredPeriodStart(
  anchorKey: string | number | undefined | null,
  statusShort: string | undefined | null,
  elapsed: number | null | undefined,
  apiStartTimestamp?: number,
): number | undefined {
  const period = normalizeClockPeriod(statusShort, elapsed);
  const key =
    anchorKey != null && String(anchorKey).length > 0 ? String(anchorKey) : null;
  const localRef = useRef<Anchor | null>(null);

  if (!period) {
    // HT / BT / finished — keep stored anchor for when play resumes (2H).
    return apiStartTimestamp != null && Number.isFinite(apiStartTimestamp)
      ? normalizeUnixSec(apiStartTimestamp)
      : undefined;
  }

  // Authoritative period start from the provider — stable across renders.
  if (apiStartTimestamp != null && Number.isFinite(apiStartTimestamp)) {
    const startSec = normalizeUnixSec(apiStartTimestamp);
    const next: Anchor = { period, elapsed: elapsed ?? null, startSec };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
    return startSec;
  }

  if (elapsed == null || elapsed < 0) {
    const prev = (key ? anchorsByKey.get(key) : null) ?? localRef.current;
    if (prev && prev.period === period) return prev.startSec;
    return undefined;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const prev = (key ? anchorsByKey.get(key) : null) ?? localRef.current;

  // New half (1H→2H / →ET) — re-synthesize from elapsed for that period.
  if (!prev || prev.period !== period) {
    const startSec = synthesizePeriodStartSec(period, elapsed, nowSec);
    const next: Anchor = { period, elapsed, startSec };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
    return startSec;
  }

  const localMinute = localMinuteFromStart(period, prev.startSec, nowSec);

  // API jumped ahead of our ticking clock — catch up without freezing forever.
  if (elapsed > localMinute) {
    const startSec = synthesizePeriodStartSec(period, elapsed, nowSec);
    const next: Anchor = { period, elapsed, startSec };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
    return startSec;
  }

  if (prev.elapsed !== elapsed) {
    const next: Anchor = { ...prev, elapsed };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
  }

  return prev.startSec;
}
