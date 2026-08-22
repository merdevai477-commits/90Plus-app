import { useRef } from 'react';
import { synthesizePeriodStartSec } from '../components/Matches/leagueApiUtils';

/**
 * Stable period-start unix seconds for the live MM:SS clock.
 * Prefers API `periods.*`; when missing (Scores365), synthesizes from elapsed
 * and re-anchors only when elapsed or status changes so seconds tick smoothly.
 */
export function useAnchoredPeriodStart(
  statusShort: string | undefined | null,
  elapsed: number | null | undefined,
  apiStartTimestamp?: number,
): number | undefined {
  const short = (statusShort ?? '').trim();
  const anchorRef = useRef<{
    short: string;
    elapsed: number | null;
    startSec: number;
  } | null>(null);

  if (short !== '1H' && short !== '2H' && short !== 'ET') {
    anchorRef.current = null;
    return apiStartTimestamp;
  }

  if (apiStartTimestamp != null && Number.isFinite(apiStartTimestamp)) {
    const startSec =
      apiStartTimestamp > 1_000_000_000_000
        ? Math.floor(apiStartTimestamp / 1000)
        : apiStartTimestamp;
    anchorRef.current = {
      short,
      elapsed: elapsed ?? null,
      startSec,
    };
    return startSec;
  }

  if (elapsed == null || elapsed < 0) {
    return anchorRef.current?.startSec;
  }

  const prev = anchorRef.current;
  if (!prev || prev.short !== short || prev.elapsed !== elapsed) {
    const startSec = synthesizePeriodStartSec(short, elapsed);
    anchorRef.current = { short, elapsed, startSec };
    return startSec;
  }

  return prev.startSec;
}
