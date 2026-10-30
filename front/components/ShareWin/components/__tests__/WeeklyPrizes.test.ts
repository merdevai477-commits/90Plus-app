import { winnerBadge } from '../../data';
import { getCarouselPageCount } from '../carouselPagination';

describe('WeeklyPrizes helpers', () => {
  it('keeps carousel page math available for legacy callers', () => {
    expect(getCarouselPageCount(4)).toBe(2);
    expect(getCarouselPageCount(6)).toBe(2);
    expect(getCarouselPageCount(7)).toBe(3);
    expect(getCarouselPageCount(3)).toBe(1);
  });

  it('formats winner badges in Arabic and English', () => {
    expect(winnerBadge(0, 'ar')).toBe('الفائز الأول');
    expect(winnerBadge(1, 'ar')).toBe('الفائز الثاني');
    expect(winnerBadge(2, 'ar')).toBe('الفائز الثالث');
    expect(winnerBadge(0, 'en')).toBe('1st Winner');
    expect(winnerBadge(2, 'en')).toBe('3rd Winner');
  });
});
