/** Zone the backend uses to bucket fixtures into calendar days. */
const APP_CALENDAR_TIMEZONE = 'Africa/Cairo';

const ZONE_RECHECK_MS = 60_000;
let cachedZone: string | null = null;
let cachedAt = 0;

function deviceTimezone(): string | null {
  const now = Date.now();
  if (cachedAt && now - cachedAt < ZONE_RECHECK_MS) return cachedZone;
  let zone: string | null;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    zone = null;
  }
  const changed = cachedAt !== 0 && zone !== cachedZone;
  cachedZone = zone;
  cachedAt = now;
  if (changed) zoneListeners.forEach((listener) => listener());
  return cachedZone;
}

const zoneListeners = new Set<() => void>();

/** Fires when the device zone changes mid-session (in-memory day lists become wrong). */
export function onCalendarTimezoneChange(listener: () => void): () => void {
  zoneListeners.add(listener);
  return () => zoneListeners.delete(listener);
}

/**
 * Device zone to send as `tz` on day-list requests; null when it is the app zone,
 * so most users keep sharing one server cache entry per day.
 */
export function getCalendarTzParam(): string | null {
  const zone = deviceTimezone();
  return zone && zone !== APP_CALENDAR_TIMEZONE ? zone : null;
}

export function appendCalendarTzQuery(url: string): string {
  const tz = getCalendarTzParam();
  if (!tz) return url;
  return `${url}${url.includes('?') ? '&' : '?'}tz=${encodeURIComponent(tz)}`;
}

/** Day lists differ per zone, so cached copies are keyed by zone too. */
export function calendarStorageKey(dateString: string): string {
  const tz = getCalendarTzParam();
  return tz ? `${dateString}@${tz}` : dateString;
}
