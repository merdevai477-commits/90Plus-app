jest.mock('../../../services/predictions.service', () => ({ PredictionsService: {} }));
jest.mock('../../Matches/leagueApiUtils', () => ({ mapFixturesToMatches: () => [] }));
jest.mock('../../../data/leagues', () => ({ LEAGUES: [] }));

import { cairoTodayKey, fallbackKingCalendar } from '../shared';

describe('fallbackKingCalendar (Cairo Sun–Sat, same as the server)', () => {
  it('Sat 23:59 vs Sun 00:00 Cairo', () => {
    const sat = fallbackKingCalendar(new Date('2026-10-31T21:59:00.000Z'));
    const sun = fallbackKingCalendar(new Date('2026-10-31T22:00:00.000Z'));
    expect(sat).toEqual({
      today: '2026-10-31',
      days: ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'],
    });
    expect(sun.today).toBe('2026-11-01');
    expect(sun.days[0]).toBe('2026-11-01');
  });

  it('uses Cairo, not the device day, just after Cairo midnight', () => {
    // 22:30 UTC on Saturday is already Sunday in Cairo (UTC+2).
    expect(cairoTodayKey(new Date('2026-11-07T22:30:00.000Z'))).toBe('2026-11-08');
  });
});
