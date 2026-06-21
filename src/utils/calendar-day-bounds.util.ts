import { fromZonedTime } from 'date-fns-tz';

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

export function getAppCalendarTimezone(): string {
  return DEFAULT_CALENDAR_TZ;
}

/** Shift a calendar YYYY-MM-DD by `days` (UTC-safe arithmetic on the date parts). */
export function offsetCalendarDateKey(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
