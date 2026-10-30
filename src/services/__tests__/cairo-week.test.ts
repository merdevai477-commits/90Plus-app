/**
 * Cairo Sun–Sat King week (Q1, C3) and one week predicate for history and
 * leaderboard (B8, C4). Prisma is mocked; the where clauses are captured.
 */

const mockUserFind = jest.fn();
const mockFindMany = jest.fn();
const mockGroupBy = jest.fn();
const mockCount = jest.fn();
const mockFixtures = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findFirst: (...a: unknown[]) => mockUserFind(...a), findMany: jest.fn().mockResolvedValue([]) },
    prediction: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      groupBy: (...a: unknown[]) => mockGroupBy(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
    cachedFixture: { findMany: (...a: unknown[]) => mockFixtures(...a) },
  },
}));

jest.mock('../xp.service', () => ({ XP_VALUES: { PREDICTION_WINNER: 1, PREDICTION_EXACT: 3 } }));

import { cairoDayRange, cairoWeekBounds, kingWeekWhere } from '../king-prediction-rules';
import { getKingHistory, getKingLeaderboard } from '../king-prediction.service';

const iso = (d: Date) => d.toISOString();

describe('cairoWeekBounds', () => {
  it('Sat 23:59 vs Sun 00:00 Cairo', () => {
    const sat = cairoWeekBounds(new Date('2026-10-31T21:59:00.000Z'));
    const sun = cairoWeekBounds(new Date('2026-10-31T22:00:00.000Z'));
    expect(sat.days[0]).toBe('2026-10-25');
    expect(sat.days[6]).toBe('2026-10-31');
    expect(sun.days[0]).toBe('2026-11-01');
    expect(iso(sat.end)).toBe(iso(sun.start));
  });

  it('Sun 00:30 Cairo is already the new week (the old UTC week said otherwise)', () => {
    const w = cairoWeekBounds(new Date('2026-10-31T22:30:00.000Z'));
    expect(w.days[0]).toBe('2026-11-01');
    expect(iso(w.start)).toBe('2026-10-31T22:00:00.000Z');
  });

  it('across 2026-10-30 DST change', () => {
    const w = cairoWeekBounds(new Date('2026-10-30T10:00:00.000Z'));
    expect(w.days).toEqual([
      '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31',
    ]);
    expect(iso(w.start)).toBe('2026-10-24T21:00:00.000Z'); // UTC+3
    expect(iso(w.end)).toBe('2026-10-31T22:00:00.000Z'); // UTC+2
    expect(w.end.getTime() - w.start.getTime()).toBe(7 * 86_400_000 + 3_600_000);
    for (let i = 1; i < 7; i++) {
      expect(iso(cairoDayRange(w.days[i - 1]).end)).toBe(iso(cairoDayRange(w.days[i]).start));
    }
    // Thu 23:30 Cairo, after clocks went back, still belongs to this week.
    const late = new Date('2026-10-29T21:30:00.000Z');
    expect(late >= w.start && late < w.end).toBe(true);
  });
});

describe('one week predicate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-10-30T10:00:00.000Z'), doNotFake: ['nextTick', 'setImmediate'] });
    mockUserFind.mockResolvedValue({ id: 'u1' });
    mockFindMany.mockResolvedValue([]);
    mockGroupBy.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockFixtures.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it('null matchDate bucketed identically in history and leaderboard', async () => {
    const expected = kingWeekWhere(cairoWeekBounds()).OR;

    await getKingHistory({ clerkUserId: 'c1', mode: 'winner', status: 'all', page: 0, limit: 20 });
    const historyWhere = mockFindMany.mock.calls[0][0].where;

    mockFindMany.mockClear();
    await getKingLeaderboard({ clerkUserId: 'c1', mode: 'winner', period: 'week', limit: 10 });
    const boardWhere = mockFindMany.mock.calls[0][0].where;

    expect(historyWhere.OR).toEqual(expected);
    expect(boardWhere.OR).toEqual(expected);
    expect(expected).toContainEqual({ matchDate: null, createdAt: { gte: expect.any(Date), lt: expect.any(Date) } });
    expect(iso(expected[0].matchDate!.gte)).toBe('2026-10-24T21:00:00.000Z');
  });

  it('all-time leaderboard has no week filter', async () => {
    await getKingLeaderboard({ clerkUserId: 'c1', mode: 'winner', period: 'all', limit: 10 });
    expect(mockFindMany.mock.calls[0][0].where.OR).toBeUndefined();
  });
});
