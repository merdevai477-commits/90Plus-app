/**
 * King history shows the score a row was settled on, not the live cache (E10),
 * and voided rows are not counted or listed as pending.
 */

const mockFindMany = jest.fn();
const mockGroupBy = jest.fn();
const mockCount = jest.fn();
const mockFixtures = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'u1' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'u1', username: 'a', displayName: null, avatar: null }]),
    },
    prediction: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      groupBy: (...a: unknown[]) => mockGroupBy(...a),
      count: (...a: unknown[]) => mockCount(...a),
    },
    cachedFixture: { findMany: (...a: unknown[]) => mockFixtures(...a) },
  },
}));

jest.mock('../xp.service', () => ({ XP_VALUES: { PREDICTION_WINNER: 1, PREDICTION_EXACT: 3 } }));

import { getKingHistory, getKingLeaderboard } from '../king-prediction.service';

function row(over: Record<string, unknown>) {
  return {
    id: 'p',
    userId: 'u1',
    apiMatchId: 1,
    predictionType: 'home',
    predictedHomeScore: null,
    predictedAwayScore: null,
    homeTeam: 'A',
    awayTeam: 'B',
    homeTeamLogo: null,
    awayTeamLogo: null,
    matchDate: new Date('2026-10-28T18:00:00.000Z'),
    createdAt: new Date('2026-10-27T10:00:00.000Z'),
    leagueName: 'L',
    isCorrect: null,
    settledHomeScore: null,
    settledAwayScore: null,
    settledStatus: null,
    voidedAt: null,
    voidReason: null,
    ...over,
  };
}

const history = (status: 'all' | 'pending' = 'all') =>
  getKingHistory({ clerkUserId: 'c1', mode: 'winner', status, page: 0, limit: 20 });

beforeEach(() => {
  jest.clearAllMocks();
  mockGroupBy.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
});

it('settled row shows its settled score even when the cache later changed', async () => {
  mockFindMany.mockResolvedValue([
    row({ id: 's', apiMatchId: 10, isCorrect: true, settledHomeScore: 2, settledAwayScore: 1, settledStatus: 'PEN' }),
    row({ id: 'p', apiMatchId: 11 }),
  ]);
  mockFixtures.mockResolvedValue([
    { fixtureId: 10, homeScore: 3, awayScore: 1, status: 'FT' },
    { fixtureId: 11, homeScore: 0, awayScore: 0, status: 'LIVE' },
  ]);

  const { items } = await history();

  expect(items[0]).toMatchObject({ finalHomeScore: 2, finalAwayScore: 1, matchStatus: 'PEN', voided: false });
  expect(items[1]).toMatchObject({ finalHomeScore: 0, finalAwayScore: 0, matchStatus: 'LIVE' });
  // The cache is only read for rows without a settled snapshot.
  expect(mockFixtures.mock.calls[0][0].where.fixtureId.in).toEqual([11]);
});

it('voided row is marked void and not counted as pending', async () => {
  mockFindMany.mockResolvedValue([row({ id: 'v', voidedAt: new Date(), voidReason: 'CANC' })]);
  mockFixtures.mockResolvedValue([{ fixtureId: 1, homeScore: null, awayScore: null, status: 'NS' }]);
  mockGroupBy.mockResolvedValue([{ isCorrect: null, _count: 3 }, { isCorrect: true, _count: 1 }]);
  mockCount.mockResolvedValue(1);

  const { items, counts } = await history();

  expect(items[0]).toMatchObject({ voided: true, matchStatus: 'CANC' });
  expect(counts).toEqual({ all: 4, correct: 1, wrong: 0, pending: 2, void: 1 });
});

it('pending filter excludes voided rows', async () => {
  mockFindMany.mockResolvedValue([]);
  await history('pending');
  expect(mockFindMany.mock.calls[0][0].where).toMatchObject({ isCorrect: null, voidedAt: null });
});

it('exact leaderboard judges by the settled score, not the current cache', async () => {
  mockFindMany.mockResolvedValue([
    row({ id: 'e', apiMatchId: 20, isCorrect: true, predictedHomeScore: 2, predictedAwayScore: 1,
      settledHomeScore: 2, settledAwayScore: 1 }),
  ]);
  mockFixtures.mockResolvedValue([{ fixtureId: 20, homeScore: 3, awayScore: 1 }]);

  const board = await getKingLeaderboard({ clerkUserId: 'c1', mode: 'exact', period: 'all', limit: 10 });

  expect(board.entries).toEqual([expect.objectContaining({ userId: 'u1', xp: 3 })]);
  expect(mockFixtures).not.toHaveBeenCalled();
});
