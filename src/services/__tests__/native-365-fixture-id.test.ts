import { isNative365FixtureId } from '../../utils/native-365-fixture-id';

describe('isNative365FixtureId', () => {
  it('treats 365 gameIds stored as fixtureId as native', () => {
    expect(isNative365FixtureId(4_000_000)).toBe(true);
    expect(isNative365FixtureId(4_627_937)).toBe(true);
  });

  it('rejects API-Football-scale fixture ids', () => {
    expect(isNative365FixtureId(1_489_387)).toBe(false);
    expect(isNative365FixtureId(0)).toBe(false);
    expect(isNative365FixtureId(Number.NaN)).toBe(false);
  });
});
