export const getCarouselPageCount = (totalPrizes: number, visibleCount = 3) => {
  if (totalPrizes <= 0) return 0;
  return Math.ceil(totalPrizes / visibleCount);
};
