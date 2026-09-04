import {
  isDatePastInAllOffsets,
  isDateTodayInAnyOffset,
} from '../matches-date-ttl.util';

describe('matches-date-ttl.util (P2-8)', () => {
  // Early UTC morning so UTC−12 is still on the previous calendar day.
  const morningUtc = new Date('2026-09-04T06:00:00.000Z');
  // Late UTC evening so UTC+14 is already on the next calendar day.
  const eveningUtc = new Date('2026-09-04T18:00:00.000Z');

  it('treats the UTC calendar date as today', () => {
    expect(isDateTodayInAnyOffset('2026-09-04', morningUtc)).toBe(true);
  });

  it('treats the previous day as today while western offsets still see it', () => {
    expect(isDateTodayInAnyOffset('2026-09-03', morningUtc)).toBe(true);
  });

  it('treats the next day as today while eastern offsets already see it', () => {
    expect(isDateTodayInAnyOffset('2026-09-05', eveningUtc)).toBe(true);
  });

  it('does not treat far-past or far-future as today', () => {
    expect(isDateTodayInAnyOffset('2026-09-01', morningUtc)).toBe(false);
    expect(isDateTodayInAnyOffset('2026-09-10', eveningUtc)).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(isDateTodayInAnyOffset('09-04-2026', morningUtc)).toBe(false);
    expect(isDatePastInAllOffsets('not-a-date', morningUtc)).toBe(false);
  });

  it('marks dates before the earliest offset today as past', () => {
    expect(isDatePastInAllOffsets('2026-09-02', morningUtc)).toBe(true);
    // 2026-09-03 is still "today" at UTC−12 for morningUtc
    expect(isDatePastInAllOffsets('2026-09-03', morningUtc)).toBe(false);
    expect(isDatePastInAllOffsets('2026-09-04', morningUtc)).toBe(false);
  });

  it('routes TTL buckets: past → 24h, today-union → 60s, else → 5min', () => {
    const pick = (date: string, now: Date) => {
      if (isDatePastInAllOffsets(date, now)) return '24h';
      if (isDateTodayInAnyOffset(date, now)) return '60s';
      return '5min';
    };
    expect(pick('2026-09-01', morningUtc)).toBe('24h');
    expect(pick('2026-09-03', morningUtc)).toBe('60s');
    expect(pick('2026-09-04', morningUtc)).toBe('60s');
    expect(pick('2026-09-05', eveningUtc)).toBe('60s');
    expect(pick('2026-09-10', eveningUtc)).toBe('5min');
  });
});
