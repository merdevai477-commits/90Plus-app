/**
 * Detect 365/API clocks that stay "in play" after the match is over.
 * Thresholds sit past any real stoppage so a live 90+12 is never cut short —
 * stoppage-time goals must still reach the list. Keep in sync with the
 * backend `scores365-live-identity.util.ts`.
 */

/** Longest stoppage still treated as real play (45+14 / 90+13 happen). */
export const MAX_PLAUSIBLE_STOPPAGE = 20;
/** 15 late + 45+20 + 20 HT + 45+20 ≈ 165 — only beyond this is a 90'+ clock stuck. */
export const STALE_2H_AGE_MIN = 170;

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

  if (s === '1H' && elapsed != null && elapsed > 45 + MAX_PLAUSIBLE_STOPPAGE) return true;

  if (s === '2H' || s === 'LIVE') {
    if (elapsed != null && elapsed >= 90 + MAX_PLAUSIBLE_STOPPAGE) return true;
    if (elapsed != null && elapsed >= 90 && extra != null && extra >= MAX_PLAUSIBLE_STOPPAGE) {
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
