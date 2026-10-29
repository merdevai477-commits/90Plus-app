/**
 * upsertKingPrediction — server-authoritative lock, daily slot, canonical id
 * (B1, B2, B3, B4, B5, A12, Q6). Prisma and fixture lookup are mocked.
 */

const mockResolveFixture = jest.fn();
const mockUserFind = jest.fn();
const mockTx = {
  prediction: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), count: jest.fn() },
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findFirst: (...a: unknown[]) => mockUserFind(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => fn(mockTx),
  },
}));

jest.mock('../king-prediction-rules', () => {
  const actual = jest.requireActual('../king-prediction-rules');
  return { ...actual, resolveServerFixture: (...a: unknown[]) => mockResolveFixture(...a) };
});

jest.mock('../xp.service', () => ({ XP_VALUES: { PREDICTION_WINNER: 1, PREDICTION_EXACT: 3 } }));

import { KingPredictionError, upsertKingPrediction } from '../king-prediction.service';

const FUTURE = new Date(Date.now() + 3600_000);
const PAST = new Date(Date.now() - 60_000);

function input(over: Record<string, unknown> = {}) {
  return {
    clerkUserId: 'clerk_1',
    apiMatchId: 4800001,
    mode: 'winner' as const,
    predictionType: 'home' as const,
    dailyLimit: 10,
    coinsSpent: 0,
    ...over,
  };
}

async function reason(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof KingPredictionError) return e.reason;
    throw e;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserFind.mockResolvedValue({ id: 'u1', coins: 0 });
  mockResolveFixture.mockResolvedValue({ kickoff: FUTURE, status: 'NS', canonicalKey: '365:4800001' });
  mockTx.prediction.findUnique.mockResolvedValue(null);
  mockTx.prediction.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
  mockTx.prediction.update.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
  mockTx.$executeRaw.mockResolvedValue(1);
  mockTx.$queryRaw.mockResolvedValue([{ count: 1 }]);
});

describe('upsertKingPrediction', () => {
  it('rejects create after server kickoff even if client matchDate empty (B1)', async () => {
    mockResolveFixture.mockResolvedValue({ kickoff: PAST, status: 'NS', canonicalKey: '365:4800001' });
    expect(await reason(upsertKingPrediction(input({ matchDate: null })))).toBe('MATCH_STARTED');
    expect(mockTx.prediction.create).not.toHaveBeenCalled();
  });

  it('ignores a forged future client matchDate (B1)', async () => {
    mockResolveFixture.mockResolvedValue({ kickoff: PAST, status: 'NS', canonicalKey: '365:4800001' });
    const forged = new Date(Date.now() + 86_400_000).toISOString();
    expect(await reason(upsertKingPrediction(input({ matchDate: forged })))).toBe('MATCH_STARTED');
  });

  it('submit route uses server kickoff — stored matchDate is the fixture kickoff (B2)', async () => {
    const r = await upsertKingPrediction(input({ mode: 'exact', homeScore: 2, awayScore: 1 }));
    expect(mockTx.prediction.create.mock.calls[0][0].data.matchDate).toBe(FUTURE);
    expect(mockTx.prediction.create.mock.calls[0][0].data.canonicalFixtureKey).toBe('365:4800001');
    expect(r.updated).toBe(false);
  });

  it('rejects mode switch after kickoff (B4, Q4)', async () => {
    mockTx.prediction.findUnique.mockResolvedValue({
      id: 'p1',
      isCorrect: null,
      matchDate: FUTURE,
      predictedHomeScore: 1,
      predictedAwayScore: 0,
      canonicalFixtureKey: '365:4800001',
    });
    mockResolveFixture.mockResolvedValue({ kickoff: PAST, status: 'LIVE', canonicalKey: '365:4800001' });
    expect(await reason(upsertKingPrediction(input({ mode: 'winner', predictionType: 'draw' })))).toBe(
      'MATCH_STARTED',
    );
    expect(mockTx.prediction.update).not.toHaveBeenCalled();
  });

  it('allows mode switch before kickoff and does not take a daily slot', async () => {
    mockTx.prediction.findUnique.mockResolvedValue({ id: 'p1', isCorrect: null, canonicalFixtureKey: null });
    const r = await upsertKingPrediction(input({ mode: 'exact', homeScore: 0, awayScore: 0 }));
    expect(r.updated).toBe(true);
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
    expect(mockTx.prediction.update.mock.calls[0][0].data.canonicalFixtureKey).toBe('365:4800001');
  });

  it('rejects update after kickoff (Q6)', async () => {
    mockTx.prediction.findUnique.mockResolvedValue({ id: 'p1', isCorrect: null });
    mockResolveFixture.mockResolvedValue({ kickoff: PAST, status: 'NS', canonicalKey: '365:4800001' });
    expect(await reason(upsertKingPrediction(input()))).toBe('MATCH_STARTED');
  });

  it('unknown or finished apiMatchId is not eligible (B5)', async () => {
    mockResolveFixture.mockResolvedValue(null);
    expect(await reason(upsertKingPrediction(input()))).toBe('MATCH_NOT_ELIGIBLE');
    mockResolveFixture.mockResolvedValue({ kickoff: FUTURE, status: 'FT', canonicalKey: '365:1' });
    expect(await reason(upsertKingPrediction(input()))).toBe('MATCH_NOT_ELIGIBLE');
  });

  it('full daily counter refuses the create (B3)', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);
    expect(await reason(upsertKingPrediction(input()))).toBe('DAILY_LIMIT_REACHED');
    expect(mockTx.prediction.create).not.toHaveBeenCalled();
  });

  it('remaining comes from the claimed counter value', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ count: 7 }]);
    const r = await upsertKingPrediction(input());
    expect(r.remaining).toBe(3);
  });

  it('same fixture under a second provider id is a duplicate (A12)', async () => {
    mockTx.prediction.create.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['userId', 'canonicalFixtureKey'] } }),
    );
    expect(await reason(upsertKingPrediction(input({ apiMatchId: 1234567 })))).toBe('DUPLICATE_FIXTURE');
  });
});
