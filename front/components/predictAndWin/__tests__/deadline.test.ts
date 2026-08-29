/**
 * Regression tests for step 2's date/time handling.
 *
 * Two bugs live here:
 *  - **Next was always disabled.** The gate is `now < deadline < kickoff`.
 *    The match pool served fixtures that had already kicked off, so for those
 *    matches the interval was empty and no input could ever satisfy it.
 *  - **Only today could be picked.** The deadline day was assembled through
 *    UTC, and the pool only ever offered today's matches, so the picker's
 *    kickoff-derived upper bound was always today.
 */

import {
  defaultDeadlineBeforeKickoff,
  deadlineClockParts,
  buildDeadline,
  isDayAfterKickoff,
  isDeadlineWithinBounds,
  startOfDay,
  startOfToday,
  toDateInputValue,
} from '../deadline';

/** Local wall clock, so these assertions hold in any test-runner timezone. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('defaultDeadlineBeforeKickoff', () => {
  it('lands at least one minute before kickoff', () => {
    const now = local(2026, 9, 12, 10, 0);
    const kickoff = local(2026, 9, 12, 15, 0);
    const at = defaultDeadlineBeforeKickoff(kickoff, now);
    expect(at.getTime()).toBeLessThan(kickoff.getTime());
    expect(at.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('deadlineClockParts', () => {
  it('maps afternoon wall clock into 12-hour fields', () => {
    expect(deadlineClockParts(local(2026, 9, 12, 15, 0))).toEqual({ hour: 3, meridiem: 'pm' });
  });
});

describe('buildDeadline', () => {
  it('combines the picked day with a 12-hour clock', () => {
    const at = buildDeadline({
      date: local(2026, 9, 12),
      hour: '9',
      minute: '30',
      meridiem: 'pm',
    });
    expect(at).toEqual(local(2026, 9, 12, 21, 30));
  });

  it('treats 12 AM as midnight and 12 PM as noon', () => {
    expect(buildDeadline({ date: local(2026, 9, 12), hour: '12', minute: '00', meridiem: 'am' }))
      .toEqual(local(2026, 9, 12, 0, 0));
    expect(buildDeadline({ date: local(2026, 9, 12), hour: '12', minute: '00', meridiem: 'pm' }))
      .toEqual(local(2026, 9, 12, 12, 0));
  });

  it('accepts a zero-padded hour', () => {
    expect(buildDeadline({ date: local(2026, 9, 12), hour: '09', minute: '05', meridiem: 'am' }))
      .toEqual(local(2026, 9, 12, 9, 5));
  });

  it('keeps the picked calendar day regardless of the UTC offset', () => {
    // Routing the day through `toISOString().slice(0,10)` shifts it either side
    // of UTC, which silently scheduled the close for the wrong date.
    const at = buildDeadline({
      date: local(2026, 9, 12),
      hour: '11',
      minute: '45',
      meridiem: 'pm',
    })!;
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(8);
    expect(at.getDate()).toBe(12);
  });

  it('defaults the close to the start of the hour when minutes are 00', () => {
    expect(
      buildDeadline({
        date: local(2026, 9, 12),
        hour: '8',
        minute: '00',
        meridiem: 'pm',
      }),
    ).toEqual(local(2026, 9, 12, 20, 0));
  });

  it('supports 24-hour clock without meridiem', () => {
    const at = buildDeadline({
      date: local(2026, 9, 12),
      hour: '21',
      minute: '30',
      meridiem: null,
      use24Hour: true,
    });
    expect(at).toEqual(local(2026, 9, 12, 21, 30));
  });

  it.each([
    ['no date', { date: null, hour: '9', minute: '30', meridiem: 'pm' as const }],
    ['no hour', { date: local(2026, 9, 12), hour: '', minute: '30', meridiem: 'pm' as const }],
    ['no minute', { date: local(2026, 9, 12), hour: '9', minute: '', meridiem: 'pm' as const }],
    ['no meridiem', { date: local(2026, 9, 12), hour: '9', minute: '30', meridiem: null }],
    ['hour 0', { date: local(2026, 9, 12), hour: '0', minute: '30', meridiem: 'pm' as const }],
    ['hour 13', { date: local(2026, 9, 12), hour: '13', minute: '30', meridiem: 'pm' as const }],
    ['minute 60', { date: local(2026, 9, 12), hour: '9', minute: '60', meridiem: 'pm' as const }],
  ])('returns null for %s', (_label, parts) => {
    expect(buildDeadline(parts as never)).toBeNull();
  });
});

describe('isDeadlineWithinBounds', () => {
  const now = local(2026, 9, 12, 18, 0);

  it('accepts a deadline between now and kickoff', () => {
    expect(isDeadlineWithinBounds(local(2026, 9, 12, 20, 0), local(2026, 9, 12, 22, 0), now))
      .toBe(true);
  });

  it('rejects a deadline exactly at kickoff', () => {
    const kickoff = local(2026, 9, 12, 22, 0);
    expect(isDeadlineWithinBounds(kickoff, kickoff, now)).toBe(false);
  });

  it('rejects a deadline one minute after kickoff', () => {
    expect(isDeadlineWithinBounds(local(2026, 9, 12, 22, 1), local(2026, 9, 12, 22, 0), now))
      .toBe(false);
  });

  it('rejects a deadline exactly at now', () => {
    expect(isDeadlineWithinBounds(now, local(2026, 9, 12, 22, 0), now)).toBe(false);
  });

  it('accepts a deadline one minute after now', () => {
    expect(isDeadlineWithinBounds(local(2026, 9, 12, 18, 1), local(2026, 9, 12, 22, 0), now))
      .toBe(true);
  });

  it('is unsatisfiable for a match that already kicked off', () => {
    // The shape of the "Next is always disabled" bug: every candidate fails.
    const kickoff = local(2026, 9, 12, 15, 0);
    for (const hour of [15, 16, 17, 18, 19, 20, 23]) {
      expect(isDeadlineWithinBounds(local(2026, 9, 12, hour, 0), kickoff, now)).toBe(false);
    }
  });

  it('supports a deadline days in the future', () => {
    expect(isDeadlineWithinBounds(local(2026, 9, 15, 12, 0), local(2026, 9, 15, 18, 0), now))
      .toBe(true);
  });

  it('rejects a missing deadline or kickoff', () => {
    expect(isDeadlineWithinBounds(null, local(2026, 9, 12, 22, 0), now)).toBe(false);
    expect(isDeadlineWithinBounds(local(2026, 9, 12, 20, 0), null, now)).toBe(false);
  });
});

describe('isDayAfterKickoff', () => {
  it('flags a day that starts after the match', () => {
    expect(isDayAfterKickoff(local(2026, 9, 14), local(2026, 9, 13, 18, 0))).toBe(true);
  });

  it('allows the kickoff day itself', () => {
    expect(isDayAfterKickoff(local(2026, 9, 13, 23, 0), local(2026, 9, 13, 18, 0))).toBe(false);
  });

  it('allows an earlier day', () => {
    expect(isDayAfterKickoff(local(2026, 9, 12), local(2026, 9, 13, 18, 0))).toBe(false);
  });
});

describe('toDateInputValue', () => {
  it('reports the local calendar day, not the UTC one', () => {
    // 23:30 local is the next day in UTC for any negative offset and the same
    // day for positive ones; the local components are what the picker shows.
    const late = local(2026, 1, 31, 23, 30);
    expect(toDateInputValue(late)).toBe('2026-01-31');
  });

  it('zero-pads month and day', () => {
    expect(toDateInputValue(local(2026, 3, 5))).toBe('2026-03-05');
  });
});

describe('startOfToday / startOfDay', () => {
  it('returns local midnight', () => {
    const at = startOfToday(local(2026, 9, 12, 23, 59));
    expect(at).toEqual(local(2026, 9, 12));
  });

  it('does not allow today itself to be excluded', () => {
    // Today must remain selectable — the bug report was that it was the *only*
    // selectable day, not that it should be barred.
    const now = local(2026, 9, 12, 10, 0);
    const today = startOfToday(now);
    expect(isDayAfterKickoff(today, local(2026, 9, 12, 22, 0))).toBe(false);
  });

  it('normalises any instant to its own midnight', () => {
    expect(startOfDay(local(2026, 9, 12, 17, 45))).toEqual(local(2026, 9, 12));
  });
});
