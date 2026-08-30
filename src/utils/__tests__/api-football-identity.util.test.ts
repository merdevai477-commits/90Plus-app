import { canQueryApiFootballFixtureId } from '../api-football-identity.util';

describe('canQueryApiFootballFixtureId', () => {
  it('allows API-Football-scale fixture ids', () => {
    expect(canQueryApiFootballFixtureId(1_489_387)).toBe(true);
    expect(canQueryApiFootballFixtureId(1)).toBe(true);
  });

  it('rejects native 365 gameIds and namespaced ids', () => {
    expect(canQueryApiFootballFixtureId(4_000_000)).toBe(false);
    expect(canQueryApiFootballFixtureId(4_733_590)).toBe(false);
    expect(canQueryApiFootballFixtureId(7_000_001)).toBe(false);
    expect(canQueryApiFootballFixtureId(0)).toBe(false);
    expect(canQueryApiFootballFixtureId(Number.NaN)).toBe(false);
  });
});
