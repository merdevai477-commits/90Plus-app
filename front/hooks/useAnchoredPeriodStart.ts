import { useRef } from 'react';
import { synthesizePeriodStartSec } from '../components/Matches/leagueApiUtils';

type Anchor = {
  short: string;
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
  short: string,
  startSec: number,
  nowSec: number,
): number {
  const offsetMin = short === '2H' ? 45 : short === 'ET' ? 90 : 0;
  return Math.floor((nowSec - startSec) / 60) + offsetMin;
}

/**
 * Stable period-start unix seconds for the live MM:SS clock.
 *
 * - Real API `periods.*` timestamps win when present.
 * - Otherwise synthesize once and keep the same start so seconds tick and
 *   minutes can advance between slow API elapsed updates.
 * - Re-anchor only when API elapsed jumps ahead of the local clock (catch-up),
 *   never on every render / every second.
 */
export function useAnchoredPeriodStart(
  anchorKey: string | number | undefined | null,
  statusShort: string | undefined | null,
  elapsed: number | null | undefined,
  apiStartTimestamp?: number,
): number | undefined {
  const short = (statusShort ?? '').trim();
  const key =
    anchorKey != null && String(anchorKey).length > 0
      ? `${String(anchorKey)}:${short || 'x'}`
      : null;
  const localRef = useRef<Anchor | null>(null);

  if (short !== '1H' && short !== '2H' && short !== 'ET') {
    if (key) anchorsByKey.delete(key);
    localRef.current = null;
    return apiStartTimestamp != null && Number.isFinite(apiStartTimestamp)
      ? normalizeUnixSec(apiStartTimestamp)
      : undefined;
  }

  // Authoritative period start from the provider — stable across renders.
  if (apiStartTimestamp != null && Number.isFinite(apiStartTimestamp)) {
    const startSec = normalizeUnixSec(apiStartTimestamp);
    const next: Anchor = { short, elapsed: elapsed ?? null, startSec };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
    return startSec;
  }

  if (elapsed == null || elapsed < 0) {
    return (key ? anchorsByKey.get(key) : null)?.startSec ?? localRef.current?.startSec;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const prev = (key ? anchorsByKey.get(key) : null) ?? localRef.current;

  if (!prev || prev.short !== short) {
    const startSec = synthesizePeriodStartSec(short, elapsed, nowSec);
    const next: Anchor = { short, elapsed, startSec };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
    return startSec;
  }

  const localMinute = localMinuteFromStart(short, prev.startSec, nowSec);

  // API jumped ahead of our ticking clock — catch up without freezing forever.
  if (elapsed > localMinute) {
    const startSec = synthesizePeriodStartSec(short, elapsed, nowSec);
    const next: Anchor = { short, elapsed, startSec };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
    return startSec;
  }

  // Remember latest elapsed for debugging / future policy; keep startSec.
  if (prev.elapsed !== elapsed) {
    const next: Anchor = { ...prev, elapsed };
    localRef.current = next;
    if (key) anchorsByKey.set(key, next);
  }

  return prev.startSec;
}
