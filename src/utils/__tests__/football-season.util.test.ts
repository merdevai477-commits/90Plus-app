import {
  footballSeasonFallbackChain,
  resolveFootballSeason,
} from '../football-season.util';

describe('football season util', () => {
  const originalEnv = process.env.FOOTBALL_SEASON;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.FOOTBALL_SEASON;
    else process.env.FOOTBALL_SEASON = originalEnv;
  });

  test('June 2026 uses API season 2026', () => {
    expect(resolveFootballSeason(new Date('2026-06-10T12:00:00Z'))).toBe(2026);
  });

  test('May 2026 still uses 2025 campaign', () => {
    expect(resolveFootballSeason(new Date('2026-05-15T12:00:00Z'))).toBe(2025);
  });

  test('July 2026 uses 2026', () => {
    expect(resolveFootballSeason(new Date('2026-07-01T12:00:00Z'))).toBe(2026);
  });

  test('FOOTBALL_SEASON env overrides', () => {
    process.env.FOOTBALL_SEASON = '2026';
    expect(resolveFootballSeason(new Date('2026-01-01T12:00:00Z'))).toBe(2026);
  });

  test('fallback chain starts at primary season', () => {
    expect(footballSeasonFallbackChain(2026)).toEqual([2026, 2025, 2024]);
  });
});
