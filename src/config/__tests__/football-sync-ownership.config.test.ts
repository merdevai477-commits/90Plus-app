import { areLegacyOtherLeagueApiJobsEnabled } from '../football-sync-ownership.config';

describe('football sync ownership defaults', () => {
  it('keeps duplicate other-league API-Football jobs disabled by default', () => {
    expect(areLegacyOtherLeagueApiJobsEnabled({})).toBe(false);
  });

  it.each(['true', 'TRUE', '1'])('supports explicit rollback opt-in with %s', (value) => {
    expect(
      areLegacyOtherLeagueApiJobsEnabled({
        OTHER_LEAGUES_API_FOOTBALL_JOBS_ENABLED: value,
      }),
    ).toBe(true);
  });

  it.each(['false', '0', '', 'yes'])('does not enable duplicate jobs with %s', (value) => {
    expect(
      areLegacyOtherLeagueApiJobsEnabled({
        OTHER_LEAGUES_API_FOOTBALL_JOBS_ENABLED: value,
      }),
    ).toBe(false);
  });
});
