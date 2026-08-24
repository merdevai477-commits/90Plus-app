import { calendarDateFromKickoff, calendarDateRangeBounds, toScores365QueryDate } from '../calendar-day-bounds.util';

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
