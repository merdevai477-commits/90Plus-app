/**
 * Optional per-fixture leader lock for multi-instance ingestors.
 * Disabled by default (MATCH_EVENT_USE_LEADER_LOCK=false).
 * When disabled, every instance may ingest — idempotent DB upserts prevent duplicate events.
 */

import { getRedisClient } from '../../lib/redis';
import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

const LOCK_PREFIX = 'lock:match-ingestor';
const DEFAULT_TTL_SEC = 15;

function lockKey(fixtureId: number): string {
    return `${LOCK_PREFIX}:${fixtureId}`;
}

export function isMatchIngestorLockEnabled(): boolean {
    return process.env.MATCH_EVENT_USE_LEADER_LOCK === 'true';
}

const INSTANCE_ID = process.env.INSTANCE_ID ?? randomUUID();

export interface IngestorLockHandle {
    release: () => Promise<void>;
}

/**
 * Try to acquire the ingest lock for a fixture.
 * Returns null when lock is held by another instance (leader mode only).
 * Returns a no-op handle when leader lock is disabled.
 */
export async function acquireIngestorLock(
    fixtureId: number,
    ttlSec = DEFAULT_TTL_SEC,
): Promise<IngestorLockHandle | null> {
    if (!isMatchIngestorLockEnabled()) {
        return { release: async () => {} };
    }

    const redis = getRedisClient();
    if (!redis) {
        return { release: async () => {} };
    }

    const key = lockKey(fixtureId);
    try {
        const result = await redis.set(key, INSTANCE_ID, 'EX', ttlSec, 'NX');
        if (result !== 'OK') return null;

        return {
            release: async () => {
                try {
                    const current = await redis.get(key);
                    if (current === INSTANCE_ID) await redis.del(key);
                } catch (err: any) {
                    logger.debug('[MatchIngestorLock] release failed:', err?.message);
                }
            },
        };
    } catch (err: any) {
        logger.warn('[MatchIngestorLock] acquire failed (fail open):', err?.message);
        return { release: async () => {} };
    }
}
