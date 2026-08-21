import { applyTokenBucket, resetLocalRateLimitBuckets, type TokenBucketState } from '../match-chat.rate-limit';

describe('match-chat rate limit', () => {
  beforeEach(() => {
    resetLocalRateLimitBuckets();
  });

  it('allows a burst then rejects at the same timestamp', () => {
    const now = 1_000_000;
    let state: TokenBucketState = { tokens: 3, ts: now, minuteCount: 0, minuteWindowStart: now };
    const opts = { intervalMs: 1500, burst: 3, perMin: 20 };
    let allowed = 0;
    let denied = 0;
    for (let i = 0; i < 10; i += 1) {
      const result = applyTokenBucket(state, now, opts);
      state = result.next;
      if (result.decision.allowed) allowed += 1;
      else denied += 1;
    }
    expect(allowed).toBe(3);
    expect(denied).toBe(7);
  });

  it('enforces per-minute cap even with leftover tokens', () => {
    const now = 2_000_000;
    let state: TokenBucketState = { tokens: 20, ts: now, minuteCount: 0, minuteWindowStart: now };
    const opts = { intervalMs: 1, burst: 20, perMin: 5 };
    let allowed = 0;
    for (let i = 0; i < 12; i += 1) {
      const result = applyTokenBucket(state, now + i, opts);
      state = result.next;
      if (result.decision.allowed) allowed += 1;
    }
    expect(allowed).toBe(5);
  });

  it('handles concurrent callers via a shared lock (atomic equivalent)', async () => {
    const now = 3_000_000;
    let state: TokenBucketState = { tokens: 3, ts: now, minuteCount: 0, minuteWindowStart: now };
    const opts = { intervalMs: 1500, burst: 3, perMin: 20 };
    let chain = Promise.resolve();
    const decisions: boolean[] = [];
    for (let i = 0; i < 20; i += 1) {
      chain = chain.then(() => {
        const result = applyTokenBucket(state, now, opts);
        state = result.next;
        decisions.push(result.decision.allowed);
      });
    }
    await chain;
    expect(decisions.filter(Boolean)).toHaveLength(3);
  });
});
