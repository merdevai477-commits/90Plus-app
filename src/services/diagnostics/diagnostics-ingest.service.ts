import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { DIAG_LIMITS } from './diagnostics.config';
import { DIAG_KEYS, diagRedis } from './diagnostics-redis';
import {
    validateClientEvent,
    PRIORITIES,
    type BatchEnvelope,
    type EventRejectReason,
    type NormalizedClientEvent,
} from './diagnostics.schema';
import {
    effectiveSessionState,
    getSessionSnapshot,
    sessionCloseAt,
    type SessionSnapshot,
} from './diagnostics-session.service';

export type IngestRejectReason = EventRejectReason | 'recorded_after_close' | 'max_events' | 'duplicate_in_batch';

export type IngestSessionState = 'active' | 'stopped' | 'expired' | 'capped';

export type IngestResult =
    | { kind: 'gone'; sessionState: 'missing' | 'closed' }
    | { kind: 'forbidden'; reason: 'environment_mismatch' }
    | {
          kind: 'ok';
          accepted: number;
          duplicates: number;
          rejected: Array<{ eventId: string | null; reason: IngestRejectReason }>;
          sessionState: IngestSessionState;
          maxEventsRemaining: number;
      };

const PRIORITY_RANK = new Map<string, number>(PRIORITIES.map((p, i) => [p, i]));

function counterTtlSec(session: SessionSnapshot, nowMs: number): number {
    return Math.max(60, Math.ceil((sessionCloseAt(session) + DIAG_LIMITS.uploadGraceMs - nowMs) / 1000));
}

async function readEventCount(session: SessionSnapshot, nowMs: number): Promise<number> {
    const redis = diagRedis();
    if (redis) {
        try {
            const raw = await redis.get(DIAG_KEYS.eventCount(session.id));
            if (raw !== null) return Number(raw) || 0;
        } catch {
            /* fall through to the database count */
        }
    }
    const row = await prisma.diagnosticSession.findUnique({
        where: { id: session.id },
        select: { eventCount: true },
    });
    const count = row?.eventCount ?? session.eventCount;
    if (redis) {
        // Seed from Postgres so a Redis restart cannot reset the session cap to zero.
        try {
            await redis.set(DIAG_KEYS.eventCount(session.id), String(count), 'EX', counterTtlSec(session, nowMs), 'NX');
        } catch {
            /* the cap check falls back to Postgres next time */
        }
    }
    return count;
}

async function isDuplicateBatch(sessionId: string, batchId: string): Promise<boolean> {
    const redis = diagRedis();
    if (!redis) return false;
    try {
        return (await redis.exists(DIAG_KEYS.batch(sessionId, batchId))) === 1;
    } catch {
        return false;
    }
}

async function recordBatchAccepted(
    session: SessionSnapshot,
    batchId: string,
    deviceRef: string,
    inserted: number,
    nowMs: number,
): Promise<void> {
    const redis = diagRedis();
    const tasks: Array<Promise<unknown>> = [
        prisma.diagnosticSessionDevice.updateMany({
            where: { sessionId: session.id, deviceRef },
            data: { lastSeenAt: new Date(nowMs), eventCount: { increment: inserted } },
        }),
    ];
    if (inserted > 0) {
        tasks.push(
            prisma.diagnosticSession.update({
                where: { id: session.id },
                data: { eventCount: { increment: inserted } },
            }),
        );
    }
    if (redis) {
        tasks.push(redis.set(DIAG_KEYS.batch(session.id, batchId), '1', 'EX', DIAG_LIMITS.batchDedupTtlSec));
        if (inserted > 0) {
            tasks.push(
                redis
                    .multi()
                    .incrby(DIAG_KEYS.eventCount(session.id), inserted)
                    .expire(DIAG_KEYS.eventCount(session.id), counterTtlSec(session, nowMs))
                    .exec(),
            );
        }
    }
    const results = await Promise.allSettled(tasks);
    for (const result of results) {
        if (result.status === 'rejected') {
            logger.warn('[DIAG] post-ingest bookkeeping failed', (result.reason as Error)?.message);
        }
    }
}

function toRow(
    sessionId: string,
    deviceRef: string,
    event: NormalizedClientEvent,
): Prisma.DiagnosticEventCreateManyInput {
    return {
        sessionId,
        eventId: event.eventId,
        source: 'client',
        type: event.type,
        severity: event.severity,
        traceId: event.traceId ?? null,
        fixtureId: event.fixtureId ?? null,
        deviceRef,
        screen: event.screen ?? null,
        component: event.component ?? null,
        recordedAt: new Date(event.wall),
        monoMs: event.mono ?? null,
        payload: { seq: event.seq, priority: event.priority, data: event.data } as Prisma.InputJsonValue,
    };
}

/**
 * Validates and durably stores one client batch. The returned acknowledgement
 * is only produced after the insert commits, so a client that deletes events
 * on ack can never lose them. Re-sent events are absorbed by the unique
 * (sessionId, eventId) index.
 */
export async function ingestBatch(input: {
    envelope: BatchEnvelope;
    deviceRef: string;
    nowMs: number;
}): Promise<IngestResult> {
    const { envelope, deviceRef, nowMs } = input;
    const startedAt = Date.now();

    const session = await getSessionSnapshot(envelope.sessionId);
    if (!session) return { kind: 'gone', sessionState: 'missing' };

    const closeAt = sessionCloseAt(session);
    if (nowMs > closeAt + DIAG_LIMITS.uploadGraceMs) return { kind: 'gone', sessionState: 'closed' };
    if (envelope.app.environment !== session.environment) return { kind: 'forbidden', reason: 'environment_mismatch' };

    const rejected: Array<{ eventId: string | null; reason: IngestRejectReason }> = [];
    const valid: NormalizedClientEvent[] = [];
    const seen = new Set<string>();
    for (const raw of envelope.events) {
        const result = validateClientEvent(raw);
        if (!result.ok) {
            rejected.push({ eventId: result.eventId, reason: result.reason });
            continue;
        }
        if (seen.has(result.event.eventId)) {
            rejected.push({ eventId: result.event.eventId, reason: 'duplicate_in_batch' });
            continue;
        }
        seen.add(result.event.eventId);
        if (result.event.wall > closeAt + DIAG_LIMITS.closeSkewAllowanceMs) {
            rejected.push({ eventId: result.event.eventId, reason: 'recorded_after_close' });
            continue;
        }
        valid.push(result.event);
    }

    const state = effectiveSessionState(session, nowMs);
    const maxEvents = session.config.maxEvents;

    if (await isDuplicateBatch(session.id, envelope.batchId)) {
        const current = await readEventCount(session, nowMs);
        return {
            kind: 'ok',
            accepted: 0,
            duplicates: valid.length,
            rejected,
            sessionState: current >= maxEvents ? 'capped' : state,
            maxEventsRemaining: Math.max(0, maxEvents - current),
        };
    }

    const current = await readEventCount(session, nowMs);
    const remaining = Math.max(0, maxEvents - current);
    let toInsert = valid;
    if (valid.length > remaining) {
        const ranked = [...valid].sort(
            (a, b) => (PRIORITY_RANK.get(a.priority) ?? 9) - (PRIORITY_RANK.get(b.priority) ?? 9) || a.seq - b.seq,
        );
        toInsert = ranked.slice(0, remaining);
        for (const dropped of ranked.slice(remaining)) {
            rejected.push({ eventId: dropped.eventId, reason: 'max_events' });
        }
    }

    let inserted = 0;
    if (toInsert.length > 0) {
        const result = await prisma.diagnosticEvent.createMany({
            data: toInsert.map((event) => toRow(session.id, deviceRef, event)),
            skipDuplicates: true,
        });
        inserted = result.count;
    }
    await recordBatchAccepted(session, envelope.batchId, deviceRef, inserted, nowMs);

    const remainingAfter = Math.max(0, remaining - inserted);
    logger.info(
        `[DIAG] ${JSON.stringify({
            evt: 'ingest',
            session: session.id.slice(0, 8),
            batch: envelope.batchId,
            events: envelope.events.length,
            accepted: inserted,
            duplicates: toInsert.length - inserted,
            rejected: rejected.length,
            state,
            ms: Date.now() - startedAt,
        })}`,
    );

    return {
        kind: 'ok',
        accepted: inserted,
        duplicates: toInsert.length - inserted,
        rejected,
        sessionState: remainingAfter <= 0 ? 'capped' : state,
        maxEventsRemaining: remainingAfter,
    };
}
