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
  it('puts big-club stars and real scorers on 13M, never fringe no-names', () => {
    const inputs = [
      fwd(1, 28, 8.2, 1, true), // Haaland-like curated star
      fwd(2, 18, 7.8, 0.9, true),
      fwd(3, 10, 7.2, 0.7, false),
      fwd(4, 4, 6.8, 0.4, false),
      fwd(5, 20, 7.0, 0.2, false), // high goals at a weak club → not automatic 13M
      ...Array.from({ length: 95 }, (_, index) => fwd(index + 6, 0, null, 0.15, false)),
    ];
    const prices = ckPricePool(inputs);
    expect(prices.get(1)).toBe(CK_PLAYER_CAP_MILLI);
    expect(prices.get(2)).toBe(CK_PLAYER_CAP_MILLI);
    expect(prices.get(5)).not.toBe(CK_PLAYER_CAP_MILLI);
    for (let key = 20; key <= 100; key += 1) {
      expect(prices.get(key)).toBe(CK_PLAYER_FLOOR_MILLI);
    }
    for (const price of prices.values()) {
      expect(CK_PRICE_TIERS_MILLI).toContain(price);
    }
  });

  it('keeps each line inside the 5/8/13 ladder', () => {
    const prices = ckPricePool([
      { key: 1, line: 'GK', stats: { ...CK_EMPTY_STATS, cleanSheets: 12, saves: 40, rating: 7.4 }, clubTier: 1, star: true },
      { key: 2, line: 'DEF', stats: { ...CK_EMPTY_STATS, tackles: 40, interceptions: 20, rating: 7.5 }, clubTier: 1, star: true },
      { key: 3, line: 'MID', stats: { ...CK_EMPTY_STATS, goals: 8, assists: 10, rating: 7.8 }, clubTier: 1, star: true },
    ]);
    expect(prices.get(1)).toBe(CK_PRICE_BANDS.GK[1]);
    expect(prices.get(2)).toBe(CK_PRICE_BANDS.DEF[1]);
    expect(prices.get(3)).toBe(CK_PRICE_BANDS.MID[1]);
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
