import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { DIAG_LIMITS } from './diagnostics.config';
import { DIAG_KEYS, diagRedis } from './diagnostics-redis';
import { sessionConfigSchema } from './diagnostics-session.service';
import {
    validateClientEvent,
    PRIORITIES,
    type BatchEnvelope,
    type EventRejectReason,
    type NormalizedClientEvent,
} from './diagnostics.schema';

export type IngestRejectReason = EventRejectReason | 'recorded_after_close' | 'max_events' | 'duplicate_in_batch';

export type IngestSessionState = 'pending' | 'active' | 'stopped' | 'expired' | 'revoked' | 'capped' | 'closed';

export type IngestResult =
    | { kind: 'gone'; sessionState: 'missing' | IngestSessionState }
    | { kind: 'forbidden'; reason: 'environment_mismatch' | 'device_unauthorized' }
    | {
          kind: 'ok';
          accepted: number;
          duplicates: number;
          rejected: Array<{ eventId: string | null; reason: IngestRejectReason }>;
          sessionState: 'active' | 'capped';
          maxEventsRemaining: number;
      };

const PRIORITY_RANK = new Map<string, number>(PRIORITIES.map((priority, index) => [priority, index]));

interface LockedSession {
    id: string;
    status: string;
    environment: string;
    config: unknown;
    expiresAt: Date;
}

function acceptanceState(status: string, expiresAt: Date, nowMs: number): IngestSessionState {
    if (status === 'revoked') return 'revoked';
    if (status === 'stopped') return 'stopped';
    if (status === 'expired' || expiresAt.getTime() <= nowMs) return 'expired';
    if (status === 'pending') return 'pending';
    if (status === 'active') return 'active';
    return 'closed';
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

async function mirrorRedis(sessionId: string, total: number, batchId: string, expiresAt: Date, nowMs: number): Promise<void> {
    const redis = diagRedis();
    if (!redis) return;
    const ttlSec = Math.max(60, Math.ceil((expiresAt.getTime() - nowMs) / 1000) + 3600);
    try {
        await redis.set(DIAG_KEYS.eventCount(sessionId), String(total), 'EX', ttlSec);
        await redis.set(DIAG_KEYS.batch(sessionId, batchId), '1', 'EX', DIAG_LIMITS.batchDedupTtlSec);
    } catch (err) {
        logger.warn('[DIAG] redis mirror failed', (err as Error)?.message);
    }
}

/**
 * Stores one batch only while the locked session row is active and the device
 * is enrolled. Stop, expiry, revocation, and the event cap are decided inside
 * the same transaction as the insert, so a concurrent stop cannot land after
 * the check and before the write.
 */
export async function ingestBatch(input: {
    envelope: BatchEnvelope;
    deviceRef: string;
    nowMs: number;
}): Promise<IngestResult> {
    const { envelope, deviceRef, nowMs } = input;
    const startedAt = Date.now();
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
        valid.push(result.event);
    }

    const outcome = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<LockedSession[]>`
            SELECT "id", "status", "environment", "config", "expiresAt"
            FROM "diagnostic_sessions"
            WHERE "id" = ${envelope.sessionId}
            FOR UPDATE
        `;
        const session = locked[0];
        if (!session) return { kind: 'gone' as const, sessionState: 'missing' as const };
        if (session.environment !== envelope.app.environment) {
            return { kind: 'forbidden' as const, reason: 'environment_mismatch' as const };
        }
        const state = acceptanceState(session.status, new Date(session.expiresAt), nowMs);
        if (state !== 'active') return { kind: 'gone' as const, sessionState: state };

        const device = await tx.diagnosticSessionDevice.findUnique({
            where: { sessionId_deviceRef: { sessionId: session.id, deviceRef } },
            select: { id: true },
        });
        if (!device) return { kind: 'forbidden' as const, reason: 'device_unauthorized' as const };

        const parsedConfig = sessionConfigSchema.safeParse(session.config ?? {});
        const maxEvents = parsedConfig.success ? parsedConfig.data.maxEvents : 0;
        const closeAt = new Date(session.expiresAt).getTime();
        const deferred: Array<{ eventId: string; reason: IngestRejectReason }> = [];
        const fresh: NormalizedClientEvent[] = [];
        for (const event of valid) {
            if (event.wall > closeAt + DIAG_LIMITS.closeSkewAllowanceMs) {
                deferred.push({ eventId: event.eventId, reason: 'recorded_after_close' });
                continue;
            }
            fresh.push(event);
        }

        const storedBefore = await tx.diagnosticEvent.count({ where: { sessionId: session.id } });
        if (storedBefore >= maxEvents) {
            await tx.diagnosticSession.update({ where: { id: session.id }, data: { eventCount: storedBefore } });
            return {
                kind: 'ok' as const,
                accepted: 0,
                duplicates: 0,
                deferred: [...deferred, ...fresh.map((event) => ({ eventId: event.eventId, reason: 'max_events' as const }))],
                sessionState: 'capped' as const,
                maxEventsRemaining: 0,
                total: storedBefore,
                expiresAt: new Date(session.expiresAt),
            };
        }

        const room = Math.max(0, maxEvents - storedBefore);
        const ranked = [...fresh].sort(
            (a, b) => (PRIORITY_RANK.get(a.priority) ?? 9) - (PRIORITY_RANK.get(b.priority) ?? 9) || a.seq - b.seq,
        );
        const toInsert = ranked.slice(0, room);
        deferred.push(...ranked.slice(room).map((event) => ({ eventId: event.eventId, reason: 'max_events' as const })));

        let inserted = 0;
        if (toInsert.length > 0) {
            const result = await tx.diagnosticEvent.createMany({
                data: toInsert.map((event) => toRow(session.id, deviceRef, event)),
                skipDuplicates: true,
            });
            inserted = result.count;
        }
        const total = await tx.diagnosticEvent.count({ where: { sessionId: session.id } });
        const deviceTotal = await tx.diagnosticEvent.count({ where: { sessionId: session.id, deviceRef } });
        await tx.diagnosticSession.update({ where: { id: session.id }, data: { eventCount: total } });
        await tx.diagnosticSessionDevice.update({
            where: { id: device.id },
            data: { eventCount: deviceTotal, lastSeenAt: new Date(nowMs) },
        });
        return {
            kind: 'ok' as const,
            accepted: inserted,
            duplicates: toInsert.length - inserted,
            deferred,
            sessionState: total >= maxEvents ? ('capped' as const) : ('active' as const),
            maxEventsRemaining: Math.max(0, maxEvents - total),
            total,
            expiresAt: new Date(session.expiresAt),
        };
    });

    if (outcome.kind !== 'ok') return outcome;
    rejected.push(...outcome.deferred);
    await mirrorRedis(envelope.sessionId, outcome.total, envelope.batchId, outcome.expiresAt, nowMs);
    logger.info(
        `[DIAG] ${JSON.stringify({
            evt: 'ingest',
            session: envelope.sessionId.slice(0, 8),
            batch: envelope.batchId,
            events: envelope.events.length,
            accepted: outcome.accepted,
            duplicates: outcome.duplicates,
            rejected: rejected.length,
            state: outcome.sessionState,
            ms: Date.now() - startedAt,
        })}`,
    );
    return {
        kind: 'ok',
        accepted: outcome.accepted,
        duplicates: outcome.duplicates,
        rejected,
        sessionState: outcome.sessionState,
        maxEventsRemaining: outcome.maxEventsRemaining,
    };
}
