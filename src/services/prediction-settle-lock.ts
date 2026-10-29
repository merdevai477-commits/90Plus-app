/**
 * Per-match settlement lock: Redis SET NX PX first, Postgres advisory lock
 * fallback when Redis is unavailable. Fail-closed — no settle without a lock.
 */

import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';

const LOCK_TTL_MS = 60_000;
const LOCK_TTL_SEC = 60;
/** Stable int4 class id for pg_try_advisory_lock(classId, apiMatchId). */
export const SETTLE_ADVISORY_CLASS = 872_014;
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export type SettleLockKind = 'redis' | 'postgres';

export type SettleLockHandle = {
  kind: SettleLockKind;
  release: () => Promise<void>;
};

export type SettleLockAcquireResult =
  | { ok: true; handle: SettleLockHandle; waitMs: number }
  | { ok: false; reason: 'SETTLE_SKIPPED_LOCKED' | 'SETTLE_SKIPPED_NO_LOCK'; waitMs: number };

function redisKey(apiMatchId: number): string {
  return `settle:${apiMatchId}`;
}

async function tryRedisLock(apiMatchId: number): Promise<SettleLockHandle | null | 'unavailable'> {
  if (!isRedisConnected()) return 'unavailable';
  const redis = getRedisClient();
  if (!redis) return 'unavailable';

  const token = randomUUID();
  try {
    const result = await redis.set(redisKey(apiMatchId), token, 'PX', LOCK_TTL_MS, 'NX');
    if (result !== 'OK') return null;
    return {
      kind: 'redis',
      release: async () => {
        try {
          await redis.eval(RELEASE_SCRIPT, 1, redisKey(apiMatchId), token);
        } catch (err: any) {
          logger.debug(`[SettleLock] redis release failed for ${apiMatchId}:`, err?.message);
        }
      },
    };
  } catch (err: any) {
    logger.warn(`[SettleLock] redis acquire error for ${apiMatchId}:`, err?.message);
    return 'unavailable';
  }
}

async function tryPostgresAdvisoryLock(apiMatchId: number): Promise<SettleLockHandle | null | 'unavailable'> {
  try {
    const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${SETTLE_ADVISORY_CLASS}, ${apiMatchId}) AS locked
    `;
    const locked = rows?.[0]?.locked === true;
    if (!locked) return null;
    return {
      kind: 'postgres',
      release: async () => {
        try {
          await prisma.$queryRaw`
            SELECT pg_advisory_unlock(${SETTLE_ADVISORY_CLASS}, ${apiMatchId})
          `;
        } catch (err: any) {
          logger.debug(`[SettleLock] pg unlock failed for ${apiMatchId}:`, err?.message);
        }
      },
    };
  } catch (err: any) {
    logger.warn(`[SettleLock] pg advisory acquire error for ${apiMatchId}:`, err?.message);
    return 'unavailable';
  }
}

/**
 * Acquire settle:{apiMatchId}. Prefer Redis; fall back to Postgres advisory
 * only when Redis is down. Fail-closed if neither path can grant a lock.
 */
export async function acquireSettleLock(apiMatchId: number): Promise<SettleLockAcquireResult> {
  const started = Date.now();
  const redisResult = await tryRedisLock(apiMatchId);
  if (redisResult && redisResult !== 'unavailable') {
    return { ok: true, handle: redisResult, waitMs: Date.now() - started };
  }
  if (redisResult === null) {
    return { ok: false, reason: 'SETTLE_SKIPPED_LOCKED', waitMs: Date.now() - started };
  }

  const pgResult = await tryPostgresAdvisoryLock(apiMatchId);
  if (pgResult && pgResult !== 'unavailable') {
    return { ok: true, handle: pgResult, waitMs: Date.now() - started };
  }
  if (pgResult === null) {
    return { ok: false, reason: 'SETTLE_SKIPPED_LOCKED', waitMs: Date.now() - started };
  }

  return { ok: false, reason: 'SETTLE_SKIPPED_NO_LOCK', waitMs: Date.now() - started };
}

export const SETTLE_LOCK_TTL_SEC = LOCK_TTL_SEC;
