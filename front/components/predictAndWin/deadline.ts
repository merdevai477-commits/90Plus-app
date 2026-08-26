/**
 * Prediction-deadline arithmetic for the sponsor wizard's step 2.
 *
 * Kept out of the screen (and out of any `.tsx`) so the rules can be tested
 * directly. Two things go wrong easily here:
 *
 *  1. **Timezone.** The sponsor picks a wall clock in their own timezone. Going
 *     through `toISOString().slice(0, 10)` to name the day shifts it either
 *     side of UTC — a 01:00 close time in Cairo lands on the previous day, an
 *     evening one in New York on the next — and the competition then closes on
 *     a date nobody chose. Every day/time value here is built from local
 *     components.
 *  2. **The business rule.** The server rejects a deadline that is in the past
 *     or after kickoff (`INVALID_DEADLINE` / `DEADLINE_AFTER_KICKOFF`). The
 *     wizard enforces the same bounds so the sponsor is not told "no" only
 *     after filling in three more steps.
 */

export interface DeadlineParts {
  /** Calendar day chosen in the date picker; only Y/M/D are read. */
  date: Date | null;
  /** 12-hour clock as typed, e.g. `'9'` or `'09'`. */
  hour: string;
  minute: string;
  meridiem: 'am' | 'pm' | null;
}

/**
 * Combines the picked day with the 12-hour clock into a local instant, or
 * `null` when the form is incomplete or the digits are out of range.
 */
export function buildDeadline({ date, hour, minute, meridiem }: DeadlineParts): Date | null {
  if (!date || !hour || !minute || !meridiem) return null;

  const rawHour = Number.parseInt(hour, 10);
  const rawMinute = Number.parseInt(minute, 10);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return null;
  // 12-hour clock: 12 AM is midnight and 12 PM is noon, so `12` is legal and
  // `0` is not.
  if (rawHour < 1 || rawHour > 12 || rawMinute < 0 || rawMinute > 59) return null;

  let hours = rawHour % 12;
  if (meridiem === 'pm') hours += 12;

  const at = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    rawMinute,
    0,
    0,
  );
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Mirrors the server's gates: the close time must be in the future and no
 * later than kickoff.
 */
export function isDeadlineWithinBounds(
  deadline: Date | null,
  kickoff: Date | null,
  now: Date = new Date(),
): boolean {
  if (!deadline || !kickoff) return false;
  const at = deadline.getTime();
  return at > now.getTime() && at <= kickoff.getTime();
}

/** Midnight today, local — the earliest day a deadline may fall on. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Local midnight of the given date. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * `true` when a previously picked day can no longer hold a legal deadline for
 * this kickoff — the day starts after the match does. Switching to an earlier
 * match must clear such a date, otherwise the Next button sits disabled with
 * nothing on screen explaining why.
 */
export function isDayAfterKickoff(day: Date, kickoff: Date): boolean {
  return startOfDay(day).getTime() > kickoff.getTime();
}

/**
 * Local calendar-day key (`YYYY-MM-DD`) for `<input type="date">`.
 * `toISOString()` would report the UTC day, which is a different day for part
 * of every 24 hours.
 */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
