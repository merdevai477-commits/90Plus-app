/**
 * Daily match pool configuration and date validation.
 *
 * The product ships ten matches a day, but that is a configured volume rather
 * than a structural limit — these tests pin that the size comes from
 * configuration and that caller-supplied dates are validated.
 */

export {};

const ORIGINAL_ENV = { ...process.env };

function loadPool(env: Record<string, string | undefined> = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../competition-match-pool.service') as typeof import('../competition-match-pool.service');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('pool sizing', () => {
  it('defaults to ten matches a day', () => {
    expect(loadPool({ PREDICT_WIN_POOL_SIZE: undefined }).POOL_SIZE).toBe(10);
  });

  it('is raised by configuration without a code change', () => {
    expect(loadPool({ PREDICT_WIN_POOL_SIZE: '25' }).POOL_SIZE).toBe(25);
  });

  it('falls back to the default when the value is not a number', () => {
    expect(loadPool({ PREDICT_WIN_POOL_SIZE: 'abc' }).POOL_SIZE).toBe(10);
  });

  it('never drops below one', () => {
    expect(loadPool({ PREDICT_WIN_POOL_SIZE: '0' }).POOL_SIZE).toBe(10);
    expect(loadPool({ PREDICT_WIN_POOL_SIZE: '-5' }).POOL_SIZE).toBe(1);
  });

  /**
   * This asserted a default of 0 — today only. That is what made step 2
   * unusable: the deadline picker is capped at the selected match's kickoff, so
   * with only today's fixtures on offer a sponsor could never pick a future
   * date, and once the day's remaining matches had kicked off there was no
   * legal deadline left at all and Next could never enable.
   */
  it('looks a week ahead by default, and honours a configured look-ahead', () => {
    expect(loadPool({ PREDICT_WIN_POOL_DAYS_AHEAD: undefined }).POOL_MAX_DAYS_AHEAD).toBe(7);
    expect(loadPool({ PREDICT_WIN_POOL_DAYS_AHEAD: '3' }).POOL_MAX_DAYS_AHEAD).toBe(3);
    // Explicitly pinning it back to today-only stays possible.
    expect(loadPool({ PREDICT_WIN_POOL_DAYS_AHEAD: '0' }).POOL_MAX_DAYS_AHEAD).toBe(0);
    expect(loadPool({ PREDICT_WIN_POOL_DAYS_AHEAD: 'abc' }).POOL_MAX_DAYS_AHEAD).toBe(7);
  });

  it('keeps a lead margin so a match kicking off imminently is not offerable', () => {
    expect(loadPool({ PREDICT_WIN_POOL_MIN_LEAD_MINUTES: undefined }).POOL_MIN_LEAD_MINUTES).toBe(15);
    expect(loadPool({ PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '30' }).POOL_MIN_LEAD_MINUTES).toBe(30);
    expect(loadPool({ PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' }).POOL_MIN_LEAD_MINUTES).toBe(0);
  });
});

describe('normalisePoolDate', () => {
  const today = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it('defaults to today when no date is supplied', () => {
    const pool = loadPool();
    expect(pool.normalisePoolDate()).toBe(pool.normalisePoolDate(today()));
  });

  it('accepts today', () => {
    expect(loadPool().normalisePoolDate(today())).toBe(today());
  });

  it.each(['not-a-date', '2026/01/01', '20260101', '', '2026-13-99x'])(
    'rejects malformed input %p',
    (bad) => {
      const pool = loadPool();
      if (bad === '') {
        // Empty string is treated as "no date supplied".
        expect(pool.normalisePoolDate(bad)).toBe(today());
      } else {
        expect(() => pool.normalisePoolDate(bad)).toThrow('INVALID_POOL_DATE');
      }
    },
  );

  it('rejects past dates so history cannot be enumerated', () => {
    expect(() => loadPool().normalisePoolDate('2020-01-01')).toThrow('INVALID_POOL_DATE');
  });

  it('rejects dates beyond the configured look-ahead', () => {
    const pool = loadPool({ PREDICT_WIN_POOL_DAYS_AHEAD: '1' });
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    expect(() => pool.normalisePoolDate(inThreeDays)).toThrow('INVALID_POOL_DATE');
  });

  it('allows a date inside the configured look-ahead', () => {
    const pool = loadPool({ PREDICT_WIN_POOL_DAYS_AHEAD: '5' });
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(pool.normalisePoolDate(soon)).toBe(soon);
  });
});

/**
 * The pool day and the kickoff clock must both be expressed in the app
 * calendar timezone (Africa/Cairo by default) — the same calendar the fixture
 * cache and the matches-by-date endpoints are keyed on.
 *
 * Both used to be derived from the server: `localDateKey()` for the day and
 * `kickoffIso.slice(11,16)` for the time. On a UTC host that asked for the
 * wrong day's pool between 00:00 and 03:00 Cairo, and showed every sponsor a
 * kickoff two to three hours earlier than reality in the match picker.
 */
describe('app-calendar clock', () => {
  it('renders kickoff in the app timezone, not UTC', () => {
    const { appClockTime } = loadPool({ APP_CALENDAR_TIMEZONE: 'Africa/Cairo' });
    // 18:00 UTC on a summer date is 21:00 in Cairo (UTC+3).
    expect(appClockTime('2026-08-24T18:00:00.000Z')).toBe('21:00');
  });

  it('crosses midnight in the app timezone rather than in UTC', () => {
    const { appClockTime } = loadPool({ APP_CALENDAR_TIMEZONE: 'Africa/Cairo' });
    expect(appClockTime('2026-08-24T22:30:00.000Z')).toBe('01:30');
  });

  it('honours a configured timezone', () => {
    const { appClockTime } = loadPool({ APP_CALENDAR_TIMEZONE: 'UTC' });
    expect(appClockTime('2026-08-24T18:00:00.000Z')).toBe('18:00');
  });

  it('never throws on a malformed instant', () => {
    const { appClockTime } = loadPool();
    expect(appClockTime('not-a-date')).toBe('00:00');
  });

  it('defaults the pool day to the app calendar day, not the server day', () => {
    const { normalisePoolDate } = loadPool({ APP_CALENDAR_TIMEZONE: 'Africa/Cairo' });
    const cairoToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    expect(normalisePoolDate()).toBe(cairoToday);
    // …and the same day passed in explicitly is accepted, so "today" is not
    // rejected as out of window by a server/app calendar disagreement.
    expect(normalisePoolDate(cairoToday)).toBe(cairoToday);
  });
});
