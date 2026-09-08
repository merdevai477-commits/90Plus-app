import { appendPullQuery, shouldSkipClientPullCooldown, PTR_CLIENT_COOLDOWN_MS } from '../pullRefreshQuery';

describe('appendPullQuery', () => {
  it('adds pull=1 without fresh', () => {
    expect(appendPullQuery('/football/cached/matches/2026-09-08?view=list', true)).toBe(
      '/football/cached/matches/2026-09-08?view=list&pull=1',
    );
    expect(appendPullQuery('/football/fixtures/live', true)).toBe('/football/fixtures/live?pull=1');
  });

  it('leaves the url unchanged when pull is off', () => {
    expect(appendPullQuery('/football/fixtures/live', false)).toBe('/football/fixtures/live');
    expect(appendPullQuery('/football/fixtures/live')).toBe('/football/fixtures/live');
  });
});

describe('shouldSkipClientPullCooldown', () => {
  it('skips inside the 2.5s window', () => {
    const now = 10_000;
    expect(shouldSkipClientPullCooldown(now - 500, now)).toBe(true);
    expect(shouldSkipClientPullCooldown(now - PTR_CLIENT_COOLDOWN_MS, now)).toBe(false);
    expect(shouldSkipClientPullCooldown(0, now)).toBe(false);
  });
});
