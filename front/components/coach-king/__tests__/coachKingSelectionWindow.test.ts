import { resolveCkSelectionWindow, splitCkCountdown } from '../coachKingSelectionWindow';

describe('coach king selection window', () => {
  it('counts Monday down to Tuesday close, not a 100+ hour Saturday', () => {
    // Monday 2 Nov 2026, 13:32 UTC — the reported screen showed 104 hours.
    const now = new Date('2026-11-02T13:32:00.000Z');
    const window = resolveCkSelectionWindow(now);
    expect(window.phase).toBe('open');
    expect(window.windowStartAt).toBe('2026-10-27T00:00:00.000Z');
    expect(window.targetAt).toBe('2026-11-03T00:00:00.000Z');
    const remaining = new Date(window.targetAt).getTime() - now.getTime();
    const parts = splitCkCountdown(remaining);
    expect(parts.showDays).toBe(false);
    expect(Number(parts.hours)).toBeLessThan(24);
    expect(Number(parts.hours)).toBe(10);
  });

  it('splits a multi-day close into days plus hours under 24', () => {
    const parts = splitCkCountdown((4 * 24 + 8) * 3600 * 1000 + 27 * 60 * 1000);
    expect(parts).toMatchObject({ days: '4', hours: '08', minutes: '27', showDays: true });
  });
});
