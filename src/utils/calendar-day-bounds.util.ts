import { fromZonedTime } from 'date-fns-tz';
import { sanitizeTimezone } from './chat-timezone';

const DEFAULT_CALENDAR_TZ =
  process.env.APP_CALENDAR_TIMEZONE ||
  process.env.SCORES365_TIMEZONE ||
  'Africa/Cairo';

/** Calendar YYYY-MM-DD for "now" in the app timezone (matches 365 grouping). */
export function calendarTodayKey(timezone = DEFAULT_CALENDAR_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Kickoff ISO → calendar day in the app timezone. */
export function calendarDateFromKickoff(
  startTime?: string | null,
  timezone = DEFAULT_CALENDAR_TZ,
): string | null {
  if (!startTime) return null;
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** UTC instants spanning one calendar day in the app timezone. */
export function calendarDayBounds(
  dateString: string,
  timezone = DEFAULT_CALENDAR_TZ,
): { start: Date; end: Date } {
  return {
    start: fromZonedTime(`${dateString}T00:00:00.000`, timezone),
    end: fromZonedTime(`${dateString}T23:59:59.999`, timezone),
  };
}

/** Inclusive UTC instants for a local/calendar date range. */
export function calendarDateRangeBounds(
  fromDateString: string,
  toDateString: string,
  timezone = DEFAULT_CALENDAR_TZ,
): { start: Date; end: Date } {
  const { start } = calendarDayBounds(fromDateString, timezone);
  const { end } = calendarDayBounds(toDateString, timezone);
  return { start, end };
}

export function getAppCalendarTimezone(): string {
  return DEFAULT_CALENDAR_TZ;
}

/** Client `tz` → IANA zone; null when absent, invalid, or already the app zone. */
export function resolveRequestCalendarTimezone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === DEFAULT_CALENDAR_TZ) return null;
  return sanitizeTimezone(trimmed) === trimmed ? trimmed : null;
}

/** True when `timezone`'s `dateString` covers the same instants as the app calendar day. */
export function sharesAppCalendarDay(dateString: string, timezone: string): boolean {
  const zoned = calendarDayBounds(dateString, timezone);
  const app = calendarDayBounds(dateString);
  return (
    zoned.start.getTime() === app.start.getTime() &&
    zoned.end.getTime() === app.end.getTime()
  );
}

/** Shift a calendar YYYY-MM-DD by `days` (UTC-safe arithmetic on the date parts). */
export function offsetCalendarDateKey(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * 365 `/web/games/allscores/` startDate/endDate are `DD/MM/YYYY`.
 * ISO `YYYY-MM-DD` is accepted as a different (much smaller) window with
 * almost no live games — do not send it on that endpoint.
 */
export function toScores365QueryDate(isoOrDmy: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoOrDmy.trim());
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return isoOrDmy;
}
