/**
 * Optional Redis Stream adapter for match events.
 * Disabled by default (MATCH_EVENT_USE_REDIS_STREAM=false).
 * When disabled, append/publish are no-ops — DB + fan-out remain the source of truth.
 */

import { getRedisClient } from '../../lib/redis';
import { logger } from '../../utils/logger';

const STREAM_PREFIX = 'match';

function streamKey(fixtureId: number): string {
    return `${STREAM_PREFIX}:${fixtureId}:events`;
}

export function isMatchEventStreamEnabled(): boolean {
    return process.env.MATCH_EVENT_USE_REDIS_STREAM === 'true';
}

export async function appendMatchEventsToStream(
    fixtureId: number,
    eventKeys: string[],
): Promise<void> {
    if (!isMatchEventStreamEnabled() || eventKeys.length === 0) return;

    const redis = getRedisClient();
    if (!redis) return;

    try {
        const pipeline = redis.pipeline();
        for (const eventKey of eventKeys) {
            pipeline.xadd(streamKey(fixtureId), '*', 'eventKey', eventKey);
        }
        await pipeline.exec();
    } catch (err: any) {
        logger.warn('[MatchEventStream] append failed (non-fatal):', err?.message);
    }
}
