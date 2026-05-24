/**
 * Quick connectivity smoke-test for DATABASE_URL + REDIS_URL.
 *
 * Run with: `npm run check:connectivity`
 *
 * Verifies:
 *  - Postgres reachable + the `reels.publishedAt` column exists
 *    (proves the latest migration is applied)
 *  - Postgres `NotificationType` enum contains `VIDEO_PROCESSED`
 *  - Redis reachable + PING + SET/GET roundtrip
 *
 * Exits non-zero on any failure so this can also be wired into CI later.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

function mask(url: string | undefined): string {
  if (!url) return '<not set>';
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
}

async function checkPostgres(): Promise<void> {
  const url = process.env.DATABASE_URL;
  console.log('\n[DB] DATABASE_URL =', mask(url));
  if (!url) throw new Error('DATABASE_URL is not set');

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('[DB] ✅ SELECT 1 succeeded');

    const cols: Array<{ column_name: string }> = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'reels' AND column_name = 'publishedAt'`,
    );
    if (cols.length === 0) {
      throw new Error('reels.publishedAt column missing — migration not applied');
    }
    console.log('[DB] ✅ reels.publishedAt column present');

    const enumValues: Array<{ value: string }> = await prisma.$queryRawUnsafe(
      `SELECT unnest(enum_range(NULL::"NotificationType"))::text AS value`,
    );
    const names = enumValues.map((r) => r.value);
    const expected = [
      'VIDEO_PROCESSED',
      'MATCH_GOAL',
      'FOLLOW_ACTIVITY',
      'LUCKY_WHEEL',
    ];
    const missing = expected.filter((v) => !names.includes(v));
    if (missing.length > 0) {
      throw new Error(`NotificationType missing values: ${missing.join(', ')}`);
    }
    console.log(`[DB] ✅ NotificationType enum has ${names.length} values (incl. VIDEO_PROCESSED)`);

    const reelCount = await prisma.reel.count();
    console.log(`[DB] ✅ prisma.reel.count() = ${reelCount}`);

    const publishedCount = await prisma.reel.count({ where: { publishedAt: { not: null } } });
    console.log(`[DB] ✅ prisma.reel.count(publishedAt != null) = ${publishedCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  console.log('\n[Redis] REDIS_URL =', mask(url));
  if (!url) throw new Error('REDIS_URL is not set');

  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 8000,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    console.log('[Redis] ✅ connect() succeeded');

    const pong = await redis.ping();
    console.log('[Redis] ✅ PING ->', pong);

    const key = `connectivity:check:${Date.now()}`;
    await redis.set(key, 'ok', 'EX', 10);
    const got = await redis.get(key);
    if (got !== 'ok') {
      throw new Error(`SET/GET roundtrip mismatch — got: ${got}`);
    }
    await redis.del(key);
    console.log('[Redis] ✅ SET/GET/DEL roundtrip works');
  } finally {
    redis.disconnect();
  }
}

(async () => {
  let failed = false;
  try {
    await checkPostgres();
  } catch (err: any) {
    failed = true;
    console.error('[DB] ❌', err?.message ?? err);
  }
  try {
    await checkRedis();
  } catch (err: any) {
    failed = true;
    console.error('[Redis] ❌', err?.message ?? err);
  }

  console.log('');
  if (failed) {
    console.error('❌ Connectivity check FAILED');
    process.exit(1);
  } else {
    console.log('✅ All connectivity checks passed');
    process.exit(0);
  }
})();
