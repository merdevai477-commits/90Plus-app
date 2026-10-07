import {
  localizeMatchVarDetail,
  normalizeSupportedLanguage,
  renderGoalScorePushBody,
  renderPushTemplate,
  extractLanguageFromSettings,
  readLanguageFromSettings,
  withEventMinute,
} from '../push-templates.service';

describe('push templates language', () => {
  it('normalizes locale tags to ar/en', () => {
    expect(normalizeSupportedLanguage('ar')).toBe('ar');
    expect(normalizeSupportedLanguage('ar-EG')).toBe('ar');
    expect(normalizeSupportedLanguage('en-US')).toBe('en');
    expect(normalizeSupportedLanguage('fr')).toBe('en');
    expect(normalizeSupportedLanguage('')).toBe('ar');
    expect(normalizeSupportedLanguage(undefined)).toBe('ar');
  });

  it('reads nested and missing User.settings language as Arabic by default', () => {
    expect(readLanguageFromSettings({})).toBe('ar');
    expect(readLanguageFromSettings({ language: 'en' })).toBe('en');
    expect(readLanguageFromSettings({ language: { current: 'ar' } })).toBe('ar');
    expect(readLanguageFromSettings({ language: { current: 'en-US' } })).toBe('en');
    expect(extractLanguageFromSettings({ i18n: { language: 'ar-EG' } })).toBe('ar-EG');
    expect(readLanguageFromSettings({ i18n: { language: 'ar-EG' } })).toBe('ar');
  });

  it('renders Arabic match templates without translating player names', () => {
    expect(renderPushTemplate('goalTitle', 'ar')).toContain('هدف');
    expect(renderPushTemplate('matchStartTitle', 'ar')).toContain('بدأت');
    expect(renderPushTemplate('fulltimeTitle', 'ar')).toContain('انتهت');
    expect(renderPushTemplate('halftimeTitle', 'ar')).toContain('استراحة');
    expect(renderPushTemplate('matchSecondHalfTitle', 'ar')).toContain('الشوط');
    expect(renderPushTemplate('matchRedCardTitle', 'ar')).toContain('حمراء');
    expect(renderPushTemplate('matchVarTitle', 'ar')).toContain('الفار');
    expect(
      renderPushTemplate('goalBody', 'ar', {
        player: 'Salah',
        team: 'Al Ahly',
        minute: 12,
      }),
    ).toContain('Salah');
    expect(
      renderGoalScorePushBody('ar', {
        scorer: 'Al Ahed',
        home: 'Al Ahed',
        away: 'Al Akhaa Al Ahli',
        homeScore: 4,
        awayScore: 0,
      }),
    ).toBe('Al Ahed 4-0 Al Akhaa Al Ahli');
    expect(
      renderGoalScorePushBody('en', {
        scorer: 'Salah',
        home: 'Al Ahly',
        away: 'Zamalek',
        homeScore: 1,
        awayScore: 0,
      }),
    ).toContain('Salah');
    expect(localizeMatchVarDetail('Goal cancelled', 'ar-EG')).toBe('إلغاء هدف');
  });

  it('brackets the scoring side in the goal score line', () => {
    const base = { scorer: 'Club Aurora', home: 'Club Aurora', away: 'Academia', homeScore: 2, awayScore: 0 };
    expect(renderGoalScorePushBody('en', { ...base, scoringSide: 'home' })).toBe('Club Aurora [2]-0 Academia');
    expect(renderGoalScorePushBody('ar', { ...base, scorer: 'Academia', homeScore: 1, awayScore: 1, scoringSide: 'away' })).toBe(
      'Club Aurora 1-[1] Academia',
    );
    expect(renderGoalScorePushBody('en', base)).toBe('Club Aurora 2-0 Academia');
  });

  it('puts the match minute beside the event title', () => {
    expect(withEventMinute('⚽ Goal!', 67, null, 'en')).toBe("⚽ Goal! 67'");
    expect(withEventMinute('⚽ Goal!', 90, 3, 'en')).toBe("⚽ Goal! 90+3'");
    expect(withEventMinute('⚽ هدف!', 67, null, 'ar')).toBe('⚽ هدف! الدقيقة 67');
    expect(withEventMinute('📺 مراجعة الفار', 45, 2, 'ar-EG')).toBe('📺 مراجعة الفار الدقيقة 45+2');
    expect(withEventMinute('⚽ Goal!', null, null, 'en')).toBe('⚽ Goal!');
  });
});
