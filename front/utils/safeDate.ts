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

export function safeFormatMatchTime(fixtureDate: string | null | undefined): string {
  const date = safeParseDate(fixtureDate);
  if (!date) return '--:--';
  try {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
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
