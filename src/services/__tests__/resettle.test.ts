/**
 * Admin re-settle (A7, Q3). Prisma is an in-memory ledger so a second apply
 * can prove the credits are paid once.
 */

type Row = Record<string, any>;
const db = {
  predictions: [] as Row[],
  coins: [] as Row[],
  xp: [] as Row[],
  users: new Map<string, { coins: number; xp: number; role: string }>(),
  runs: [] as Row[],
  items: [] as Row[],
};
const writes = jest.fn();

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'not' in v) return row[k] !== v.not;
    if (v && typeof v === 'object' && 'in' in v) return (v.in as unknown[]).includes(row[k]);
    return row[k] === v;
  });
}

const mockPrisma: any = {
  prediction: {
    findMany: jest.fn(async ({ where }: any) => db.predictions.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
    updateMany: jest.fn(async ({ where, data }: any) => {
      writes('prediction.updateMany');
      const hit = db.predictions.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
  },
  coinTransaction: {
    findFirst: jest.fn(async ({ where }: any) => db.coins.find((r) => matches(r, where)) ?? null),
    create: jest.fn(async ({ data }: any) => { writes('coin.create'); db.coins.push(data); return data; }),
  },
  xpTransaction: {
    findFirst: jest.fn(async ({ where }: any) => db.xp.find((r) => matches(r, where)) ?? null),
    create: jest.fn(async ({ data }: any) => { writes('xp.create'); db.xp.push(data); return data; }),
  },
  user: {
    update: jest.fn(async ({ where, data }: any) => {
      writes('user.update');
      const u = db.users.get(where.id)!;
      if (data.coins?.increment) u.coins += data.coins.increment;
      if (typeof data.xp === 'number') u.xp = data.xp;
      return u;
    }),
    findUniqueOrThrow: jest.fn(async ({ where }: any) => db.users.get(where.id)),
    findUnique: jest.fn(async ({ where }: any) =>
      where.clerkUserId === 'clerk_admin'
        ? { id: 'admin', role: 'ADMIN', username: 'a' }
        : where.clerkUserId === 'clerk_user'
          ? { id: 'u9', role: 'USER', username: 'u' }
          : null),
  },
  predictionResettleRun: {
    create: jest.fn(async ({ data }: any) => { writes('run.create'); const r = { id: `run${db.runs.length + 1}`, ...data }; db.runs.push(r); return r; }),
    update: jest.fn(async ({ where, data }: any) => { writes('run.update'); const r = db.runs.find((x) => x.id === where.id)!; Object.assign(r, data); return r; }),
  },
  predictionResettleItem: {
    create: jest.fn(async ({ data }: any) => { writes('item.create'); db.items.push(data); return data; }),
  },
  $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

const mockAcquire = jest.fn();
jest.mock('../prediction-settle-lock', () => ({
  acquireSettleLock: (...a: unknown[]) => mockAcquire(...a),
  startLeaseHeartbeat: () => ({ isLost: () => false, beat: jest.fn(), stop: jest.fn() }),
}));
const mockLoad = jest.fn();
jest.mock('../prediction-settlement-snapshot', () => ({
  loadAuthoritativeSettlementFixture: (...a: unknown[]) => mockLoad(...a),
}));
jest.mock('../schema-guard.service', () => ({ isSchemaOk: () => true, getSchemaStatus: () => ({ ok: true }) }));
const mockNotify = jest.fn().mockResolvedValue(null);
jest.mock('../notification.service', () => ({
  NotificationService: { sendPredictionResultNotification: (...a: unknown[]) => mockNotify(...a) },
}));
jest.mock('../../middleware/responseCache.middleware', () => ({
  clearResponseCache: jest.fn().mockResolvedValue(undefined),
  responseCacheMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../settle-metrics.service', () => ({
  recordSettleMetric: jest.fn(),
  getSettleHealthSummary: jest.fn(),
  readSettleMetrics: jest.fn(),
  runSettleWatchdog: jest.fn(),
}));
jest.mock('../prediction-void.service', () => ({ maybeVoidMatchPredictions: jest.fn() }));
jest.mock('../xp.service', () => ({
  XP_VALUES: { PREDICTION_WINNER: 1, PREDICTION_EXACT: 3 },
  levelFromXp: (xp: number) => Math.floor(xp / 100),
  awardXp: jest.fn(),
}));

import { resettleMatchPredictions } from '../prediction-resettle.service';

const MATCH = 4999001;
const lease = { ok: true, waitMs: 0, handle: { kind: 'lease', owner: 'o', extend: jest.fn(), release: jest.fn() } };
// PEN 1-1, shootout 4-3: home wins, a draw pick is wrong.
const PEN = { status: 'PEN', homeScore: 1, awayScore: 1, penaltyHome: 4, penaltyAway: 3 };

function pred(id: string, userId: string, predictionType: string, isCorrect: boolean): Row {
  return {
    id, userId, apiMatchId: MATCH, predictionType, isCorrect, voidedAt: null,
    predictedHomeScore: null, predictedAwayScore: null, coinsWon: isCorrect ? 10 : 0,
    homeTeam: 'H', awayTeam: 'A', homeTeamLogo: null, awayTeamLogo: null, leagueName: null, matchDate: null,
    settledHomeScore: null, settledAwayScore: null, settledStatus: null, settledWinner: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  db.predictions = [
    pred('A', 'u1', 'home', false), // stored wrong, really right
    pred('B', 'u2', 'draw', true), // stored right, really wrong (draw on PEN)
    pred('C', 'u3', 'home', true), // right both ways
  ];
  db.coins = [{ userId: 'u2', idempotencyKey: 'prediction:B:coins', amount: 10 }];
  db.xp = [];
  db.users = new Map([
    ['u1', { coins: 0, xp: 0, role: 'USER' }],
    ['u2', { coins: 10, xp: 1, role: 'USER' }],
    ['u3', { coins: 10, xp: 1, role: 'USER' }],
  ]);
  db.runs = [];
  db.items = [];
  mockAcquire.mockResolvedValue(lease);
  mockLoad.mockResolvedValue(PEN);
});

it('resettle.dryrun-writes-nothing', async () => {
  const result = await resettleMatchPredictions(MATCH, { dryRun: true });

  expect(result).toMatchObject({ ok: true, dryRun: true, runId: null, counts: { wrongToCorrect: 1, correctToWrong: 1, unchanged: 1 } });
  expect(writes).not.toHaveBeenCalled();
  expect(db.predictions.find((r) => r.id === 'A')!.isCorrect).toBe(false);
  expect(mockNotify).not.toHaveBeenCalled();
  expect(lease.handle.release).toHaveBeenCalled();
});

it('resettle.apply-twice-one-credit', async () => {
  const first = await resettleMatchPredictions(MATCH, { dryRun: false, adminUserId: 'clerk_admin' });
  const second = await resettleMatchPredictions(MATCH, { dryRun: false, adminUserId: 'clerk_admin' });

  expect(first).toMatchObject({ ok: true, credited: { coins: 10, xp: 1 } });
  expect(second).toMatchObject({ ok: true, counts: { wrongToCorrect: 0 }, credited: { coins: 0, xp: 0 } });
  const a = db.predictions.find((r) => r.id === 'A')!;
  expect(a).toMatchObject({ isCorrect: true, coinsWon: 10, settledStatus: 'PEN', settledWinner: 'home', resettleRunId: 'run1' });
  expect(db.coins.filter((c) => c.userId === 'u1')).toEqual([
    expect.objectContaining({ idempotencyKey: 'prediction:A:resettle:coins', amount: 10 }),
  ]);
  expect(db.xp.filter((x) => x.userId === 'u1')).toHaveLength(1);
  expect(db.users.get('u1')).toMatchObject({ coins: 10, xp: 1 });
  // Q9: in-app only.
  expect(mockNotify).toHaveBeenCalledTimes(1);
  expect(mockNotify.mock.calls[0][5]).toEqual({ skipPush: true });
});

it('a row already paid under the original key is flipped but not paid again', async () => {
  db.coins.push({ userId: 'u1', idempotencyKey: 'prediction:A:coins', amount: 10 });
  db.xp.push({ userId: 'u1', idempotencyKey: 'prediction:A', amount: 1 });

  const result = await resettleMatchPredictions(MATCH, { dryRun: false });

  expect(result).toMatchObject({ ok: true, credited: { coins: 0, xp: 0 } });
  expect(db.predictions.find((r) => r.id === 'A')!.isCorrect).toBe(true);
  expect(db.coins.filter((c) => c.userId === 'u1')).toHaveLength(1);
});

it('resettle.correctToWrong-untouched', async () => {
  await resettleMatchPredictions(MATCH, { dryRun: false });

  expect(db.predictions.find((r) => r.id === 'B')).toMatchObject({ isCorrect: true, coinsWon: 10 });
  expect(db.users.get('u2')).toMatchObject({ coins: 10, xp: 1 });
  expect(db.items).toContainEqual(expect.objectContaining({ predictionId: 'B', bucket: 'correctToWrong', applied: false }));
  expect(db.items.some((i) => i.predictionId === 'C')).toBe(false);
});

it('resettle.blocked-while-settling', async () => {
  mockAcquire.mockResolvedValue({ ok: false, reason: 'SETTLE_SKIPPED_LOCKED', waitMs: 0 });

  const result = await resettleMatchPredictions(MATCH, { dryRun: false });

  expect(result).toEqual({ ok: false, apiMatchId: MATCH, reason: 'SETTLE_SKIPPED_LOCKED' });
  expect(mockLoad).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
});

it('gate rejection (no result) writes nothing', async () => {
  mockLoad.mockResolvedValue({ status: 'ABD', homeScore: 0, awayScore: 0, penaltyHome: null, penaltyAway: null });

  const result = await resettleMatchPredictions(MATCH, { dryRun: false });

  expect(result).toMatchObject({ ok: false, reason: 'GATE_REJECTED' });
  expect(writes).not.toHaveBeenCalled();
});

describe('route', () => {
  jest.mock('../../middleware/clerk.middleware', () => ({
    requireAuth: (req: any, _res: any, next: () => void) => {
      req.auth = { userId: req.headers['x-user'] };
      next();
    },
    optionalAuth: (_req: any, _res: any, next: () => void) => next(),
  }));
  jest.mock('../block.service', () => ({ getBlockRelation: jest.fn() }));
  jest.mock('../../middleware/rateLimit.middleware', () => ({
    predictionWriteLimiter: (_req: any, _res: any, next: () => void) => next(),
  }));
  jest.mock('../king-prediction.service', () => ({}));

  async function call(user: string, query: Record<string, string> = {}) {
    const router = (await import('../../routes/predictions.routes')).default as any;
    const layer = router.stack.find((l: any) => l.route?.path === '/admin/resettle/:matchId' && l.route.methods.post);
    const req: any = { params: { matchId: String(MATCH) }, query, headers: { 'x-user': user }, path: '/x', method: 'POST' };
    const res: any = { statusCode: 200, body: undefined };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: unknown) => { res.body = b; return res; };
    for (const { handle } of layer.route.stack) {
      let next = false;
      await handle(req, res, () => { next = true; });
      if (!next) break;
    }
    return res;
  }

  it('resettle.requires-admin', async () => {
    const res = await call('clerk_user', { dryRun: '0' });
    expect(res.statusCode).toBe(403);
    expect(mockAcquire).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it('admin without dryRun=0 gets a dry run', async () => {
    const res = await call('clerk_admin');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({ dryRun: true, counts: { wrongToCorrect: 1 } });
    expect(writes).not.toHaveBeenCalled();
  });
});
