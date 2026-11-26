import { getLocalizedEventLabel, localizeMatchVarDetail } from '../i18nHelpers';

describe('localizeMatchVarDetail', () => {
  it('maps common VAR details to Arabic football terms', () => {
    expect(localizeMatchVarDetail('Goal cancelled', 'ar')).toBe('إلغاء هدف');
    expect(localizeMatchVarDetail('Goal Disallowed - Offside', 'ar')).toBe(
      'هدف غير محتسب — تسلل',
    );
    expect(localizeMatchVarDetail('Penalty confirmed', 'ar')).toBe('تأكيد ركلة الجزاء');
    expect(localizeMatchVarDetail('Card upgrade', 'ar')).toBe('ترقية البطاقة');
  });

  it('keeps English details for English UI', () => {
    expect(localizeMatchVarDetail('Goal cancelled', 'en')).toBe('Goal cancelled');
  });
});

describe('getLocalizedEventLabel', () => {
  it('uses تقنية الفيديو for VAR in Arabic', () => {
    expect(getLocalizedEventLabel('Var', '', 'ar')).toBe('تقنية الفيديو');
    expect(getLocalizedEventLabel('var', 'Goal cancelled', 'ar')).toBe(
      'تقنية الفيديو — إلغاء هدف',
    );
  });

  it('uses football terminology for goals and cards in Arabic', () => {
    expect(getLocalizedEventLabel('Goal', 'Normal Goal', 'ar')).toBe('هدف');
    expect(getLocalizedEventLabel('Goal', 'Own Goal', 'ar')).toBe('هدف عكسي');
    expect(getLocalizedEventLabel('Goal', 'Penalty', 'ar')).toBe('هدف من ركلة جزاء');
    expect(getLocalizedEventLabel('Goal', 'Missed Penalty', 'ar')).toBe('ركلة جزاء مهدرة');
    expect(getLocalizedEventLabel('Card', 'Yellow Card', 'ar')).toBe('بطاقة صفراء');
    expect(getLocalizedEventLabel('Card', 'Second Yellow card', 'ar')).toBe('إنذار ثانٍ');
    expect(getLocalizedEventLabel('Card', 'Red Card', 'ar')).toBe('بطاقة حمراء');
  });
});
