import { calendarDateFromKickoff, calendarDateRangeBounds } from '../calendar-day-bounds.util';

describe('calendarDateRangeBounds', () => {
  it('includes the complete final local calendar day', () => {
    const timezone = 'Africa/Cairo';
    const { start, end } = calendarDateRangeBounds('2026-07-20', '2026-07-21', timezone);

    expect(calendarDateFromKickoff(start.toISOString(), timezone)).toBe('2026-07-20');
    expect(calendarDateFromKickoff(end.toISOString(), timezone)).toBe('2026-07-21');
    expect(end.getTime() - start.getTime()).toBe(48 * 60 * 60 * 1000 - 1);
  });
});
