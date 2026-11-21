import { formatUpcomingMatchDayLabel } from '../safeDate';

describe('formatUpcomingMatchDayLabel', () => {
  it('returns null when kickoff is today', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0); // Sat 21 Nov 2026 local
    const kickoff = new Date(2026, 10, 21, 20, 0, 0).toISOString();
    expect(formatUpcomingMatchDayLabel(kickoff, 'ar', now)).toBeNull();
    expect(formatUpcomingMatchDayLabel(kickoff, 'en', now)).toBeNull();
  });

  it('returns weekday + DD/MM for a future day in Arabic', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0);
    const kickoff = new Date(2026, 10, 23, 20, 0, 0).toISOString(); // Mon 23 Nov
    expect(formatUpcomingMatchDayLabel(kickoff, 'ar', now)).toBe('الاثنين 23/11');
  });

  it('returns weekday + DD/MM for a future day in English', () => {
    const now = new Date(2026, 10, 21, 15, 0, 0);
    const kickoff = new Date(2026, 10, 23, 20, 0, 0).toISOString();
    expect(formatUpcomingMatchDayLabel(kickoff, 'en', now)).toBe('Monday 23/11');
  });

  it('returns null for invalid dates', () => {
    expect(formatUpcomingMatchDayLabel(undefined, 'ar')).toBeNull();
    expect(formatUpcomingMatchDayLabel('not-a-date', 'en')).toBeNull();
  });
});
