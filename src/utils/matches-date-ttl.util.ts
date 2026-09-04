/**
 * Treat a YYYY-MM-DD as "today" if it is the local calendar date in ANY
 * UTC offset from -12 to +14 (P2-8). Avoids client headers / spoofing while
 * ensuring eastern-timezone users get the short "today" TTL.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateTodayInAnyOffset(
  dateParam: string,
  now = new Date(),
): boolean {
  if (!DATE_RE.test(dateParam)) return false;

  for (let offsetHours = -12; offsetHours <= 14; offsetHours++) {
    const localMs = now.getTime() + offsetHours * 3_600_000;
    const local = new Date(localMs);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    if (`${y}-${m}-${d}` === dateParam) return true;
  }
  return false;
}

/** Past relative to the earliest "today" across offsets (UTC−12). */
export function isDatePastInAllOffsets(
  dateParam: string,
  now = new Date(),
): boolean {
  if (!DATE_RE.test(dateParam)) return false;
  // Earliest today key is at UTC−12.
  const earliestMs = now.getTime() + -12 * 3_600_000;
  const earliest = new Date(earliestMs);
  const y = earliest.getUTCFullYear();
  const m = String(earliest.getUTCMonth() + 1).padStart(2, '0');
  const d = String(earliest.getUTCDate()).padStart(2, '0');
  return dateParam < `${y}-${m}-${d}`;
}
