/**
 * chat-timezone.ts
 *
 * Timezone helpers for the chat daily rate-limiter. The user's daily
 * message bucket must reset at their local midnight — not the server's —
 * so a user in Cairo doesn't see their counter reset at 2am or 3am.
 *
 * Input comes from the `x-user-timezone` header (set by the frontend via
 * `expo-localization`). Untrusted timezones are rejected and fall back to UTC.
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Loose validation: an IANA timezone looks like `Region/City` or a known
 * abbreviation like `UTC` / `GMT`. Reject anything that doesn't match to
 * avoid feeding arbitrary strings into `Intl.DateTimeFormat`.
 */
const TZ_REGEX = /^(?:[A-Za-z_]+(?:\/[A-Za-z_0-9+-]+){0,2}|UTC|GMT|Z)$/;

export function sanitizeTimezone(raw: unknown): string {
    if (typeof raw !== 'string') return 'UTC';
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 64) return 'UTC';
    if (!TZ_REGEX.test(trimmed)) return 'UTC';
    try {
        // Will throw if the timezone isn't actually resolvable.
        new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
        return trimmed;
    } catch {
        return 'UTC';
    }
}

/** YYYY-MM-DD in the given timezone. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
    return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/**
 * UTC instant that corresponds to the start of the NEXT day (i.e. midnight)
 * in the user's timezone. Clients use this to render the countdown.
 *
 * Implementation: format "now" as YYYY-MM-DD in the TZ, bump the day via
 * plain ISO math, then parse "YYYY-MM-DDT00:00:00" as happening in that TZ
 * to get the real UTC instant. Avoids DST edge cases that plagued earlier
 * attempts based on UTC-offset arithmetic.
 */
export function nextMidnightInTimezone(timezone: string, now: Date = new Date()): Date {
    const todayLocal = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
    const [y, m, d] = todayLocal.split('-').map(Number);
    // Use UTC-based Date math so month rollover, leap years, etc. all work.
    const tomorrowDate = new Date(Date.UTC(y, m - 1, d + 1));
    const tomorrowLocal = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getUTCDate()).padStart(2, '0')}`;

    // `fromZonedTime` takes a wall-clock string and returns the matching UTC Date.
    return fromZonedTime(`${tomorrowLocal}T00:00:00`, timezone);
}
