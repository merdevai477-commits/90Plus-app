/**
 * Live minute label shared by list cards and match-details header.
 * Pure helpers — no React Native / fetch imports (safe for unit tests).
 */

/** Cap announced / running stoppage minutes for display. */
const clampStoppage = (n: number): number => Math.min(Math.max(Math.floor(n), 1), 15);

/**
 * Build `45+2'` / `90+4'` / `120+3'` from period base, elapsed, and optional API `extra`.
 * Prefer elapsed overflow when the clock already advanced past the period end;
 * otherwise use `extra` when the feed keeps elapsed pinned at 45/90/120.
 */
export const formatStoppageMinute = (
  base: number,
  elapsed: number,
  extra?: number | null,
): string => {
  if (elapsed > base) return `${base}+${clampStoppage(elapsed - base)}'`;
  if (extra != null && extra > 0 && elapsed >= base) {
    return `${base}+${clampStoppage(extra)}'`;
  }
  return `${elapsed}'`;
};

/**
 * Live minute label shared by list cards and match-details header.
 * Always prefers clear stoppage form: `90+4'` / `45+2'` (not bare `90'`).
 */
export const formatLiveMinuteDisplay = (
  statusShort: string,
  elapsed: number | null | undefined,
  extra?: number | null,
): string | undefined => {
  const status = statusShort;
  if (status === 'FT' || status === 'AET') return undefined;
  if (status === 'PEN' || status === 'P') return undefined;
  if (status === 'HT') return 'HT';
  if (status === 'BT') return 'BT';

  if (status === 'ET' && elapsed != null) {
    if (elapsed > 120 || (elapsed >= 120 && extra != null && extra > 0)) {
      return `${formatStoppageMinute(120, elapsed, extra)} (ET)`;
    }
    if (elapsed > 90) return `${formatStoppageMinute(90, elapsed, extra)} (ET)`;
    return `${elapsed}' (ET)`;
  }

  if ((status === '1H' || status === '2H' || status === 'LIVE') && elapsed != null) {
    if (status === '1H' || (status === 'LIVE' && elapsed <= 45)) {
      return formatStoppageMinute(45, elapsed, status === '1H' || elapsed >= 45 ? extra : null);
    }
    return formatStoppageMinute(90, elapsed, extra);
  }

  return undefined;
};

/**
 * List-row minute: elapsed/status/extra win over a baked `minute` string.
 * Falls back to `minute` when the live formatter has nothing (P / missing clock).
 */
export function displayedListLiveMinute(args: {
  minute?: string | null;
  statusShort?: string | null;
  elapsed?: number | null;
  extra?: number | null;
}): string | undefined {
  return (
    formatLiveMinuteDisplay(args.statusShort ?? '', args.elapsed, args.extra) ??
    args.minute ??
    undefined
  );
}
