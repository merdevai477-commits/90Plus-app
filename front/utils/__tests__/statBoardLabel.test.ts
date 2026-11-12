import { statBoardLabel } from '../statBoardLabel';

describe('statBoardLabel', () => {
  it('replaces the Arabic and English 365 rating names on every platform', () => {
    expect(statBoardLabel({ name: 'تقييم 365', typeId: 36 }, 'ar', 'الهدافين')).toBe('تقييم 90plus');
    expect(statBoardLabel({ name: '365 Ratings', typeId: 36 }, 'en', 'Scorers')).toBe('90plus rating');
    expect(statBoardLabel({ name: '365 rating' }, 'ar', 'الهدافين')).toBe('تقييم 90plus');
  });

  it('leaves other boards unchanged', () => {
    expect(statBoardLabel({ name: 'بطاقات صفراء', typeId: 4 }, 'ar', 'الهدافين')).toBe('بطاقات صفراء');
    expect(statBoardLabel({ name: '', typeId: 1 }, 'ar', 'الهدافين')).toBe('الهدافين');
  });
});
