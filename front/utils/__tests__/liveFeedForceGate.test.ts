import { shouldForceLiveFeedFetch } from '../liveFeedForceGate';

describe('shouldForceLiveFeedFetch (A7)', () => {
  it('suppresses force when WS is trusted even if calendar poll is fresh', () => {
    expect(shouldForceLiveFeedFetch(true, true)).toBe(false);
  });

  it('forces when calendar poll is fresh and WS is not trusted', () => {
    expect(shouldForceLiveFeedFetch(true, false)).toBe(true);
  });

  it('does not force on initial mount (fresh=false)', () => {
    expect(shouldForceLiveFeedFetch(false, false)).toBe(false);
    expect(shouldForceLiveFeedFetch(false, true)).toBe(false);
  });
});
