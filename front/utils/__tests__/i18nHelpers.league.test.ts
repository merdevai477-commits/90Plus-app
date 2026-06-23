import { getLeagueDisplayName } from '../i18nHelpers';

describe('getLeagueDisplayName', () => {
  it('resolves English Premier League by id', () => {
    expect(getLeagueDisplayName('Premier League', 'ar', 39)).toBe('الدوري الإنجليزي الممتاز');
  });

  it('resolves Lebanese Premier League by id, not English', () => {
    expect(getLeagueDisplayName('Premier League', 'ar', 425)).toBe('الدوري اللبناني');
  });

  it('disambiguates Premier League by country when id is missing', () => {
    expect(getLeagueDisplayName('Premier League', 'ar', null, 'Lebanon')).toBe('الدوري اللبناني');
    expect(getLeagueDisplayName('Premier League', 'ar', null, 'England')).toBe('الدوري الإنجليزي الممتاز');
  });

  it('does not map ambiguous Premier League to English without id or country', () => {
    expect(getLeagueDisplayName('Premier League', 'ar')).toBe('Premier League');
  });

  it('disambiguates Ligue 1 by country', () => {
    expect(getLeagueDisplayName('Ligue 1', 'ar', null, 'Tunisia')).toBe('الدوري التونسي');
    expect(getLeagueDisplayName('Ligue 1', 'ar', null, 'Algeria')).toBe('الدوري الجزائري');
    expect(getLeagueDisplayName('Ligue 1', 'ar', null, 'France')).toBe('الدوري الفرنسي');
  });

  it('resolves unique competition names without id', () => {
    expect(getLeagueDisplayName('UEFA Champions League', 'ar')).toBe('دوري أبطال أوروبا');
    expect(getLeagueDisplayName('Egyptian Premier League', 'ar')).toBe('الدوري المصري الممتاز');
  });

  it('returns English name unchanged for en locale', () => {
    expect(getLeagueDisplayName('Premier League', 'en', 425)).toBe('Premier League');
  });
});
