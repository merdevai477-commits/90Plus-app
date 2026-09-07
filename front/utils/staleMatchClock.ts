/**
 * Detect 365/API clocks that stay "in play" after the match is over.
 * Display clamps stoppage at 15, so a stuck `90+15'` is almost always FT.
 */

const REGULAR_MAX_STOPPAGE = 15;
/** 45 + ~15 HT + 45 + 20 stoppage — beyond this at 90'+, treat as finished. */
export const STALE_2H_AGE_MIN = 125;

export function isStaleInPlayClock(opts: {
  statusShort: string | null | undefined;
  elapsed?: number | null;
  extra?: number | null;
  kickoffIso?: string | null;
  nowMs?: number;
}): boolean {
  const s = (opts.statusShort ?? '').trim().toUpperCase();
  if (s !== '1H' && s !== '2H' && s !== 'LIVE') return false;

  const elapsed = opts.elapsed;
  const extra = opts.extra;

  if (s === '1H' && elapsed != null && elapsed > 60) return true;

  if (s === '2H' || s === 'LIVE') {
    if (elapsed != null && elapsed >= 90 + REGULAR_MAX_STOPPAGE) return true;
    if (elapsed != null && elapsed >= 90 && extra != null && extra >= REGULAR_MAX_STOPPAGE) {
      return true;
    }
  }

  if (!opts.kickoffIso) return false;
  const kick = Date.parse(opts.kickoffIso);
  if (!Number.isFinite(kick)) return false;
  const ageMin = ((opts.nowMs ?? Date.now()) - kick) / 60_000;

  // Only use wall-clock when the feed is already in second-half stoppage.
  // Delayed kickoffs stay 1H/early 2H long after the listed start time.
  if ((s === '2H' || s === 'LIVE') && ageMin >= STALE_2H_AGE_MIN && elapsed != null && elapsed >= 90) {
    return true;
  }
  return false;
}
