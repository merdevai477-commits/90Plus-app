/**
 * U1 backlog — push policy for settlement.
 */

import {
  decideResultPush,
  getMaxMatchesPerTick,
  isStaleKickoff,
} from '../prediction-settle-push-policy';

const ENV_KEYS = [
  'PREDICTION_SETTLE_PUSH_MODE',
  'PREDICTION_SETTLE_PUSH_MAX_AGE_HOURS',
  'PREDICTION_SETTLE_MAX_MATCHES_PER_TICK',
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

const now = new Date('2026-10-30T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

describe('settle push policy', () => {
  it('suppresses push when kickoff older than max age', () => {
    expect(decideResultPush(hoursAgo(13), now)).toEqual({ notify: false, reason: 'STALE' });
    expect(decideResultPush(hoursAgo(2), now)).toEqual({ notify: true, skipPush: false });
  });

  it('respects a custom max age', () => {
    process.env.PREDICTION_SETTLE_PUSH_MAX_AGE_HOURS = '1';
    expect(isStaleKickoff(hoursAgo(2), now)).toBe(true);
  });

  it('null kickoff is never stale', () => {
    expect(isStaleKickoff(null, now)).toBe(false);
  });

  it('inbox_only sends no push but keeps the inbox row', () => {
    process.env.PREDICTION_SETTLE_PUSH_MODE = 'inbox_only';
    expect(decideResultPush(hoursAgo(1), now)).toEqual({
      notify: true,
      skipPush: true,
      reason: 'MODE_INBOX_ONLY',
    });
  });

  it('off sends nothing', () => {
    process.env.PREDICTION_SETTLE_PUSH_MODE = 'off';
    expect(decideResultPush(hoursAgo(1), now)).toEqual({ notify: false, reason: 'MODE_OFF' });
  });

  it('unknown mode falls back to live', () => {
    process.env.PREDICTION_SETTLE_PUSH_MODE = 'loud';
    expect(decideResultPush(hoursAgo(1), now)).toEqual({ notify: true, skipPush: false });
  });

  it('per-tick cap defaults to 25 and ignores garbage', () => {
    expect(getMaxMatchesPerTick()).toBe(25);
    process.env.PREDICTION_SETTLE_MAX_MATCHES_PER_TICK = '-3';
    expect(getMaxMatchesPerTick()).toBe(25);
    process.env.PREDICTION_SETTLE_MAX_MATCHES_PER_TICK = '5';
    expect(getMaxMatchesPerTick()).toBe(5);
  });
});
