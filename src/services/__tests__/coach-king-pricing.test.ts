import {
  CK_EMPTY_STATS,
  CK_PLAYER_CAP_MILLI,
  CK_PLAYER_FLOOR_MILLI,
  CK_PLAYER_MID_MILLI,
  CK_PRICE_BANDS,
  CK_PRICE_TIERS_MILLI,
  ckClubTier,
  ckCoachPrice,
  ckParseStatValue,
  ckPriceFromScore,
  ckPricePool,
  type CkPriceInput,
} from '../coach-king-pricing';

function fwd(key: number, goals: number, rating: number | null, clubTier = 0.5, star = false): CkPriceInput {
  return { key, line: 'FWD', stats: { ...CK_EMPTY_STATS, goals, rating }, clubTier, star };
}

describe('coach king pricing', () => {
  it('puts the best forward on 13M and fills the 5/8/13 ladder by rank', () => {
    const inputs = Array.from({ length: 100 }, (_, index) =>
      fwd(index + 1, Math.max(0, 20 - index), 8 - index * 0.02, 1 - index / 100, index < 3),
    );
    const prices = ckPricePool(inputs);
    expect(prices.get(1)).toBe(CK_PLAYER_CAP_MILLI);
    expect(prices.get(2)).toBe(CK_PLAYER_MID_MILLI);
    expect(prices.get(18)).toBe(CK_PLAYER_MID_MILLI);
    expect(prices.get(19)).toBe(CK_PLAYER_FLOOR_MILLI);
    expect(prices.get(100)).toBe(CK_PLAYER_FLOOR_MILLI);
    for (const price of prices.values()) {
      expect(CK_PRICE_TIERS_MILLI).toContain(price);
    }
    const elite = [...prices.values()].filter((price) => price === CK_PLAYER_CAP_MILLI).length;
    const mid = [...prices.values()].filter((price) => price === CK_PLAYER_MID_MILLI).length;
    const budget = [...prices.values()].filter((price) => price === CK_PLAYER_FLOOR_MILLI).length;
    expect(elite).toBe(1);
    expect(mid).toBe(17);
    expect(budget).toBe(82);
  });

  it('keeps each line inside the 5/8/13 ladder', () => {
    const prices = ckPricePool([
      { key: 1, line: 'GK', stats: { ...CK_EMPTY_STATS, cleanSheets: 5, saves: 3, rating: 7.4 }, clubTier: 1, star: true },
      { key: 2, line: 'DEF', stats: { ...CK_EMPTY_STATS, tackles: 2, interceptions: 2, rating: 7.5 }, clubTier: 1, star: true },
      { key: 3, line: 'MID', stats: { ...CK_EMPTY_STATS, goals: 4, assists: 5, rating: 7.8 }, clubTier: 1, star: true },
    ]);
    expect(prices.get(1)).toBe(CK_PRICE_BANDS.GK[1]);
    expect(prices.get(2)).toBe(CK_PRICE_BANDS.DEF[1]);
    expect(prices.get(3)).toBe(CK_PRICE_BANDS.MID[1]);
    for (const price of prices.values()) {
      expect(price).toBeLessThanOrEqual(CK_PLAYER_CAP_MILLI);
      expect(CK_PRICE_TIERS_MILLI).toContain(price);
    }
  });

  it('maps score bands onto 5M / 8M / 13M', () => {
    expect(ckPriceFromScore('FWD', 1)).toBe(CK_PLAYER_CAP_MILLI);
    expect(ckPriceFromScore('FWD', 0.7)).toBe(CK_PLAYER_CAP_MILLI);
    expect(ckPriceFromScore('FWD', 0.5)).toBe(CK_PLAYER_MID_MILLI);
    expect(ckPriceFromScore('FWD', 0.32)).toBe(CK_PLAYER_MID_MILLI);
    expect(ckPriceFromScore('FWD', 0.1)).toBe(CK_PLAYER_FLOOR_MILLI);
    expect(ckPriceFromScore('COACH', 1)).toBe(CK_PLAYER_FLOOR_MILLI);
  });

  it('prices every coach at 5M and reads 365 stat strings', () => {
    expect(ckCoachPrice(ckClubTier(1, 20))).toBe(CK_PLAYER_FLOOR_MILLI);
    expect(ckCoachPrice(ckClubTier(20, 20))).toBe(CK_PLAYER_FLOOR_MILLI);
    expect(ckCoachPrice()).toBe(CK_PRICE_BANDS.COACH[0]);
    expect(ckClubTier(null, 20)).toBe(0.5);
    expect(ckParseStatValue('7.7')).toBe(7.7);
    expect(ckParseStatValue('0/2')).toBe(0);
    expect(ckParseStatValue(undefined)).toBe(0);
  });
});
