import { getAppFeaturesPollPeriodMs } from '../appFeaturesPoll';

describe('getAppFeaturesPollPeriodMs (A6)', () => {
  const unlock = Date.parse('2026-09-04T18:00:00.000Z');

  it('uses 30s far from unlock', () => {
    expect(getAppFeaturesPollPeriodMs(unlock - 10 * 60_000, unlock)).toBe(30_000);
  });

  it('uses 5s only inside the final 2 minutes before unlock', () => {
    expect(getAppFeaturesPollPeriodMs(unlock - 90_000, unlock)).toBe(5_000);
    expect(getAppFeaturesPollPeriodMs(unlock - 1_000, unlock)).toBe(5_000);
  });

  it('reverts to 30s at and after unlock (does not latch on 5s)', () => {
    expect(getAppFeaturesPollPeriodMs(unlock, unlock)).toBe(30_000);
    expect(getAppFeaturesPollPeriodMs(unlock + 30_000, unlock)).toBe(30_000);
    expect(getAppFeaturesPollPeriodMs(unlock + 120_000, unlock)).toBe(30_000);
  });

  it('falls back to 30s when unlock is missing', () => {
    expect(getAppFeaturesPollPeriodMs(Date.now(), 0)).toBe(30_000);
    expect(getAppFeaturesPollPeriodMs(Date.now(), Number.NaN)).toBe(30_000);
  });
});
