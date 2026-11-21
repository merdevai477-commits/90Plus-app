import { formatUpcomingMatchDayLabel } from '../safeDate';

describe('formatUpcomingMatchDayLabel', () => {
  it('returns Today/اليوم when kickoff is today', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0); // Sat 21 Nov 2026 local
    const kickoff = new Date(2026, 10, 21, 20, 0, 0).toISOString();
    expect(formatUpcomingMatchDayLabel(kickoff, 'ar', now)).toBe('اليوم');
    expect(formatUpcomingMatchDayLabel(kickoff, 'en', now)).toBe('Today');
  });

  it('returns Tomorrow/غداً when kickoff is tomorrow', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0);
    const kickoff = new Date(2026, 10, 22, 20, 0, 0).toISOString(); // Sun 22 Nov
    expect(formatUpcomingMatchDayLabel(kickoff, 'ar', now)).toBe('غداً');
    expect(formatUpcomingMatchDayLabel(kickoff, 'en', now)).toBe('Tomorrow');
  });

  it('uses custom today/tomorrow labels when provided', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0);
    const todayKick = new Date(2026, 10, 21, 20, 0, 0).toISOString();
    const tomorrowKick = new Date(2026, 10, 22, 20, 0, 0).toISOString();
    expect(
      formatUpcomingMatchDayLabel(todayKick, 'en', now, { today: 'TODAY' }),
    ).toBe('TODAY');
    expect(
      formatUpcomingMatchDayLabel(tomorrowKick, 'en', now, { tomorrow: 'TMW' }),
    ).toBe('TMW');
  });

  it('returns weekday + DD/MM for a later day in Arabic', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0);
    const kickoff = new Date(2026, 10, 23, 20, 0, 0).toISOString(); // Mon 23 Nov
    expect(formatUpcomingMatchDayLabel(kickoff, 'ar', now)).toBe('الاثنين 23/11');
  });

  it('returns weekday + DD/MM for a later day in English', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0);
    const kickoff = new Date(2026, 10, 23, 20, 0, 0).toISOString();
    expect(formatUpcomingMatchDayLabel(kickoff, 'en', now)).toBe('Monday 23/11');
  });

  it('returns null for invalid dates', () => {
    expect(formatUpcomingMatchDayLabel(undefined, 'ar')).toBeNull();
    expect(formatUpcomingMatchDayLabel('not-a-date', 'en')).toBeNull();
  });
});
