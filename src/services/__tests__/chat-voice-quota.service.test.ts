/**
 * Voice-time allowance state machine against an in-memory Prisma double. The
 * double serializes transactions the way the per-user `FOR UPDATE` lock does
 * in Postgres; the real lock is exercised by chat-voice-quota.integration.test.ts.
 */

type Usage = { userId: string; windowStart: Date; updatedAt: Date };
type Op = {
  id: string;
  userId: string;
  idempotencyKey: string;
  status: string;
  attempt: number;
  windowStart: Date;
  durationMs: number;
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
    aggregate: async ({ where }: any) => {
      const hits = db.ops.filter((o) => matches(o, where));
      return { _sum: { durationMs: hits.length ? hits.reduce((s, o) => s + o.durationMs, 0) : null } };
    },
    create: async ({ data }: any) => {
      const op: Op = {
        id: `op-${++db.seq}`,
        attempt: 1,
        durationMs: 0,
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
  commitVoiceOperation,
  getVoiceQuota,
  markVoiceTimedOut,
  releaseVoiceOperation,
  reserveVoiceDuration,
  voiceQuotaResponseFields,
} from '../chat-voice-quota.service';

const USER = 'user_test';
const T0 = new Date('2026-10-13T10:00:00.000Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const sec = (n: number) => n * 1000;

async function reserved(key: string, durationMs: number, now = T0) {
  const r = await reserveVoiceDuration(USER, key, durationMs, now);
  if (r.kind !== 'reserved') throw new Error(`expected reserved, got ${r.kind}`);
  return r;
}

async function charge(key: string, durationMs: number, now = T0) {
  const r = await reserved(key, durationMs, now);
  await commitVoiceOperation(r.operationId, r.attempt, 'text');
  return r;
}

async function remainingSeconds(now = T0) {
  return voiceQuotaResponseFields(await getVoiceQuota(USER, now)).voiceRemainingSeconds;
}

beforeEach(() => {
  db.usage.clear();
  db.ops = [];
  db.seq = 0;
  delete process.env.VOICE_DAILY_SECONDS;
  process.env.VOICE_RESERVATION_TTL_MS = '120000';
  (isChatUnlimitedUser as jest.Mock).mockReturnValue(false);
});

describe('chat voice-time allowance', () => {
  it('defaults to 150 seconds a day', async () => {
    expect(voiceQuotaResponseFields(await getVoiceQuota(USER, T0))).toEqual({
      voiceRemainingSeconds: 150,
      voiceLimitSeconds: 150,
      voiceResetAt: null,
    });
  });

  it('a 10s recording consumes 10s and a 30s recording 30s', async () => {
    const ten = await charge('key-10', sec(10));
    expect(ten.chargedMs).toBe(10_000);
    expect(await remainingSeconds()).toBe(140);
    await charge('key-30', sec(30));
    expect(await remainingSeconds()).toBe(110);
  });

  it('charges the measured milliseconds, never rounding up to a whole second', async () => {
    const r = await charge('key-frac', 2_340);
    expect(r.chargedMs).toBe(2_340);
    expect((await getVoiceQuota(USER, T0)).usedMs).toBe(2_340);
    // 147.66s left is reported as 147, so the app never offers time that isn't there.
    expect(await remainingSeconds()).toBe(147);
  });

  it('an empty transcript or provider failure gives the time back', async () => {
    const a = await reserved('key-empty', sec(20));
    await releaseVoiceOperation(a.operationId, a.attempt, 'empty_transcript');
    const b = await reserved('key-failed', sec(25));
    await releaseVoiceOperation(b.operationId, b.attempt, 'provider_failed');
    expect(await remainingSeconds()).toBe(150);
  });

  it('a timed-out operation is recorded but not charged', async () => {
    const r = await reserved('key-timeout', sec(15));
    expect(await markVoiceTimedOut(r.operationId, r.attempt)).toBe(true);
    expect(await remainingSeconds()).toBe(150);
    expect(db.ops[0].status).toBe('TIMED_OUT');
  });

  it('an in-flight reservation holds its time until it settles', async () => {
    await reserved('key-held', sec(30));
    expect(await remainingSeconds()).toBe(120);
  });

  it('a reservation settles at most once', async () => {
    const r = await reserved('key-once', sec(5));
    expect(await commitVoiceOperation(r.operationId, r.attempt, 'hi')).toBe(true);
    expect(await commitVoiceOperation(r.operationId, r.attempt, 'hi')).toBe(false);
    expect(await releaseVoiceOperation(r.operationId, r.attempt, 'late')).toBe(false);
    expect(db.ops[0].status).toBe('COMMITTED');
    expect(await remainingSeconds()).toBe(145);
  });

  it("a stale attempt cannot settle a newer attempt's reservation", async () => {
    const first = await reserved('key-retry', sec(12));
    await releaseVoiceOperation(first.operationId, first.attempt, 'provider_failed');
    const second = await reserved('key-retry', sec(12));
    expect(second.operationId).toBe(first.operationId);
    expect(second.attempt).toBe(first.attempt + 1);
    expect(await releaseVoiceOperation(first.operationId, first.attempt, 'late')).toBe(false);
    expect(await commitVoiceOperation(second.operationId, second.attempt, 'ok')).toBe(true);
    expect(await remainingSeconds()).toBe(138);
  });

  it('replaying a committed key returns its transcript without charging again', async () => {
    const r = await reserved('key-replay', sec(20));
    await commitVoiceOperation(r.operationId, r.attempt, 'cached text');
    const again = await reserveVoiceDuration(USER, 'key-replay', sec(20), T0);
    expect(again).toMatchObject({ kind: 'cached', transcript: 'cached text' });
    expect(voiceQuotaResponseFields(again.quota).voiceRemainingSeconds).toBe(130);
    expect(db.ops).toHaveLength(1);
  });

  it('a key that is still in flight is reported, not reserved twice', async () => {
    await reserved('key-inflight', sec(10));
    const again = await reserveVoiceDuration(USER, 'key-inflight', sec(10), T0);
    expect(again.kind).toBe('in_progress');
    expect(db.ops).toHaveLength(1);
    expect(await remainingSeconds()).toBe(140);
  });

  it('a clip longer than the time left is refused, not partly charged', async () => {
    for (let i = 0; i < 4; i += 1) await charge(`fill-${i}`, sec(30));
    expect(await remainingSeconds()).toBe(30);
    await charge('fill-last', sec(20));
    const tooLong = await reserveVoiceDuration(USER, 'key-over', sec(25), T0);
    expect(tooLong.kind).toBe('insufficient');
    expect(voiceQuotaResponseFields(tooLong.quota).voiceRemainingSeconds).toBe(10);
    expect(db.ops.filter((o) => o.idempotencyKey === 'key-over')).toHaveLength(0);
  });

  it('a clip a few frames over the time left is charged only what is left', async () => {
    for (let i = 0; i < 4; i += 1) await charge(`fill-${i}`, sec(30));
    const r = await reserved('key-edge', 30_400);
    expect(r.chargedMs).toBe(30_000);
    await commitVoiceOperation(r.operationId, r.attempt, 'x');
    expect((await getVoiceQuota(USER, T0)).usedMs).toBe(150_000);
  });

  it('refuses once the allowance is used up and reports zero remaining', async () => {
    for (let i = 0; i < 5; i += 1) await charge(`full-${i}`, sec(30));
    const next = await reserveVoiceDuration(USER, 'key-next', sec(2), T0);
    expect(next.kind).toBe('exhausted');
    expect(voiceQuotaResponseFields(next.quota)).toMatchObject({ voiceRemainingSeconds: 0, voiceLimitSeconds: 150 });
  });

  it('less than one minimum recording left counts as used up', async () => {
    await charge('almost', 149_400);
    const quota = await getVoiceQuota(USER, T0);
    expect(quota.exhausted).toBe(true);
    expect(voiceQuotaResponseFields(quota).voiceRemainingSeconds).toBe(0);
    expect((await reserveVoiceDuration(USER, 'tiny', 900, T0)).kind).toBe('exhausted');
  });

  it('parallel reservations never exceed the available seconds', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserveVoiceDuration(USER, `parallel-${i}`, sec(30), T0)),
    );
    expect(results.filter((r) => r.kind === 'reserved')).toHaveLength(5);
    expect((await getVoiceQuota(USER, T0)).usedMs).toBe(150_000);
  });

  it('an abandoned reservation stops counting after its TTL', async () => {
    process.env.VOICE_DAILY_SECONDS = '30';
    await reserved('key-abandoned', sec(30), T0);
    expect((await reserveVoiceDuration(USER, 'key-next', sec(5), minutes(1))).kind).toBe('exhausted');
    expect((await reserveVoiceDuration(USER, 'key-next', sec(5), minutes(3))).kind).toBe('reserved');
  });

  it('the window resets 24h after it opened, and resetAt says so', async () => {
    await charge('key-day1', sec(150), T0);
    const before = await getVoiceQuota(USER, minutes(60));
    expect(voiceQuotaResponseFields(before)).toEqual({
      voiceRemainingSeconds: 0,
      voiceLimitSeconds: 150,
      voiceResetAt: '2026-10-14T10:00:00.000Z',
    });

    const nextDay = minutes(24 * 60);
    expect(await remainingSeconds(nextDay)).toBe(150);
    const day2 = await reserved('key-day2', sec(10), nextDay);
    expect(day2.quota.resetAt?.toISOString()).toBe('2026-10-15T10:00:00.000Z');
  });

  it('operations from before duration billing (0 ms) do not use up the new allowance', async () => {
    const legacy = await charge('legacy', 0);
    expect(legacy.chargedMs).toBe(0);
    expect(await remainingSeconds()).toBe(150);
  });

  it('VOICE_DAILY_SECONDS configures the allowance', async () => {
    process.env.VOICE_DAILY_SECONDS = '60';
    expect(voiceQuotaResponseFields(await getVoiceQuota(USER, T0)).voiceLimitSeconds).toBe(60);
  });

  it('unlimited chat users are unlimited for voice too', async () => {
    (isChatUnlimitedUser as jest.Mock).mockReturnValue(true);
    for (let i = 0; i < 8; i += 1) await charge(`unlimited-${i}`, sec(30));
    const quota = await getVoiceQuota(USER, T0);
    expect(quota).toMatchObject({ unlimited: true, exhausted: false });
  });
});
