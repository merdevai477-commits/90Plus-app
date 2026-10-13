/**
 * Real-Postgres check of the voice reservation lock. Skipped unless
 * VOICE_QUOTA_TEST_DATABASE_URL points at a disposable database (never prod)
 * whose schema already has chat_voice_usage / chat_voice_operations.
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
  commitVoiceUnit,
  getVoiceQuota,
  releaseVoiceUnit,
  reserveVoiceUnit,
} from '../chat-voice-quota.service';

jest.setTimeout(60_000);

describeDb('chat voice quota on Postgres', () => {
  const user = `itest_${Date.now()}`;

  beforeAll(() => {
    process.env.VOICE_DAILY_LIMIT = '5';
  });

  afterAll(async () => {
    await prisma.chatVoiceOperation.deleteMany({ where: { userId: { startsWith: 'itest_' } } });
    await prisma.chatVoiceUsage.deleteMany({ where: { userId: { startsWith: 'itest_' } } });
    await prisma.$disconnect();
  });

  it('12 parallel reservations against a limit of 5 reserve exactly 5', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserveVoiceUnit(user, `par-${i}`)),
    );
    expect(results.filter((r) => r.kind === 'reserved')).toHaveLength(5);
    expect(results.filter((r) => r.kind === 'exhausted')).toHaveLength(7);
    expect(await prisma.chatVoiceOperation.count({ where: { userId: user, status: 'RESERVED' } })).toBe(5);
  });

  it('a flood that overruns the lock wait budget fails closed, never over the limit', async () => {
    const floodUser = `${user}_flood`;
    const settled = await Promise.allSettled(
      Array.from({ length: 40 }, (_, i) => reserveVoiceUnit(floodUser, `flood-${i}`)),
    );
    const reserved = settled.filter((s) => s.status === 'fulfilled' && s.value.kind === 'reserved');
    expect(reserved.length).toBeLessThanOrEqual(5);
    expect(await prisma.chatVoiceOperation.count({ where: { userId: floodUser } })).toBe(reserved.length);
  });

  it('parallel requests with one key create one logical operation', async () => {
    const sameKeyUser = `${user}_key`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveVoiceUnit(sameKeyUser, 'same-key')),
    );
    expect(results.filter((r) => r.kind === 'reserved')).toHaveLength(1);
    expect(results.filter((r) => r.kind === 'in_progress')).toHaveLength(7);
    expect(await prisma.chatVoiceOperation.count({ where: { userId: sameKeyUser } })).toBe(1);
  });

  it('commit and release race on one reservation: exactly one wins', async () => {
    const raceUser = `${user}_race`;
    const r = await reserveVoiceUnit(raceUser, 'race-key');
    if (r.kind !== 'reserved') throw new Error('expected a reservation');
    const [committed, released] = await Promise.all([
      commitVoiceUnit(r.operationId, r.attempt, 'text'),
      releaseVoiceUnit(r.operationId, r.attempt, 'provider_failed'),
    ]);
    expect(Number(committed) + Number(released)).toBe(1);
    const quota = await getVoiceQuota(raceUser);
    expect(quota.remaining).toBe(committed ? 4 : 5);
  });
});
