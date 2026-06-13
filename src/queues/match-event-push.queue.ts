import Bull, { Queue } from 'bull';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import type { NormalizedMatchEvent } from '../services/match-events/match-event.types';
import { processMatchEventPushJob } from '../services/match-events/match-event-push.processor';

export interface MatchEventPushJob {
    subscriptionId: string;
    userId: string;
    event: NormalizedMatchEvent;
    fixtureId: number;
    notificationType: string;
    titleKey?: string;
    bodyKey?: string;
    message?: string;
    vars?: Record<string, string | number>;
    prefKey: string | null;
    data: Record<string, unknown>;
    idempotencyKey: string;
}

let queue: Queue<MatchEventPushJob> | null = null;

export function getMatchEventPushQueue(): Queue<MatchEventPushJob> | null {
    if (queue) return queue;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('⚠️ REDIS_URL not set - match-event-push queue disabled (in-process fallback)');
        return null;
    }

    queue = new Bull<MatchEventPushJob>('match-event-push', {
        createClient: bullCreateClient(redisUrl),
    });

    const concurrency = Math.max(
        1,
        Math.min(100, parseInt(process.env.MATCH_EVENT_PUSH_CONCURRENCY || '50', 10) || 50),
    );

    queue.process(concurrency, async (job) => {
        await processMatchEventPushJob(job.data);
    });

    queue.on('failed', (job, err) => {
        logger.warn('[MatchEventPush] job failed:', job?.id, err?.message);
    });

    logger.info(`✅ match-event-push queue ready (concurrency=${concurrency})`);
    return queue;
}

export async function enqueueMatchEventPush(payload: MatchEventPushJob): Promise<void> {
    const q = getMatchEventPushQueue();

    if (!q) {
        setImmediate(async () => {
            try {
                await processMatchEventPushJob(payload);
            } catch (err: any) {
                logger.warn('[MatchEventPush] in-process fallback failed:', err?.message);
            }
        });
        return;
    }

    await q.add(payload, {
        jobId: payload.idempotencyKey,
        attempts: 3,
        backoff: 2000,
        removeOnComplete: true,
        removeOnFail: 500,
    });
}

export async function closeMatchEventPushQueue(): Promise<void> {
    if (queue) {
        await queue.close();
        queue = null;
    }
}
