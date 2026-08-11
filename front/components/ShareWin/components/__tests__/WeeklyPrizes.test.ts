import { getCarouselPageCount } from '../carouselPagination';

describe('WeeklyPrizes carousel pagination', () => {
  it('uses one dot per carousel page rather than one dot per gift', () => {
    expect(getCarouselPageCount(4)).toBe(2);
    expect(getCarouselPageCount(6)).toBe(2);
    expect(getCarouselPageCount(7)).toBe(3);
    expect(getCarouselPageCount(3)).toBe(1);
  });
});
