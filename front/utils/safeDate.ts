/**
 * Hermes-safe date helpers. Invalid or out-of-range dates throw
 * `RangeError: Date value out of bounds` on toISOString / toLocale*.
 */

export function safeParseDate(
  input: string | number | Date | null | undefined,
): Date | null {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function safeToISOString(
  input: string | number | Date | null | undefined,
): string {
  const d = safeParseDate(input);
  if (d) {
    try {
      return d.toISOString();
    } catch {
      /* fall through */
    }
  }
  return new Date().toISOString();
}

/**
 * Follow the device's 12/24-hour clock setting (not the app language locale).
 * Arabic locales often default to 24h in Intl even when the phone is set to 12h.
 */
export function deviceUses12HourClock(): boolean {
  try {
    // Lazy require so unit tests / Node can import other helpers without Expo natives.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as typeof import('expo-localization');
    const uses24 = Localization.getCalendars()[0]?.uses24hourClock;
    if (typeof uses24 === 'boolean') return !uses24;
  } catch {
    /* fall through */
  }
  try {
    const opts = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions();
    if (typeof opts.hour12 === 'boolean') return opts.hour12;
    if (opts.hourCycle === 'h11' || opts.hourCycle === 'h12') return true;
    if (opts.hourCycle === 'h23' || opts.hourCycle === 'h24') return false;
  } catch {
    /* fall through */
  }
  return false;
}

/** Kickoff / wall-clock time using the user's device 12/24h preference. */
export function safeFormatMatchTime(fixtureDate: string | null | undefined): string {
  const date = safeParseDate(fixtureDate);
  if (!date) return '--:--';
  try {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: deviceUses12HourClock(),
    });
  } catch {
    return '--:--';
  }
}

/**
 * Weekday + DD/MM for upcoming matches on a day other than today
 * (e.g. "الاثنين 23/11" / "Monday 23/11"). Returns null when kickoff is today
 * so the UI can keep the generic "Upcoming" label.
 */
export function formatUpcomingMatchDayLabel(
  fixtureDate: string | number | Date | null | undefined,
  language: string,
  now: Date = new Date(),
): string | null {
  const date = safeParseDate(fixtureDate);
  if (!date) return null;
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return null;
  }
  const locale = language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  let weekday = '';
  try {
    weekday = date.toLocaleDateString(locale, { weekday: 'long' });
  } catch {
    weekday = '';
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return weekday ? `${weekday} ${dd}/${mm}` : `${dd}/${mm}`;
}

/** Parse YYYY-MM-DD into local midnight without UTC drift. */
export function dateFromLocalKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((part) => parseInt(part, 10));
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}
