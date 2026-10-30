/**
 * Settlement lock + gate integration around PredictionResolverService.
 * Prisma / Redis / snapshot / XP / notifications are mocked.
 */

const mockAcquire = jest.fn();
const mockLoad = jest.fn();
const mockFindMany = jest.fn();
const mockTransaction = jest.fn();
const mockAwardXp = jest.fn();
const mockNotify = jest.fn();

const mockBeat = jest.fn(async () => true);
const mockHeartbeatStop = jest.fn();
let heartbeatLost = false;
jest.mock('../prediction-settle-lock', () => ({
  acquireSettleLock: (...args: unknown[]) => mockAcquire(...args),
  startLeaseHeartbeat: () => ({
    isLost: () => heartbeatLost,
    beat: async () => {
      const ok = await mockBeat();
      if (!ok) heartbeatLost = true;
      return ok;
    },
    stop: mockHeartbeatStop,
  }),
}));

const mockVoid = jest.fn(async () => 0);
jest.mock('../prediction-void.service', () => ({
  maybeVoidMatchPredictions: (...a: unknown[]) => mockVoid(...(a as [])),
}));

jest.mock('../prediction-settlement-snapshot', () => ({
  loadAuthoritativeSettlementFixture: (...args: unknown[]) => mockLoad(...args),
}));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    prediction: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock('../xp.service', () => ({
  XP_VALUES: { PREDICTION_WINNER: 1, PREDICTION_EXACT: 1 },
  levelFromXp: (xp: number) => Math.max(1, Math.floor(xp / 100)),
  awardXp: (...a: unknown[]) => mockAwardXp(...a),
}));

jest.mock('../notification.service', () => ({
  NotificationService: {
    sendPredictionResultNotification: (...a: unknown[]) => mockNotify(...a),
  },
}));

jest.mock('../../middleware/responseCache.middleware', () => ({
  clearResponseCache: jest.fn().mockResolvedValue(undefined),
}));

const mockSchemaOk = jest.fn(() => true);
jest.mock('../schema-guard.service', () => ({ isSchemaOk: () => mockSchemaOk() }));

import { PredictionResolverService } from '../prediction-resolver.service';

function releaseOk() {
  return {
    ok: true as const,
    handle: {
      kind: 'lease' as const,
      owner: 'o',
      extend: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    },
    waitMs: 1,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  heartbeatLost = false;
  mockBeat.mockResolvedValue(true);
  mockVoid.mockResolvedValue(0);
  PredictionResolverService.__resetShutdownForTests();
  mockAcquire.mockResolvedValue(releaseOk());
  mockAwardXp.mockResolvedValue({ awarded: 1 });
  mockNotify.mockResolvedValue(undefined);
});

function txRecorder(outcomes: Array<{ id: string; isCorrect: boolean }>) {
  return async (fn: (tx: any) => Promise<boolean>) =>
    fn({
      prediction: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          outcomes.push({ id: where.id, isCorrect: data.isCorrect });
          return { count: 1 };
        }),
      },
      user: {
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ xp: 0, level: 1 }),
      },
      coinTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      xpTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    });
}

function row(id: string, matchDate: Date | null, predictionType = 'home') {
  return {
    id,
    userId: `u-${id}`,
    predictionType,
    predictedHomeScore: null,
    predictedAwayScore: null,
    homeTeam: 'H',
    awayTeam: 'A',
    homeTeamLogo: null,
    awayTeamLogo: null,
    leagueName: null,
    matchDate,
  };
}

describe('PredictionResolverService schema + push policy (U1)', () => {
  afterEach(() => {
    mockSchemaOk.mockReturnValue(true);
    delete process.env.PREDICTION_SETTLE_PUSH_MODE;
  });

  it('returns SETTLE_SKIPPED_SCHEMA and writes nothing', async () => {
    mockSchemaOk.mockReturnValue(false);
    const r = await PredictionResolverService.resolveMatchPredictions(5, { source: 'prediction-watcher' });
    expect(r).toEqual({ outcome: 'SETTLE_SKIPPED_SCHEMA', settled: 0, staleOnly: false });
    expect(mockAcquire).not.toHaveBeenCalled();
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('stale kickoff settles silently and reports staleOnly', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 1, awayScore: 0 });
    mockFindMany.mockResolvedValue([row('old', new Date('2026-06-01T15:00:00Z'))]);
    const outcomes: Array<{ id: string; isCorrect: boolean }> = [];
    mockTransaction.mockImplementation(txRecorder(outcomes));

    const r = await PredictionResolverService.resolveMatchPredictions(11, { source: 'prediction-watcher' });
    expect(outcomes).toEqual([{ id: 'old', isCorrect: true }]);
    expect(mockNotify).not.toHaveBeenCalled();
    expect(r).toEqual({ outcome: 'SETTLE_COMPLETE', settled: 1, staleOnly: true });
  });

  it('fresh kickoff pushes live', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 0, awayScore: 0 });
    mockFindMany.mockResolvedValue([row('fresh', new Date(Date.now() - 2 * 3600_000), 'draw')]);
    mockTransaction.mockImplementation(txRecorder([]));

    const r = await PredictionResolverService.resolveMatchPredictions(12, { source: 'prediction-watcher' });
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify.mock.calls[0][5]).toEqual({ skipPush: false });
    expect(r.staleOnly).toBe(false);
  });

  it('double settle writes one coin row (B7)', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 1, awayScore: 0 });
    mockFindMany.mockResolvedValue([row('p7', null)]);
    const credited = new Set<string>();
    const coinCreate = jest.fn(async ({ data }: any) => credited.add(data.idempotencyKey));
    const userUpdate = jest.fn();
    mockTransaction.mockImplementation(async (fn: (tx: any) => Promise<boolean>) =>
      fn({
        prediction: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        user: { update: userUpdate, findUniqueOrThrow: jest.fn().mockResolvedValue({ xp: 0, level: 1 }) },
        coinTransaction: {
          findUnique: jest.fn(async ({ where }: any) =>
            credited.has(where.idempotencyKey) ? { id: 'c1' } : null,
          ),
          create: coinCreate,
        },
        xpTransaction: { findUnique: jest.fn().mockResolvedValue({ id: 'x' }), create: jest.fn() },
      }),
    );

    await PredictionResolverService.resolveMatchPredictions(21, { source: 'prediction-watcher' });
    await PredictionResolverService.resolveMatchPredictions(21, { source: 'live-fixture-sync' });
    expect(coinCreate).toHaveBeenCalledTimes(1);
    expect(coinCreate.mock.calls[0][0].data.idempotencyKey).toBe('prediction:p7:coins');
    expect(userUpdate).toHaveBeenCalledTimes(1);
  });

  it('inbox_only mode writes inbox with skipPush', async () => {
    process.env.PREDICTION_SETTLE_PUSH_MODE = 'inbox_only';
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 0, awayScore: 0 });
    mockFindMany.mockResolvedValue([row('fresh', new Date(Date.now() - 3600_000), 'draw')]);
    mockTransaction.mockImplementation(txRecorder([]));

    await PredictionResolverService.resolveMatchPredictions(13, { source: 'prediction-watcher' });
    expect(mockNotify.mock.calls[0][5]).toEqual({ skipPush: true });
  });
});

describe('PredictionResolverService.resolveMatchPredictions', () => {
  it('skips when lock is held', async () => {
    mockAcquire.mockResolvedValue({
      ok: false,
      reason: 'SETTLE_SKIPPED_LOCKED',
      waitMs: 2,
    });
    await PredictionResolverService.resolveMatchPredictions(99, { source: 'prediction-watcher' });
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('skips when gate rejects invalid status (caller scores ignored)', async () => {
    mockLoad.mockResolvedValue({ status: 'PST', homeScore: 0, awayScore: 0 });
    await PredictionResolverService.resolveMatchPredictions(1, 9, 9, { source: 'live-fixture-sync' });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('skips PEN without shootout data — predictions stay pending', async () => {
    mockLoad.mockResolvedValue({
      status: 'PEN',
      homeScore: 1,
      awayScore: 1,
      penaltyHome: null,
      penaltyAway: null,
    });
    await PredictionResolverService.resolveMatchPredictions(2, { source: 'match-event-delivery' });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('settles PEN with away shootout winner', async () => {
    mockLoad.mockResolvedValue({
      status: 'PEN',
      homeScore: 1,
      awayScore: 1,
      penaltyHome: 3,
      penaltyAway: 5,
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'p-away',
        userId: 'u1',
        predictionType: 'away',
        predictedHomeScore: null,
        predictedAwayScore: null,
        homeTeam: 'H',
        awayTeam: 'A',
        homeTeamLogo: null,
        awayTeamLogo: null,
        leagueName: null,
        matchDate: null,
      },
      {
        id: 'p-home',
        userId: 'u2',
        predictionType: 'home',
        predictedHomeScore: null,
        predictedAwayScore: null,
        homeTeam: 'H',
        awayTeam: 'A',
        homeTeamLogo: null,
        awayTeamLogo: null,
        leagueName: null,
        matchDate: null,
      },
      {
        id: 'p-draw',
        userId: 'u3',
        predictionType: 'draw',
        predictedHomeScore: null,
        predictedAwayScore: null,
        homeTeam: 'H',
        awayTeam: 'A',
        homeTeamLogo: null,
        awayTeamLogo: null,
        leagueName: null,
        matchDate: null,
      },
    ]);

    const outcomes: Array<{ id: string; isCorrect: boolean }> = [];
    mockTransaction.mockImplementation(async (fn: (tx: any) => Promise<boolean>) => {
      const tx = {
        prediction: {
          updateMany: jest.fn(async ({ where, data }: any) => {
            outcomes.push({ id: where.id, isCorrect: data.isCorrect });
            return { count: 1 };
          }),
        },
        user: {
          update: jest.fn(),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ xp: 0, level: 1 }),
        },
        coinTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
        xpTransaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
      };
      return fn(tx);
    });

    await PredictionResolverService.resolveMatchPredictions(3, { source: 'prediction-watcher' });

    expect(outcomes).toEqual([
      { id: 'p-away', isCorrect: true },
      { id: 'p-home', isCorrect: false },
      { id: 'p-draw', isCorrect: false },
    ]);
  });

  it('parallel calls: second skips when lock already held', async () => {
    mockAcquire
      .mockResolvedValueOnce(releaseOk())
      .mockResolvedValueOnce({ ok: false, reason: 'SETTLE_SKIPPED_LOCKED', waitMs: 0 });
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 1, awayScore: 0 });
    mockFindMany.mockResolvedValue([]);

    await PredictionResolverService.resolveMatchPredictions(7, { source: 'live-fixture-sync' });
    await PredictionResolverService.resolveMatchPredictions(7, { source: 'prediction-watcher' });

    expect(mockAcquire).toHaveBeenCalledTimes(2);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('idempotent: already-resolved rows (updateMany count 0) award nothing', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 2, awayScore: 0 });
    mockFindMany.mockResolvedValue([
      {
        id: 'p1',
        userId: 'u1',
        predictionType: 'home',
        predictedHomeScore: null,
        predictedAwayScore: null,
        homeTeam: null,
        awayTeam: null,
        homeTeamLogo: null,
        awayTeamLogo: null,
        leagueName: null,
        matchDate: null,
      },
    ]);
    mockTransaction.mockImplementation(async (fn: (tx: any) => Promise<boolean>) => {
      const tx = {
        prediction: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        user: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
        coinTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
        xpTransaction: { findUnique: jest.fn(), create: jest.fn() },
      };
      return fn(tx);
    });

    await PredictionResolverService.resolveMatchPredictions(8, { source: 'admin' });
    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  it('three sources for same match: only lock holders settle once each attempt', async () => {
    mockAcquire
      .mockResolvedValueOnce(releaseOk())
      .mockResolvedValueOnce({ ok: false, reason: 'SETTLE_SKIPPED_LOCKED', waitMs: 0 })
      .mockResolvedValueOnce({ ok: false, reason: 'SETTLE_SKIPPED_LOCKED', waitMs: 0 });
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 0, awayScore: 1 });
    mockFindMany.mockResolvedValue([]);

    await Promise.all([
      PredictionResolverService.resolveMatchPredictions(10, { source: 'prediction-watcher' }),
      PredictionResolverService.resolveMatchPredictions(10, { source: 'live-fixture-sync' }),
      PredictionResolverService.resolveMatchPredictions(10, { source: 'match-event-delivery' }),
    ]);

    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('only pending, non-voided rows are loaded', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 1, awayScore: 0 });
    mockFindMany.mockResolvedValue([]);
    await PredictionResolverService.resolveMatchPredictions(30, { source: 'prediction-watcher' });
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ apiMatchId: 30, isCorrect: null, voidedAt: null });
  });
});

describe('single fetch (E7)', () => {
  it('reuses a snapshot fetched under 60s ago', async () => {
    mockFindMany.mockResolvedValue([]);
    await PredictionResolverService.resolveMatchPredictions(40, {
      source: 'prediction-watcher',
      prefetched: { snapshot: { status: 'FT', homeScore: 1, awayScore: 0 }, fetchedAt: Date.now() - 5_000 },
    });
    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when the prefetched snapshot is older than 60s', async () => {
    mockLoad.mockResolvedValue({ status: 'NS', homeScore: null, awayScore: null });
    const r = await PredictionResolverService.resolveMatchPredictions(41, {
      source: 'prediction-watcher',
      prefetched: { snapshot: { status: 'FT', homeScore: 1, awayScore: 0 }, fetchedAt: Date.now() - 61_000 },
    });
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(r.outcome).toBe('SETTLE_GATE_REJECTED');
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('lease heartbeat (A6)', () => {
  it('stops at the chunk boundary when the lease is lost; the rest stay pending', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 1, awayScore: 0 });
    mockFindMany.mockResolvedValue(Array.from({ length: 450 }, (_, i) => row(`r${i}`, null)));
    const outcomes: Array<{ id: string; isCorrect: boolean }> = [];
    mockTransaction.mockImplementation(txRecorder(outcomes));
    mockBeat.mockResolvedValue(false);
    const lock = releaseOk();
    mockAcquire.mockResolvedValue(lock);

    const r = await PredictionResolverService.resolveMatchPredictions(50, { source: 'prediction-watcher' });

    expect(r).toEqual({ outcome: 'SETTLE_LOCK_LOST', settled: 200, staleOnly: false });
    expect(outcomes).toHaveLength(200);
    expect(mockHeartbeatStop).toHaveBeenCalledTimes(1);
    expect(lock.handle.release).toHaveBeenCalledTimes(1);
  });

  it('a healthy lease settles every chunk', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 1, awayScore: 0 });
    mockFindMany.mockResolvedValue(Array.from({ length: 450 }, (_, i) => row(`r${i}`, null)));
    mockTransaction.mockImplementation(txRecorder([]));

    const r = await PredictionResolverService.resolveMatchPredictions(51, { source: 'prediction-watcher' });
    expect(r.outcome).toBe('SETTLE_COMPLETE');
    expect(r.settled).toBe(450);
    expect(mockBeat).toHaveBeenCalledTimes(2);
  });
});

describe('shutdown drain (E5)', () => {
  it('refuses new settles after beginShutdown', async () => {
    PredictionResolverService.beginShutdown();
    const r = await PredictionResolverService.resolveMatchPredictions(60, { source: 'prediction-watcher' });
    expect(r.outcome).toBe('SETTLE_SKIPPED_SHUTDOWN');
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('in-flight settle stops at the next row, releases, and drain resolves', async () => {
    mockLoad.mockResolvedValue({ status: 'FT', homeScore: 1, awayScore: 0 });
    mockFindMany.mockResolvedValue([row('a', null), row('b', null), row('c', null)]);
    let releaseFirst!: () => void;
    const firstRowGate = new Promise<void>((r) => (releaseFirst = r));
    const outcomes: Array<{ id: string; isCorrect: boolean }> = [];
    const record = txRecorder(outcomes);
    mockTransaction.mockImplementation(async (fn: any) => {
      if (outcomes.length === 0) await firstRowGate;
      return record(fn);
    });
    const lock = releaseOk();
    mockAcquire.mockResolvedValue(lock);

    const pending = PredictionResolverService.resolveMatchPredictions(61, { source: 'prediction-watcher' });
    await new Promise((r) => setTimeout(r, 10));
    PredictionResolverService.beginShutdown();
    const drained = PredictionResolverService.drain(2_000);
    releaseFirst();

    const r = await pending;
    expect(r).toEqual({ outcome: 'SETTLE_ABORTED_SHUTDOWN', settled: 1, staleOnly: false });
    expect(outcomes).toEqual([{ id: 'a', isCorrect: true }]);
    await expect(drained).resolves.toBe(true);
    expect(lock.handle.release).toHaveBeenCalledTimes(1);
  });
});

describe('VOID hand-off (E11)', () => {
  it('a never-final status goes to the void path under the lease', async () => {
    mockLoad.mockResolvedValue({ status: 'CANC', homeScore: null, awayScore: null });
    mockVoid.mockResolvedValue(4);
    const r = await PredictionResolverService.resolveMatchPredictions(70, { source: 'prediction-watcher' });
    expect(mockVoid).toHaveBeenCalledWith(70, 'CANC', 'prediction-watcher');
    expect(r.outcome).toBe('SETTLE_VOIDED');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('nothing voided (flag off / too recent) stays a gate reject', async () => {
    mockLoad.mockResolvedValue({ status: 'PST', homeScore: null, awayScore: null });
    const r = await PredictionResolverService.resolveMatchPredictions(71, { source: 'prediction-watcher' });
    expect(r.outcome).toBe('SETTLE_GATE_REJECTED');
  });
});
