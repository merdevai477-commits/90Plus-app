/**
 * Voice quota state machine against an in-memory Prisma double. The double
 * serializes transactions the way the per-user `FOR UPDATE` lock does in
 * Postgres; the real lock is exercised by chat-voice-quota.integration.test.ts.
 */

type Usage = { userId: string; windowStart: Date; updatedAt: Date };
type Op = {
  id: string;
  userId: string;
  idempotencyKey: string;
  status: string;
  attempt: number;
  windowStart: Date;
  transcript: string | null;
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const db = { usage: new Map<string, Usage>(), ops: [] as Op[], seq: 0 };

function matches(op: Op, where: any): boolean {
  if (where.id !== undefined && op.id !== where.id) return false;
  if (where.userId !== undefined && op.userId !== where.userId) return false;
  if (where.attempt !== undefined && op.attempt !== where.attempt) return false;
  if (where.status !== undefined && op.status !== where.status) return false;
  if (where.windowStart !== undefined && op.windowStart.getTime() !== where.windowStart.getTime()) return false;
  if (where.updatedAt?.gt && !(op.updatedAt.getTime() > where.updatedAt.gt.getTime())) return false;
  if (where.OR && !where.OR.some((w: any) => matches(op, w))) return false;
  return true;
}

const client = {
  /** The lock-taking upsert: INSERT … ON CONFLICT DO UPDATE … RETURNING "windowStart". */
  $queryRaw: async (_s: TemplateStringsArray, userId: string, now: Date) => {
    const row = db.usage.get(userId) ?? { userId, windowStart: now, updatedAt: now };
    row.updatedAt = now;
    db.usage.set(userId, row);
    return [{ windowStart: row.windowStart }];
  },
  chatVoiceUsage: {
    findUnique: async ({ where }: any) => db.usage.get(where.userId) ?? null,
    update: async ({ where, data }: any) => {
      const row = db.usage.get(where.userId)!;
      Object.assign(row, data);
      return row;
    },
  },
  chatVoiceOperation: {
    findUnique: async ({ where }: any) => {
      const { userId, idempotencyKey } = where.userId_idempotencyKey;
      const op = db.ops.find((o) => o.userId === userId && o.idempotencyKey === idempotencyKey);
      return op ? { ...op } : null;
    },
    count: async ({ where }: any) => db.ops.filter((o) => matches(o, where)).length,
    create: async ({ data }: any) => {
      const op: Op = {
        id: `op-${++db.seq}`,
        attempt: 1,
        transcript: null,
        failureCode: null,
        ...data,
      };
      db.ops.push(op);
      return { ...op };
    },
    update: async ({ where, data }: any) => {
      const op = db.ops.find((o) => o.id === where.id)!;
      Object.assign(op, data);
      return { ...op };
    },
    updateMany: async ({ where, data }: any) => {
      const hits = db.ops.filter((o) => matches(o, where));
      hits.forEach((o) => Object.assign(o, data, { updatedAt: new Date() }));
      return { count: hits.length };
    },
  },
};

let txQueue: Promise<unknown> = Promise.resolve();
const fakePrisma = {
  ...client,
  $transaction: (fn: (tx: typeof client) => Promise<unknown>, _opts?: unknown) => {
    const run = txQueue.then(() => fn(client));
    txQueue = run.catch(() => undefined);
    return run;
  },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, prisma: fakePrisma, default: fakePrisma }));
jest.mock('../chat.service', () => ({ isChatUnlimitedUser: jest.fn(() => false) }));

import { isChatUnlimitedUser } from '../chat.service';
import {
  commitVoiceUnit,
  getVoiceQuota,
  markVoiceTimedOut,
  releaseVoiceUnit,
  reserveVoiceUnit,
} from '../chat-voice-quota.service';

const USER = 'user_test';
const T0 = new Date('2026-10-13T10:00:00.000Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

async function reserved(key: string, now = T0) {
  const r = await reserveVoiceUnit(USER, key, now);
  if (r.kind !== 'reserved') throw new Error(`expected reserved, got ${r.kind}`);
  return r;
}

beforeEach(() => {
  db.usage.clear();
  db.ops = [];
  db.seq = 0;
  process.env.VOICE_DAILY_LIMIT = '5';
  process.env.VOICE_RESERVATION_TTL_MS = '120000';
  (isChatUnlimitedUser as jest.Mock).mockReturnValue(false);
});

describe('chat voice quota', () => {
  it('a successful transcription consumes exactly one unit', async () => {
    const r = await reserved('key-success');
    expect(r.quota.remaining).toBe(4);
    expect(await commitVoiceUnit(r.operationId, r.attempt, 'hello')).toBe(true);
    expect((await getVoiceQuota(USER, T0)).remaining).toBe(4);
  });

  it('an empty transcript or provider failure gives the unit back', async () => {
    const a = await reserved('key-empty');
    await releaseVoiceUnit(a.operationId, a.attempt, 'empty_transcript');
    const b = await reserved('key-failed');
    await releaseVoiceUnit(b.operationId, b.attempt, 'provider_failed');
    expect((await getVoiceQuota(USER, T0)).remaining).toBe(5);
  });

  it('a timed-out operation is recorded but not billed', async () => {
    const r = await reserved('key-timeout');
    expect(await markVoiceTimedOut(r.operationId, r.attempt)).toBe(true);
    expect((await getVoiceQuota(USER, T0)).remaining).toBe(5);
    expect(db.ops[0].status).toBe('TIMED_OUT');
  });

  it('a reservation settles at most once', async () => {
    const r = await reserved('key-once');
    expect(await commitVoiceUnit(r.operationId, r.attempt, 'hi')).toBe(true);
    expect(await commitVoiceUnit(r.operationId, r.attempt, 'hi')).toBe(false);
    expect(await releaseVoiceUnit(r.operationId, r.attempt, 'late')).toBe(false);
    expect(db.ops[0].status).toBe('COMMITTED');
  });

  it("a stale attempt cannot settle a newer attempt's reservation", async () => {
    const first = await reserved('key-retry');
    await releaseVoiceUnit(first.operationId, first.attempt, 'provider_failed');
    const second = await reserved('key-retry');
    expect(second.operationId).toBe(first.operationId);
    expect(second.attempt).toBe(first.attempt + 1);
    expect(await releaseVoiceUnit(first.operationId, first.attempt, 'late')).toBe(false);
    expect(await commitVoiceUnit(second.operationId, second.attempt, 'ok')).toBe(true);
  });

  it('replaying a committed key returns its transcript without a new unit', async () => {
    const r = await reserved('key-replay');
    await commitVoiceUnit(r.operationId, r.attempt, 'cached text');
    const again = await reserveVoiceUnit(USER, 'key-replay', T0);
    expect(again).toMatchObject({ kind: 'cached', transcript: 'cached text' });
    expect(again.quota.remaining).toBe(4);
    expect(db.ops).toHaveLength(1);
  });

  it('a key that is still in flight is reported, not reserved twice', async () => {
    await reserved('key-inflight');
    const again = await reserveVoiceUnit(USER, 'key-inflight', T0);
    expect(again.kind).toBe('in_progress');
    expect(db.ops).toHaveLength(1);
  });

  it('refuses once the daily limit is reached', async () => {
    process.env.VOICE_DAILY_LIMIT = '2';
    for (const key of ['k-1', 'k-2']) {
      const r = await reserved(key);
      await commitVoiceUnit(r.operationId, r.attempt, 'x');
    }
    const third = await reserveVoiceUnit(USER, 'k-3', T0);
    expect(third).toMatchObject({ kind: 'exhausted', quota: { remaining: 0, limit: 2 } });
  });

  it('parallel reservations never exceed the limit', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserveVoiceUnit(USER, `parallel-${i}`, T0)),
    );
    expect(results.filter((r) => r.kind === 'reserved')).toHaveLength(5);
    expect(results.filter((r) => r.kind === 'exhausted')).toHaveLength(7);
  });

  it('an abandoned reservation stops counting after its TTL', async () => {
    process.env.VOICE_DAILY_LIMIT = '1';
    await reserved('key-abandoned', T0);
    expect((await reserveVoiceUnit(USER, 'key-next', minutes(1))).kind).toBe('exhausted');
    expect((await reserveVoiceUnit(USER, 'key-next', minutes(3))).kind).toBe('reserved');
  });

  it('the window resets 24h after it opened', async () => {
    process.env.VOICE_DAILY_LIMIT = '1';
    const r = await reserved('key-day1', T0);
    await commitVoiceUnit(r.operationId, r.attempt, 'x');
    const before = await getVoiceQuota(USER, minutes(60));
    expect(before.remaining).toBe(0);
    expect(before.resetAt?.toISOString()).toBe('2026-10-14T10:00:00.000Z');

    const nextDay = minutes(24 * 60);
    expect((await getVoiceQuota(USER, nextDay)).remaining).toBe(1);
    const day2 = await reserved('key-day2', nextDay);
    expect(day2.quota.resetAt?.toISOString()).toBe('2026-10-15T10:00:00.000Z');
  });

  it('unlimited chat users are unlimited for voice too', async () => {
    (isChatUnlimitedUser as jest.Mock).mockReturnValue(true);
    process.env.VOICE_DAILY_LIMIT = '1';
    for (let i = 0; i < 3; i += 1) {
      const r = await reserved(`unlimited-${i}`);
      await commitVoiceUnit(r.operationId, r.attempt, 'x');
    }
    expect((await getVoiceQuota(USER, T0)).unlimited).toBe(true);
  });
});
