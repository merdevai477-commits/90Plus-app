import {
  CK_EMPTY_STATS,
  CK_PRICE_BANDS,
  ckClubTier,
  ckCoachPrice,
  ckParseStatValue,
  ckPricePool,
  type CkPriceInput,
} from '../coach-king-pricing';

function fwd(key: number, goals: number, rating: number | null, clubTier = 0.5, star = false): CkPriceInput {
  return { key, line: 'FWD', stats: { ...CK_EMPTY_STATS, goals, rating }, clubTier, star };
}

describe('coach king pricing', () => {
  it('puts only the best forward on the 12M ceiling and ranks the rest by output', () => {
    const prices = ckPricePool([
      fwd(1, 14, 8.1, 1, true),
      fwd(2, 6, 7.2, 0.8),
      fwd(3, 2, 6.6, 0.3),
      fwd(4, 0, null, 0.1),
    ]);
    expect(prices.get(1)).toBe(120);
    expect(prices.get(2)!).toBeLessThan(120);
    expect(prices.get(2)!).toBeGreaterThan(prices.get(3)!);
    expect(prices.get(3)!).toBeGreaterThan(prices.get(4)!);
    expect(prices.get(4)!).toBeGreaterThanOrEqual(CK_PRICE_BANDS.FWD[0]);
  });

  it('keeps each line inside its own band', () => {
    const prices = ckPricePool([
      { key: 1, line: 'GK', stats: { ...CK_EMPTY_STATS, cleanSheets: 5, saves: 3, rating: 7.4 }, clubTier: 1, star: true },
      { key: 2, line: 'DEF', stats: { ...CK_EMPTY_STATS, tackles: 2, interceptions: 2, rating: 7.5 }, clubTier: 1, star: true },
      { key: 3, line: 'MID', stats: { ...CK_EMPTY_STATS, goals: 4, assists: 5, rating: 7.8 }, clubTier: 1, star: true },
    ]);
    expect(prices.get(1)).toBe(CK_PRICE_BANDS.GK[1]);
    expect(prices.get(2)).toBe(CK_PRICE_BANDS.DEF[1]);
    expect(prices.get(3)).toBe(CK_PRICE_BANDS.MID[1]);
    for (const price of prices.values()) expect(price).toBeLessThanOrEqual(120);
  });

  it('prices every coach at 5M and reads 365 stat strings', () => {
    expect(ckCoachPrice(ckClubTier(1, 20))).toBe(50);
    expect(ckCoachPrice(ckClubTier(20, 20))).toBe(50);
    expect(ckCoachPrice()).toBe(CK_PRICE_BANDS.COACH[0]);
    expect(ckClubTier(null, 20)).toBe(0.5);
    expect(ckParseStatValue('7.7')).toBe(7.7);
    expect(ckParseStatValue('0/2')).toBe(0);
    expect(ckParseStatValue(undefined)).toBe(0);
  });
});
