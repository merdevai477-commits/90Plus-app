/**
 * Distributed leader lock for API-Football background sync jobs.
 * Ensures only one server instance runs live sync / ingestor ticks when Redis is available.
 */

import { randomUUID } from 'crypto';
import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';

const LEADER_PREFIX = 'football:sync:leader';
const DEFAULT_TTL_SEC = 30;

const INSTANCE_ID = process.env.INSTANCE_ID ?? randomUUID();

export function getSyncLeaderInstanceId(): string {
  return INSTANCE_ID;
}

function leaderKey(scope: string): string {
  return `${LEADER_PREFIX}:${scope}`;
}

/**
 * Try to become (or renew) the sync leader for a scoped background job.
 * Returns true when this instance may run the given football sync work.
 */
export async function tryAcquireSyncLeader(
  scope: string,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return true;
  }

  const key = leaderKey(scope);
  const value = INSTANCE_ID;

  try {
    const acquired = await redis.set(key, value, 'EX', ttlSec, 'NX');
    if (acquired === 'OK') {
      return true;
    }

    const current = await redis.get(key);
    if (current === INSTANCE_ID) {
      await redis.set(key, value, 'EX', ttlSec);
      return true;
    }

    logger.debug(`[SyncLeader] Skipping ${scope} — leader is ${current ?? 'unknown'}`);
    return false;
  } catch (err: unknown) {
    logger.warn('[SyncLeader] acquire failed (fail open):', err);
    return true;
  }
}

export async function releaseSyncLeader(scope: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const key = leaderKey(scope);
  try {
    const current = await redis.get(key);
    if (current === INSTANCE_ID) {
      await redis.del(key);
    }
  } catch {
    // non-fatal
  }
}
