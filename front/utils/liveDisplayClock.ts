/**
 * Presentation-only live MM:SS clock.
 * Canonical elapsed/status/score live in the server pipeline — this file
 * never writes Match objects, Zustand, or network.
 *
 * Enable with EXPO_PUBLIC_LIVE_CLOCK_SECONDS=1 (preview/dev). Production default: off.
 */

import { formatLiveMinuteDisplay } from './formatLiveMinuteDisplay';
import { isLiveStoppage } from '../components/Matches/liveMatchClock';

/** Instant rollback without env or live-data pipeline changes. */
export const LIVE_CLOCK_SECONDS_HARD_OFF = false;

const LIVE_CLOCK_LOG =
  process.env.EXPO_PUBLIC_LIVE_CLOCK_LOG === '1' ||
  process.env.EXPO_PUBLIC_LIVE_CLOCK_LOG === 'true';

export function isLiveClockSecondsEnabled(): boolean {
  if (LIVE_CLOCK_SECONDS_HARD_OFF) return false;
  return (
    process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS === '1' ||
    process.env.EXPO_PUBLIC_LIVE_CLOCK_SECONDS === 'true'
  );
}

export type LiveDisplayClockInput = {
  fixtureId: string;
  statusShort?: string | null;
  elapsed?: number | null;
  extra?: number | null;
  fallbackLabel: string;
};

export type LiveDisplayClockMode = 'tick' | 'frozen' | 'fallback';

export type LiveDisplayClockResult = {
  label: string;
  ticking: boolean;
  mode: LiveDisplayClockMode;
  displaySeconds: number | null;
  reanchorReason?: string;
};

function normalizeStatus(statusShort?: string | null): string {
  return (statusShort ?? '').trim().toUpperCase();
}

function periodCapSeconds(status: string, elapsed: number | null | undefined): number | null {
  if (status === '1H' || (status === 'LIVE' && (elapsed == null || elapsed <= 45))) {
    return 45 * 60;
  }
  if (status === '2H' || status === 'LIVE') {
    return 90 * 60;
  }
  return null;
}

export function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minute = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minute}:${String(seconds).padStart(2, '0')}`;
}

export function liveDisplayClockIdentity(input: {
  fixtureId: string;
  statusShort?: string | null;
  elapsed?: number | null;
  extra?: number | null;
}): string {
  return `${input.fixtureId}|${normalizeStatus(input.statusShort)}|${input.elapsed ?? ''}|${input.extra ?? ''}`;
}

export function nextLiveDisplayAnchorMs(args: {
  identity: string;
  prevIdentity: string | null;
  prevAnchorMs: number | null;
  nowMs: number;
}): { anchorMs: number; reanchored: boolean; reason: string | null } {
  if (args.prevIdentity == null || args.prevAnchorMs == null) {
    return { anchorMs: args.nowMs, reanchored: true, reason: 'init' };
  }
  if (args.identity !== args.prevIdentity) {
    return { anchorMs: args.nowMs, reanchored: true, reason: 'identity' };
  }
  return { anchorMs: args.prevAnchorMs, reanchored: false, reason: null };
}

export function liveDisplayClockShouldTick(input: {
  statusShort?: string | null;
  elapsed?: number | null;
  extra?: number | null;
}): boolean {
  const status = normalizeStatus(input.statusShort);
  if (status === 'HT' || status === 'BT') return false;
  if (status === 'FT' || status === 'AET' || status === 'P' || status === 'PEN') return false;
  if (status === 'INT' || status === 'SUSP') return false;
  if (status === 'ET') return false;
  if (input.elapsed == null || !Number.isFinite(input.elapsed) || input.elapsed < 0) {
    return false;
  }
  if (isLiveStoppage(status, input.elapsed, input.extra)) return false;
  return status === '1H' || status === '2H' || status === 'LIVE';
}

export function logLiveClock(fields: Record<string, unknown>): void {
  if (!LIVE_CLOCK_LOG) return;
  console.info(
    JSON.stringify({
      tag: 'LIVE-CLOCK',
      t: new Date().toISOString(),
      ...fields,
    }),
  );
}

/**
 * Derive a display label from canonical server fields + wall clock.
 * `anchorMs` must reset whenever `liveDisplayClockIdentity` changes.
 */
export function resolveLiveDisplayClock(
  input: LiveDisplayClockInput & { nowMs: number; anchorMs: number },
): LiveDisplayClockResult {
  const status = normalizeStatus(input.statusShort);

  if (status === 'HT') {
    return { label: 'HT', ticking: false, mode: 'frozen', displaySeconds: null };
  }
  if (status === 'BT') {
    return { label: 'BT', ticking: false, mode: 'frozen', displaySeconds: null };
  }

  if (
    status === 'FT' ||
    status === 'AET' ||
    status === 'P' ||
    status === 'PEN' ||
    status === 'INT' ||
    status === 'SUSP'
  ) {
    return {
      label: input.fallbackLabel,
      ticking: false,
      mode: 'fallback',
      displaySeconds: null,
    };
  }

  if (status === 'ET' || isLiveStoppage(status, input.elapsed, input.extra)) {
    const stoppage =
      formatLiveMinuteDisplay(status, input.elapsed, input.extra) ?? input.fallbackLabel;
    return {
      label: stoppage,
      ticking: false,
      mode: 'fallback',
      displaySeconds: null,
    };
  }

  if (!liveDisplayClockShouldTick(input)) {
    return {
      label: input.fallbackLabel,
      ticking: false,
      mode: 'fallback',
      displaySeconds: null,
    };
  }

  const elapsedMin = Math.floor(input.elapsed as number);
  const baseSeconds = elapsedMin * 60;
  const deltaSec = Math.max(0, Math.floor((input.nowMs - input.anchorMs) / 1000));
  let totalSeconds = baseSeconds + deltaSec;

  const cap = periodCapSeconds(status, input.elapsed);
  if (cap != null && totalSeconds > cap) {
    totalSeconds = cap;
  }

  return {
    label: formatMmSs(totalSeconds),
    ticking: totalSeconds < (cap ?? Number.POSITIVE_INFINITY),
    mode: 'tick',
    displaySeconds: totalSeconds,
  };
}
