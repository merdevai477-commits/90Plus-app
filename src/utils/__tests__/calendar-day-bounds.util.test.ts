import {
  calendarDateFromKickoff,
  calendarDateRangeBounds,
  resolveRequestCalendarTimezone,
  sharesAppCalendarDay,
  toScores365QueryDate,
} from '../calendar-day-bounds.util';

describe('resolveRequestCalendarTimezone', () => {
  it('returns null for missing, invalid or app-zone values', () => {
    expect(resolveRequestCalendarTimezone(undefined)).toBeNull();
    expect(resolveRequestCalendarTimezone('')).toBeNull();
    expect(resolveRequestCalendarTimezone(['America/New_York'])).toBeNull();
    expect(resolveRequestCalendarTimezone('Not/AZone')).toBeNull();
    expect(resolveRequestCalendarTimezone('x; DROP TABLE')).toBeNull();
    expect(resolveRequestCalendarTimezone('Africa/Cairo')).toBeNull();
  });

  it('accepts real IANA zones', () => {
    expect(resolveRequestCalendarTimezone('America/New_York')).toBe('America/New_York');
    expect(resolveRequestCalendarTimezone(' Asia/Tokyo ')).toBe('Asia/Tokyo');
    expect(resolveRequestCalendarTimezone('UTC')).toBe('UTC');
  });
});

describe('sharesAppCalendarDay', () => {
  it('is true for zones on the Cairo offset that day and false otherwise', () => {
    expect(sharesAppCalendarDay('2026-10-08', 'Africa/Cairo')).toBe(true);
    expect(sharesAppCalendarDay('2026-10-08', 'Asia/Riyadh')).toBe(true);
    expect(sharesAppCalendarDay('2026-10-08', 'America/New_York')).toBe(false);
    expect(sharesAppCalendarDay('2026-10-08', 'Asia/Tokyo')).toBe(false);
  });
});

describe('calendarDateRangeBounds', () => {
  it('includes the complete final local calendar day', () => {
    const timezone = 'Africa/Cairo';
    const { start, end } = calendarDateRangeBounds('2026-07-20', '2026-07-21', timezone);

    expect(calendarDateFromKickoff(start.toISOString(), timezone)).toBe('2026-07-20');
    expect(calendarDateFromKickoff(end.toISOString(), timezone)).toBe('2026-07-21');
    expect(end.getTime() - start.getTime()).toBe(48 * 60 * 60 * 1000 - 1);
  });
});

describe('toScores365QueryDate', () => {
  it('converts ISO calendar keys to 365 DD/MM/YYYY query params', () => {
    expect(toScores365QueryDate('2026-08-24')).toBe('24/08/2026');
    expect(toScores365QueryDate('2026-08-26')).toBe('26/08/2026');
    expect(toScores365QueryDate('24/08/2026')).toBe('24/08/2026');
  });
});
