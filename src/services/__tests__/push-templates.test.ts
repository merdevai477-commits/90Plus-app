import {
  localizeMatchVarDetail,
  normalizeSupportedLanguage,
  renderPushTemplate,
} from '../push-templates.service';

describe('push templates language', () => {
  it('normalizes locale tags to ar/en', () => {
    expect(normalizeSupportedLanguage('ar')).toBe('ar');
    expect(normalizeSupportedLanguage('ar-EG')).toBe('ar');
    expect(normalizeSupportedLanguage('en-US')).toBe('en');
    expect(normalizeSupportedLanguage('fr')).toBe('en');
  });

  it('renders Arabic match templates without translating player names', () => {
    expect(renderPushTemplate('goalTitle', 'ar')).toContain('هدف');
    expect(renderPushTemplate('matchStartTitle', 'ar')).toContain('بدأت');
    expect(renderPushTemplate('fulltimeTitle', 'ar')).toContain('انتهت');
    expect(renderPushTemplate('matchRedCardTitle', 'ar')).toContain('حمراء');
    expect(renderPushTemplate('matchVarTitle', 'ar')).toContain('الفار');
    expect(
      renderPushTemplate('goalScoreBody', 'ar', {
        scorer: 'Salah',
        home: 'Al Ahly',
        away: 'Zamalek',
        homeScore: 1,
        awayScore: 0,
      }),
    ).toContain('Salah');
    expect(localizeMatchVarDetail('Goal cancelled', 'ar-EG')).toBe('إلغاء هدف');
  });
});
