import {
  getCuratedArabicLeagueName,
  getLeagueArabicById,
  isAmbiguousLeagueName,
} from '../league-translations';

describe('league-translations', () => {
  it('looks up Arabic name by league id', () => {
    expect(getLeagueArabicById(425)).toBe('الدوري اللبناني');
    expect(getLeagueArabicById(39)).toBe('الدوري الإنجليزي الممتاز');
  });

  it('flags ambiguous league names', () => {
    expect(isAmbiguousLeagueName('Premier League')).toBe(true);
    expect(isAmbiguousLeagueName('UEFA Champions League')).toBe(false);
  });

  it('resolves curated names with country context', () => {
    expect(
      getCuratedArabicLeagueName('Premier League', { country: 'Kuwait' }),
    ).toBe('الدوري الكويتي');
  });

  it('does not guess English Premier League for ambiguous bare names', () => {
    expect(getCuratedArabicLeagueName('Premier League')).toBeNull();
  });

  it('resolves unambiguous names exactly', () => {
    expect(getCuratedArabicLeagueName('Saudi Pro League')).toBe('دوري روشن السعودي');
  });
});
