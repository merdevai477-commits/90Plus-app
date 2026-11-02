/**
 * King of Coaches weekly pick window.
 * Matches the server gameweek: Tuesday 00:00 UTC → next Tuesday 00:00 UTC.
 * Picks stay open for the whole window. The countdown targets that Tuesday close
 * so Monday never shows a 100+ hour Saturday timer.
 */

export type CkSelectionPhase = 'open' | 'closed';

export type CkSelectionWindow = {
  phase: CkSelectionPhase;
  /** ISO target the countdown ticks toward. */
  targetAt: string;
  /** Window start for the progress bar (ISO). */
  windowStartAt: string;
  /** Window end (= targetAt) for the progress bar (ISO). */
  windowEndAt: string;
};

const DAY_MS = 86_400_000;
/** Same anchor as the server gameweek (`tsfGameweekWindow`): Tuesday 00:00 UTC. */
const WINDOW_START_UTC_DAY = 2;

/**
 * Resolve the active pick window + countdown target.
 * Always open until the next Tuesday 00:00 UTC, which is when this gameweek ends.
 */
export function resolveCkSelectionWindow(now: Date = new Date()): CkSelectionWindow {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const offset = (now.getUTCDay() - WINDOW_START_UTC_DAY + 7) % 7;
  const startAt = new Date(midnight - offset * DAY_MS);
  const endAt = new Date(startAt.getTime() + 7 * DAY_MS);
  return {
    phase: 'open',
    targetAt: endAt.toISOString(),
    windowStartAt: startAt.toISOString(),
    windowEndAt: endAt.toISOString(),
  };
}

export function ckSelectionProgress(window: CkSelectionWindow, now: Date = new Date()): number {
  const start = new Date(window.windowStartAt).getTime();
  const end = new Date(window.windowEndAt).getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export function splitCkCountdown(remainingMs: number): {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  showDays: boolean;
} {
  const safe = Math.max(0, Math.floor(remainingMs / 1000));
  const totalHours = Math.floor(safe / 3600);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    days: String(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
    showDays: days > 0,
  };
}
