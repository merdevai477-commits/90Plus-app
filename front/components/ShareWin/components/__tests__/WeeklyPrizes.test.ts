import { monthBadge } from '../../data';
import { getCarouselPageCount } from '../carouselPagination';

describe('WeeklyPrizes helpers', () => {
  it('keeps carousel page math available for legacy callers', () => {
    expect(getCarouselPageCount(4)).toBe(2);
    expect(getCarouselPageCount(6)).toBe(2);
    expect(getCarouselPageCount(7)).toBe(3);
    expect(getCarouselPageCount(3)).toBe(1);
  });

  it('formats month badges in Arabic and English', () => {
    expect(monthBadge(0, 'ar')).toBe('الشهر الأول');
    expect(monthBadge(1, 'ar')).toBe('الشهر الثاني');
    expect(monthBadge(2, 'en')).toBe('Month 3');
  });
});
