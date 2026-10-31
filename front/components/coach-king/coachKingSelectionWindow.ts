/**
 * King of Coaches weekly pick window (Africa/Cairo):
 * - Open Mon 00:00 → Sat 00:00 (Mon–Fri)
 * - Closed Sat → Mon; countdown targets the next Monday open
 */

const ZONE = 'Africa/Cairo';

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

type CairoParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function cairoParts(date: Date): CairoParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? '0' : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function cairoDateKey(date: Date): string {
  const p = cairoParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Calendar weekday in Cairo: 0 = Sun … 6 = Sat. */
function cairoWeekday(date: Date): number {
  const key = cairoDateKey(date);
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function zoneOffsetMs(at: Date): number {
  const p = cairoParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - at.getTime();
}

/** Midnight (00:00:00) on `YYYY-MM-DD` in Africa/Cairo, as a UTC Date. */
export function cairoMidnight(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  let utc = Date.UTC(y, m - 1, d, 12, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = zoneOffsetMs(new Date(utc));
    utc = Date.UTC(y, m - 1, d, 0, 0, 0) - offset;
  }
  return new Date(utc);
}

function addCairoDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function daysUntilWeekday(fromWeekday: number, targetWeekday: number): number {
  return (targetWeekday - fromWeekday + 7) % 7;
}

/**
 * Resolve the active pick window + countdown target.
 * Mon–Fri → countdown to Saturday 00:00 (lineup selection closes).
 * Sat–Sun → countdown to Monday 00:00 (selection opens).
 */
export function resolveCkSelectionWindow(now: Date = new Date()): CkSelectionWindow {
  const todayKey = cairoDateKey(now);
  const weekday = cairoWeekday(now);
  const open = weekday >= 1 && weekday <= 5;

  if (open) {
    const daysToSat = daysUntilWeekday(weekday, 6);
    const satKey = addCairoDays(todayKey, daysToSat === 0 ? 7 : daysToSat);
    const monKey = addCairoDays(satKey, -5); // this week's Monday
    const start = cairoMidnight(monKey);
    const end = cairoMidnight(satKey);
    return {
      phase: 'open',
      targetAt: end.toISOString(),
      windowStartAt: start.toISOString(),
      windowEndAt: end.toISOString(),
    };
  }

  const daysToMon = daysUntilWeekday(weekday, 1) || 7;
  const monKey = addCairoDays(todayKey, daysToMon);
  const satKey = addCairoDays(monKey, -2); // preceding Saturday
  const start = cairoMidnight(satKey);
  const end = cairoMidnight(monKey);
  return {
    phase: 'closed',
    targetAt: end.toISOString(),
    windowStartAt: start.toISOString(),
    windowEndAt: end.toISOString(),
  };
}

export function ckSelectionProgress(window: CkSelectionWindow, now: Date = new Date()): number {
  const start = new Date(window.windowStartAt).getTime();
  const end = new Date(window.windowEndAt).getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export function splitCkCountdown(remainingMs: number): { hours: string; minutes: string; seconds: string } {
  const safe = Math.max(0, Math.floor(remainingMs / 1000));
  const totalHours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Figma shows hours:minutes:seconds (no separate days box) — roll days into hours.
  return { hours: pad(totalHours), minutes: pad(minutes), seconds: pad(seconds) };
}
