import { shouldApplyCalendarGeneration } from '../calendarGeneration';
import { MATCHES_PAST_DISK_TTL_MS } from '../../services/cacheService';

describe('calendarGeneration (C2)', () => {
  it('applies when captured generation matches current', () => {
    expect(shouldApplyCalendarGeneration(3, 3)).toBe(true);
  });

  it('rejects when a newer generation won (A starts, B resolves first)', () => {
    const genA = 1;
    const genB = 2; // user switched date
    expect(shouldApplyCalendarGeneration(genA, genB)).toBe(false);
    expect(shouldApplyCalendarGeneration(genB, genB)).toBe(true);
  });
});

describe('MATCHES_PAST_DISK_TTL_MS (C3)', () => {
  it('caps past-date disk cache at 7 days', () => {
    expect(MATCHES_PAST_DISK_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(MATCHES_PAST_DISK_TTL_MS).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});
