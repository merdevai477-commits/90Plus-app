/**
 * Regression tests for "matches must be after the created date/time".
 *
 * The pool used to hand the sponsor every top fixture of the day, including
 * ones that had already kicked off. Because a prediction deadline must satisfy
 * `now < deadline <= kickoff`, selecting such a match left no legal deadline at
 * all — which is what pinned step 2's Next button to disabled with nothing on
 * screen explaining why. Two separate mistakes produced that:
 *
 *  1. no time filter — `pickTopFixtures` only screens on provider *status*,
 *     and status lags badly (a fixture an hour into play routinely still reads
 *     `NS`);
 *  2. the `POOL_SIZE` cut ran *before* any filtering, so the ten "best"
 *     matches of the day could all be ones already played.
 *
 * These also pin the boundaries the rule turns on: exactly-now, a minute either
 * side, and midnight.
 */

const ORIGINAL_ENV = { ...process.env };

const NOW = new Date('2026-03-10T18:00:00.000Z');

/** Minimal API-Football fixture shape, only the fields the pool reads. */
function fixture(id: number, kickoffIso: string, status = 'NS') {
  return {
    fixture: { id, date: kickoffIso, status: { short: status } },
    teams: {
      home: { name: `Home ${id}`, logo: null },
      away: { name: `Away ${id}`, logo: null },
    },
    league: { name: 'Test League', id: 39 },
  };
}

/**
 * Loads the pool module with the fixture cache stubbed. `byDate` maps a
 * calendar day to the fixtures the cache would return for it.
 */
function loadPool(byDate: Record<string, unknown[]>, env: Record<string, string | undefined> = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };

  jest.doMock('../football-data-cache.service', () => ({
    footballDataCacheService: {
      getMatchesByDate: jest.fn(async (day: string) => byDate[day] ?? []),
    },
  }));
  jest.doMock('../../utils/logger', () => ({
    logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../competition-match-pool.service') as typeof import('../competition-match-pool.service');
}

/**
 * `normalisePoolDate` validates the requested day against the *real* app
 * calendar day, so the clock has to be pinned or every fixed date below reads
 * as history and is rejected. Only the clock is faked — timers are left alone
 * so the awaited promises still resolve.
 */
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe('pool eligibility', () => {
  const DAY = '2026-03-10';

  it('drops a match that has already kicked off', async () => {
    const pool = loadPool(
      {
        [DAY]: [
          fixture(1, '2026-03-10T16:00:00.000Z'), // 2h ago
          fixture(2, '2026-03-10T20:00:00.000Z'), // 2h away
        ],
      },
      { PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getPoolForDate(DAY, NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([2]);
  });

  it('drops a match whose kickoff is exactly now', async () => {
    const pool = loadPool(
      { [DAY]: [fixture(1, NOW.toISOString()), fixture(2, '2026-03-10T20:00:00.000Z')] },
      { PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getPoolForDate(DAY, NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([2]);
  });

  it('drops a match one minute before now and keeps one a minute after', async () => {
    const pool = loadPool(
      {
        [DAY]: [
          fixture(1, '2026-03-10T17:59:00.000Z'),
          fixture(2, '2026-03-10T18:01:00.000Z'),
        ],
      },
      { PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getPoolForDate(DAY, NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([2]);
  });

  it('honours the lead margin', async () => {
    const pool = loadPool(
      {
        [DAY]: [
          fixture(1, '2026-03-10T18:10:00.000Z'), // inside a 15m margin
          fixture(2, '2026-03-10T18:20:00.000Z'), // outside it
        ],
      },
      { PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '15' },
    );

    const result = await pool.getPoolForDate(DAY, NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([2]);
  });

  it('drops postponed, cancelled and finished fixtures whatever their kickoff', async () => {
    const pool = loadPool(
      {
        [DAY]: [
          fixture(1, '2026-03-10T20:00:00.000Z', 'PST'),
          fixture(2, '2026-03-10T21:00:00.000Z', 'CANC'),
          fixture(3, '2026-03-10T22:00:00.000Z', 'FT'),
          fixture(4, '2026-03-10T23:00:00.000Z', 'NS'),
        ],
      },
      { PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getPoolForDate(DAY, NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([4]);
  });

  it('fills the pool with eligible matches rather than filtering after the cut', async () => {
    // Ten already-played matches ahead of two upcoming ones. Capping first
    // would have returned an empty pool.
    const played = Array.from({ length: 10 }, (_, i) =>
      fixture(100 + i, '2026-03-10T10:00:00.000Z'),
    );
    const upcoming = [
      fixture(1, '2026-03-10T20:00:00.000Z'),
      fixture(2, '2026-03-10T21:00:00.000Z'),
    ];

    const pool = loadPool(
      { [DAY]: [...played, ...upcoming] },
      { PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getPoolForDate(DAY, NOW);
    expect(result.map((m) => m.apiMatchId).sort()).toEqual([1, 2]);
  });

  it('still caps an all-eligible day at POOL_SIZE', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      fixture(i + 1, `2026-03-10T2${i % 2}:00:00.000Z`),
    );
    const pool = loadPool(
      { [DAY]: many },
      { PREDICT_WIN_POOL_SIZE: '10', PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getPoolForDate(DAY, NOW);
    expect(result).toHaveLength(10);
  });
});

describe('upcoming window', () => {
  it('spans today plus the configured look-ahead, in kickoff order', async () => {
    const pool = loadPool(
      {
        '2026-03-10': [fixture(1, '2026-03-10T20:00:00.000Z')],
        '2026-03-11': [fixture(2, '2026-03-11T15:00:00.000Z')],
        '2026-03-12': [fixture(3, '2026-03-12T15:00:00.000Z')],
        // Beyond the window.
        '2026-03-13': [fixture(4, '2026-03-13T15:00:00.000Z')],
      },
      { PREDICT_WIN_POOL_DAYS_AHEAD: '2', PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getUpcomingPool(NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([1, 2, 3]);
  });

  it('de-duplicates a fixture that straddles two calendar days', async () => {
    // A 23:30 UTC kickoff buckets into the next Cairo day, so the cache can
    // return the same fixture for both.
    const late = fixture(7, '2026-03-10T23:30:00.000Z');
    const pool = loadPool(
      { '2026-03-10': [late], '2026-03-11': [late] },
      { PREDICT_WIN_POOL_DAYS_AHEAD: '1', PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    const result = await pool.getUpcomingPool(NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([7]);
  });

  it('survives one day failing without emptying the picker', async () => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, PREDICT_WIN_POOL_DAYS_AHEAD: '1', PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' };
    jest.doMock('../football-data-cache.service', () => ({
      footballDataCacheService: {
        getMatchesByDate: jest.fn(async (day: string) => {
          if (day === '2026-03-10') throw new Error('upstream down');
          return [fixture(2, '2026-03-11T15:00:00.000Z')];
        }),
      },
    }));
    jest.doMock('../../utils/logger', () => ({
      logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pool = require('../competition-match-pool.service') as typeof import('../competition-match-pool.service');

    const result = await pool.getUpcomingPool(NOW);
    expect(result.map((m) => m.apiMatchId)).toEqual([2]);
  });
});

describe('findInPool', () => {
  it('accepts a match the picker offered for a future day', async () => {
    const pool = loadPool(
      {
        '2026-03-10': [fixture(1, '2026-03-10T20:00:00.000Z')],
        '2026-03-11': [fixture(2, '2026-03-11T15:00:00.000Z')],
      },
      { PREDICT_WIN_POOL_DAYS_AHEAD: '1', PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    // Publishing sends no `poolDate`; before this searched the upcoming window
    // it only looked at today and rejected tomorrow's match as MATCH_NOT_IN_POOL.
    await expect(pool.findInPool(2, undefined, NOW)).resolves.toMatchObject({ apiMatchId: 2 });
  });

  it('rejects a match that has already kicked off', async () => {
    const pool = loadPool(
      { '2026-03-10': [fixture(1, '2026-03-10T10:00:00.000Z')] },
      { PREDICT_WIN_POOL_DAYS_AHEAD: '0', PREDICT_WIN_POOL_MIN_LEAD_MINUTES: '0' },
    );

    await expect(pool.findInPool(1, undefined, NOW)).resolves.toBeNull();
  });
});
