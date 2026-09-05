/**
 * Pure live MM:SS clock — no React Native imports so unit tests can run in node.
 *
 * Matches list, MatchHeader, and MatchChatTab all go through
 * `resolveLiveSecondsLabel` (re-exported from leagueApiUtils).
 */

import { logger } from '../../utils/logger';

/**
 * How far the local MM:SS clock may lead the last-known server `elapsed`
 * (integer minutes). Lower = tighter sync to 365Scores but more visible
 * pausing when upstream only refreshes every ~1–2 min. Higher = smoother
 * motion but more visible drift (the old 90s cap looked ~1 min fast).
 * 45s is a moderate step — 0 would freeze on every stale tick.
 *
 * Shared by matches list, MatchHeader, and MatchChatTab via
 * `resolveLiveSecondsLabel` — do not duplicate this number at call sites.
 */
export const MAX_LEAD_SEC = 45;

/** Throttle lead-cap logs so a 1Hz tick does not flood Metro/logcat. */
const LEAD_CAP_LOG_INTERVAL_MS = 15_000;
let lastLeadCapLogAt = 0;

function logLiveClockLeadCap(elapsedFloorSec: number, localSec: number): void {
  const nowMs = Date.now();
  if (nowMs - lastLeadCapLogAt < LEAD_CAP_LOG_INTERVAL_MS) return;
  lastLeadCapLogAt = nowMs;
  // Client-only: production `logger.debug` is Metro/__DEV__. Railway cannot
  // see this (the clock is not computed on the server). Use logcat / a debug
  // build to observe cap hits after a new native build.
  logger.debug(
    `[live-clock] hit MAX_LEAD_SEC=${MAX_LEAD_SEC} (elapsedFloor=${elapsedFloorSec}s local=${localSec}s). ` +
      '365 elapsed often stalls 60–120s, so a 45s cap will pause until the next elapsed tick.',
  );
}

function normalizeUnixSec(ts: number): number {
  return ts > 1_000_000_000_000 ? Math.floor(ts / 1000) : ts;
}

/** True when the match clock is in injury/stoppage time. */
export const isLiveStoppage = (
  statusShort: string | undefined | null,
  elapsed?: number | null,
  extra?: number | null,
): boolean => {
  const short = (statusShort ?? '').trim();
  const hasExtra = extra != null && extra > 0;
  if (short === '1H') return hasExtra || (elapsed != null && elapsed > 45);
  if (short === '2H' || short === 'LIVE') {
    return hasExtra || (elapsed != null && elapsed > 90);
  }
  if (short === 'ET') {
    return hasExtra || (elapsed != null && elapsed > 120);
  }
  return false;
};

/**
 * Map provider status (+ elapsed) to the half the ticking clock should use.
 * Scores365 often emits `LIVE` instead of `1H`/`2H` — treat it as a half
 * so MM:SS keeps running instead of freezing on a static `35'` label.
 */
export const normalizeClockPeriod = (
  statusShort: string | undefined | null,
  elapsed?: number | null,
): '1H' | '2H' | 'ET' | null => {
  const short = (statusShort ?? '').trim();
  if (short === '1H' || short === '2H' || short === 'ET') return short;
  if (short !== 'LIVE' && short !== 'INT') return null;
  if (elapsed == null || elapsed < 0) return '1H';
  if (elapsed > 90) return 'ET';
  if (elapsed > 45) return '2H';
  return '1H';
};

/**
 * Live "MM:SS" clock for in-play periods, computed locally from a **stable**
 * period start (from `useAnchoredPeriodStart` or real API `periods.*`).
 *
 * Does not synthesize from `elapsed` here — that would freeze at MM:00 on
 * every render. Callers must pass an anchored `startTimestamp`.
 *
 * Important: do NOT drop MM:SS when the local minute crosses 45/90 while the
 * API elapsed is still behind — that used to snap the UI back to a frozen
 * `35'` minute-only label mid first half.
 *
 * Also: never invent the *next* half. Providers often leave status as `LIVE`
 * with elapsed stuck at 45 through half-time; a free-running 1H anchor would
 * keep ticking into 60+ and look like a jump to the 65th minute.
 */
export const resolveLiveSecondsLabel = (
  statusShort: string | undefined | null,
  elapsed: number | null | undefined,
  options?: { startTimestamp?: number; extra?: number | null; nowSec?: number },
): string | undefined => {
  const period = normalizeClockPeriod(statusShort, elapsed);
  if (!period) return undefined;

  // Injury / stoppage time uses the minute-only `90+4'` label, not MM:SS.
  if (isLiveStoppage(statusShort, elapsed, options?.extra)) return undefined;
  // Also treat stoppage using the normalized period (LIVE → 1H/2H).
  if (isLiveStoppage(period, elapsed, options?.extra)) return undefined;

  if (options?.startTimestamp == null || !Number.isFinite(options.startTimestamp)) {
    return undefined;
  }

  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  const startSec = normalizeUnixSec(options.startTimestamp);
  const offsetMin = period === '2H' ? 45 : period === 'ET' ? 90 : 0;
  const intoPeriod = Math.max(0, now - startSec);
  let totalSeconds = intoPeriod + offsetMin * 60;

  // Allow a small lead over stale API elapsed so the clock still feels live,
  // but do not runaway minutes ahead while the provider is frozen (HT).
  if (elapsed != null && elapsed >= 0 && Number.isFinite(elapsed)) {
    const elapsedFloorSec = Math.floor(elapsed) * 60;
    const leadCapSec = elapsedFloorSec + MAX_LEAD_SEC;
    if (totalSeconds > leadCapSec) {
      logLiveClockLeadCap(elapsedFloorSec, totalSeconds);
      totalSeconds = leadCapSec;
    }
    totalSeconds = Math.max(totalSeconds, elapsedFloorSec);
  }

  // Hard stop at the end of this half until status/elapsed moves us on.
  const periodEndMin = period === '1H' ? 45 : period === '2H' ? 90 : 120;
  const periodEndSec = periodEndMin * 60;
  if (totalSeconds >= periodEndSec) {
    return `${periodEndMin}:00`;
  }

  const minute = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minute}:${String(seconds).padStart(2, '0')}`;
};
