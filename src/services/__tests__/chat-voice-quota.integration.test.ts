/**
 * Real-Postgres check of the voice reservation lock. Skipped unless
 * VOICE_QUOTA_TEST_DATABASE_URL points at a disposable database (never prod)
 * whose schema already has chat_voice_usage / chat_voice_operations (with durationMs).
 */

const TEST_DB = process.env.VOICE_QUOTA_TEST_DATABASE_URL;
const describeDb = TEST_DB ? describe : describe.skip;

jest.mock('../../lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  const client = new PrismaClient({
    datasources: { db: { url: process.env.VOICE_QUOTA_TEST_DATABASE_URL ?? 'postgresql://unused' } },
  });
  return { __esModule: true, prisma: client, default: client };
});
jest.mock('../chat.service', () => ({ isChatUnlimitedUser: () => false }));

import { prisma } from '../../lib/prisma';
import {
  commitVoiceOperation,
  getVoiceQuota,
  releaseVoiceOperation,
  reserveVoiceDuration,
} from '../chat-voice-quota.service';

jest.setTimeout(60_000);

async function reservedMs(userId: string): Promise<number> {
  const agg = await prisma.chatVoiceOperation.aggregate({
    where: { userId, status: { in: ['RESERVED', 'COMMITTED'] } },
    _sum: { durationMs: true },
  });
  return agg._sum.durationMs ?? 0;
}

describeDb('chat voice-time allowance on Postgres', () => {
  const user = `itest_${Date.now()}`;

  beforeAll(() => {
    process.env.VOICE_DAILY_SECONDS = '150';
  });

  afterAll(async () => {
    await prisma.chatVoiceOperation.deleteMany({ where: { userId: { startsWith: 'itest_' } } });
    await prisma.chatVoiceUsage.deleteMany({ where: { userId: { startsWith: 'itest_' } } });
    await prisma.$disconnect();
  });

  it('12 parallel 30s clips against 150s reserve exactly 5 (150s)', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserveVoiceDuration(user, `par-${i}`, 30_000)),
    );
    expect(results.filter((r) => r.kind === 'reserved')).toHaveLength(5);
    expect(results.filter((r) => r.kind === 'exhausted')).toHaveLength(7);
    expect(await reservedMs(user)).toBe(150_000);
  });

  it('parallel clips of uneven length never reserve more than the allowance', async () => {
    const mixedUser = `${user}_mixed`;
    const lengths = [25_000, 18_000, 30_000, 12_000, 27_000, 9_000, 30_000, 21_000, 16_000, 30_000];
    const results = await Promise.all(
      lengths.map((ms, i) => reserveVoiceDuration(mixedUser, `mix-${i}`, ms)),
    );
    const total = await reservedMs(mixedUser);
    expect(total).toBeLessThanOrEqual(150_000);
    const charged = results.reduce((s, r) => s + (r.kind === 'reserved' ? r.chargedMs : 0), 0);
    expect(charged).toBe(total);
    expect(results.some((r) => r.kind !== 'reserved')).toBe(true);
  });

  it('a flood that overruns the lock wait budget fails closed, never over the allowance', async () => {
    const floodUser = `${user}_flood`;
    const settled = await Promise.allSettled(
      Array.from({ length: 40 }, (_, i) => reserveVoiceDuration(floodUser, `flood-${i}`, 30_000)),
    );
    const reserved = settled.filter((s) => s.status === 'fulfilled' && s.value.kind === 'reserved');
    expect(reserved.length).toBeLessThanOrEqual(5);
    expect(await reservedMs(floodUser)).toBe(reserved.length * 30_000);
  });

  it('parallel requests with one key create one logical charge', async () => {
    const sameKeyUser = `${user}_key`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveVoiceDuration(sameKeyUser, 'same-key', 20_000)),
    );
    expect(results.filter((r) => r.kind === 'reserved')).toHaveLength(1);
    expect(results.filter((r) => r.kind === 'in_progress')).toHaveLength(7);
    expect(await prisma.chatVoiceOperation.count({ where: { userId: sameKeyUser } })).toBe(1);
    expect(await reservedMs(sameKeyUser)).toBe(20_000);
  });

  it('commit and release race on one reservation: exactly one wins', async () => {
    const raceUser = `${user}_race`;
    const r = await reserveVoiceDuration(raceUser, 'race-key', 10_000);
    if (r.kind !== 'reserved') throw new Error('expected a reservation');
    const [committed, released] = await Promise.all([
      commitVoiceOperation(r.operationId, r.attempt, 'text'),
      releaseVoiceOperation(r.operationId, r.attempt, 'provider_failed'),
    ]);
    expect(Number(committed) + Number(released)).toBe(1);
    const quota = await getVoiceQuota(raceUser);
    expect(quota.remainingMs).toBe(committed ? 140_000 : 150_000);
  });
});
