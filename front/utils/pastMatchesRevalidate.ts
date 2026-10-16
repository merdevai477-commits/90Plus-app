/**
 * Policy for soft-refreshing historical match calendars.
 * Aligns with backend: yesterday stays "hot" (late kickoffs past midnight);
 * older past days revalidate only when the disk entry is missing or expired.
 */

import { dateFromLocalKey } from './safeDate';

/** Shift a YYYY-MM-DD key by N local calendar days. */
export function offsetLocalDateKey(dateKey: string, days: number): string {
  const d = dateFromLocalKey(dateKey);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Whether a past calendar day should trigger a background network refresh.
 * Non-past dates return false (today/future use their own refresh paths).
 */
export function shouldRevalidatePastCalendar(
  dateString: string,
  todayKey: string,
  cacheMeta: { isStale: boolean } | null,
): boolean {
  if (!(dateString < todayKey)) return false;
  const yesterdayKey = offsetLocalDateKey(todayKey, -1);
  if (dateString === yesterdayKey) return true;
  if (!cacheMeta) return true;
  return cacheMeta.isStale;
}
