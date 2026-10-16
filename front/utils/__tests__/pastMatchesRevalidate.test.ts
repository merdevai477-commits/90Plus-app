import {
  offsetLocalDateKey,
  shouldRevalidatePastCalendar,
} from '../pastMatchesRevalidate';

describe('offsetLocalDateKey', () => {
  it('shifts backward across month boundaries', () => {
    expect(offsetLocalDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('shifts forward', () => {
    expect(offsetLocalDateKey('2026-10-16', 1)).toBe('2026-10-17');
  });
});

describe('shouldRevalidatePastCalendar', () => {
  const today = '2026-10-16';
  const yesterday = '2026-10-15';
  const older = '2026-10-10';

  it('never revalidates today or future (other paths own those)', () => {
    expect(shouldRevalidatePastCalendar(today, today, { isStale: true })).toBe(false);
    expect(shouldRevalidatePastCalendar('2026-10-17', today, null)).toBe(false);
  });

  it('always revalidates yesterday (backend yesterday-hot / late kickoffs)', () => {
    expect(shouldRevalidatePastCalendar(yesterday, today, { isStale: false })).toBe(true);
    expect(shouldRevalidatePastCalendar(yesterday, today, null)).toBe(true);
  });

  it('skips older past when disk cache is still fresh', () => {
    expect(shouldRevalidatePastCalendar(older, today, { isStale: false })).toBe(false);
  });

  it('revalidates older past when disk cache is stale', () => {
    expect(shouldRevalidatePastCalendar(older, today, { isStale: true })).toBe(true);
  });

  it('revalidates older past when metadata is missing (memory-only / cold disk)', () => {
    expect(shouldRevalidatePastCalendar(older, today, null)).toBe(true);
  });
});
