import { monitorEventLoopDelay, type IntervalHistogram } from 'perf_hooks';
import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { setTag } from '../../config/sentry.config';
import {
    getServerDiagnosticsEnvironment,
    isBackendTraceConfigured,
} from './diagnostics.config';
import { listActiveSessions } from './diagnostics-session.service';
import type { BackendEventType } from './diagnostics.schema';

/**
 * In-memory backend trace buffer. Recording is off unless DIAGNOSTICS_ENABLED,
 * DIAG_BACKEND_TRACE, and at least one active session for this environment
 * all hold. The live-sync tick already running on the process refreshes that
 * gate and flushes. Nothing here starts its own timer.
 */

const BUFFER_CAP = 5_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DiagTrace {
    id: string;
    detectedAt: number;
    gen: number;
    instanceId: string;
}

interface BufferedEvent {
    type: BackendEventType;
    severity: 'info' | 'warn';
    traceId?: string;
    fixtureId?: number;
    recordedAt: number;
    payload: Record<string, unknown>;
}

const LAG_TYPE: Record<string, BackendEventType> = {
    ws_broadcast_decision: 'be_change',
    ws_emit: 'be_ws_emit',
    redis_write_365_live: 'be_redis_write',
    http_live_list_read: 'be_http_serve',
    http_ptr_calendar: 'be_http_serve',
    http_details: 'be_http_serve',
    details_bundle_serve: 'be_http_serve',
};

const buffer: BufferedEvent[] = [];
let dropped = 0;
let seq = 0;
let activeSessionIds: string[] = [];
let traceWanted = false;
let loopDelay: IntervalHistogram | null = null;
let testSessions: string[] | null = null;

function instanceLabel(): string {
    const raw = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || 'local';
    return raw.replace(/[^\w-]/g, '').slice(0, 24) || 'local';
}

export function isBackendTraceActive(): boolean {
    return traceWanted;
}

export function createDiagTrace(gen: number, detectedAt = Date.now()): DiagTrace | undefined {
    if (!traceWanted) return undefined;
    return {
        id: `b-${randomBytes(8).toString('hex')}`,
        detectedAt,
        gen,
        instanceId: instanceLabel(),
    };
}

/** Same object when tracing is off, so response bodies do not change. */
export function withDiagMeta<T extends object>(meta: T): T {
    if (!traceWanted) return meta;
    return { ...meta, generatedAt: Date.now() };
}

function numberField(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function textField(value: unknown, max = 48): string | undefined {
    if (typeof value !== 'string') return undefined;
    const text = value.replace(/[^\w .:|+\-/()#@,]/g, '').slice(0, max);
    return text || undefined;
}

function signature(fields: Record<string, unknown>): string | undefined {
    const status = textField(fields.status, 8);
    const elapsed = numberField(fields.elapsed ?? fields.minute);
    const extra = fields.extra == null ? undefined : numberField(fields.extra);
    const home = numberField(fields.hg ?? fields.homeScore);
    const away = numberField(fields.ag ?? fields.awayScore);
    if (!status && elapsed == null && home == null && away == null) return undefined;
    const part = (value: number | undefined) => (value == null ? 'null' : String(Math.trunc(value)));
    return `${status ?? 'NA'}|${part(elapsed)}|${part(extra)}|${part(home)}-${part(away)}`;
}

function push(event: BufferedEvent): void {
    if (!traceWanted || activeSessionIds.length === 0) return;
    if (buffer.length >= BUFFER_CAP) {
        buffer.shift();
        dropped += 1;
    }
    buffer.push(event);
}

/** Forwards a lag-audit point. No-op unless a backend trace session is active. */
export function noteLagAudit(event: string, fields: Record<string, unknown> = {}): void {
    if (!traceWanted) return;
    const type = LAG_TYPE[event];
    if (!type) return;
    const fixtureId = numberField(fields.fixtureId ?? fields.matchId);
    const traceId = textField(fields.traceId, 64);
    push({
        type,
        severity: 'info',
        ...(traceId ? { traceId } : {}),
        ...(fixtureId && fixtureId > 0 ? { fixtureId } : {}),
        recordedAt: Date.now(),
        payload: {
            point: event,
            ...(signature(fields) ? { sig: signature(fields) } : {}),
            ...(textField(fields.reason, 32) ? { reason: textField(fields.reason, 32) } : {}),
            ...(textField(fields.source, 32) ? { source: textField(fields.source, 32) } : {}),
            ...(numberField(fields.gen) != null ? { gen: numberField(fields.gen) } : {}),
            ...(numberField(fields.detectedAt) != null ? { detectedAt: numberField(fields.detectedAt) } : {}),
            ...(textField(fields.instanceId, 24) ? { instanceId: textField(fields.instanceId, 24) } : {}),
            ...(numberField(fields.count) != null ? { count: numberField(fields.count) } : {}),
            ...(numberField(fields.incoming) != null ? { incoming: numberField(fields.incoming) } : {}),
            ...(numberField(fields.existing) != null ? { existing: numberField(fields.existing) } : {}),
            ...(numberField(fields.diffCount) != null ? { diffCount: numberField(fields.diffCount) } : {}),
            ...(textField(fields.writeAt, 40) ? { writeAt: textField(fields.writeAt, 40) } : {}),
            ...(typeof fields.pull === 'boolean' ? { pull: fields.pull } : {}),
            ...(typeof fields.cached === 'boolean' ? { cached: fields.cached } : {}),
        },
    });
}

export function recordBackendPoll(input: {
    gen: number;
    fetchStartedAt: number;
    providerMs: number;
    count: number;
    cached: boolean;
}): void {
    if (!traceWanted) return;
    push({
        type: 'be_poll',
        severity: 'info',
        recordedAt: Date.now(),
        payload: {
            gen: input.gen,
            fetchStartedAt: input.fetchStartedAt,
            providerMs: Math.max(0, Math.round(input.providerMs)),
            count: input.count,
            cached: input.cached,
            instanceId: instanceLabel(),
            dropped,
        },
    });
}

function sampleEventLoop(): void {
    if (!traceWanted) {
        if (loopDelay) {
            loopDelay.disable();
            loopDelay = null;
        }
        return;
    }
    if (!loopDelay) {
        loopDelay = monitorEventLoopDelay({ resolution: 20 });
        loopDelay.enable();
        return;
    }
    const ms = (ns: number) => Math.round((ns / 1e6) * 1000) / 1000;
    push({
        type: 'be_event_loop',
        severity: loopDelay.percentile(99) > 100e6 ? 'warn' : 'info',
        recordedAt: Date.now(),
        payload: {
            p50Ms: ms(loopDelay.percentile(50)),
            p99Ms: ms(loopDelay.percentile(99)),
            maxMs: ms(loopDelay.max),
            instanceId: instanceLabel(),
        },
    });
    loopDelay.reset();
}

async function adoptSessions(next: string[]): Promise<void> {
    const changed = next.length !== activeSessionIds.length || next.some((id, index) => id !== activeSessionIds[index]);
    if (changed && buffer.length > 0 && activeSessionIds.length > 0) await flushBackendTrace();
    activeSessionIds = next;
    traceWanted = next.length > 0;
}

export async function refreshBackendTrace(): Promise<void> {
    if (!isBackendTraceConfigured() && testSessions == null) {
        await adoptSessions([]);
        sampleEventLoop();
        return;
    }
    try {
        const next = testSessions
            ? [...testSessions]
            : (await listActiveSessions(getServerDiagnosticsEnvironment(), Date.now()))
                  .filter((session) => session.config.features.backendTrace !== false)
                  .map((session) => session.id);
        await adoptSessions(next);
    } catch {
        await adoptSessions([]);
    }
    sampleEventLoop();
}

export async function flushBackendTrace(): Promise<number> {
    if (buffer.length === 0 || activeSessionIds.length === 0) return 0;
    const batch = buffer.splice(0, buffer.length);
    const sessions = [...activeSessionIds];
    const rows = sessions.flatMap((sessionId) =>
        batch.map((event) => {
            seq += 1;
            return {
                sessionId,
                eventId: `be-${instanceLabel().slice(0, 8)}-${seq}`,
                source: 'backend',
                type: event.type,
                severity: event.severity,
                traceId: event.traceId ?? null,
                fixtureId: event.fixtureId ?? null,
                recordedAt: new Date(event.recordedAt),
                payload: event.payload as Prisma.InputJsonValue,
            };
        }),
    );
    try {
        const result = await prisma.diagnosticEvent.createMany({ data: rows, skipDuplicates: true });
        return result.count;
    } catch {
        const room = BUFFER_CAP - buffer.length;
        if (room > 0) buffer.unshift(...batch.slice(-room));
        dropped += Math.max(0, batch.length - room);
        return 0;
    }
}

/** Tags the request that belongs to a diagnostics session and records when it finishes. */
export function diagnosticsRequestTag(req: Request, res: Response, next: NextFunction): void {
    if (!traceWanted) {
        next();
        return;
    }
    const sessionId = req.get('x-diag-session');
    if (!sessionId || !UUID.test(sessionId) || !activeSessionIds.includes(sessionId)) {
        next();
        return;
    }
    try {
        setTag('diag_session', sessionId);
    } catch {
        /* Sentry is optional */
    }
    const started = Date.now();
    res.on('finish', () => {
        const route = (req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : req.path) || 'unknown';
        push({
            type: 'be_http_serve',
            severity: res.statusCode >= 500 ? 'warn' : 'info',
            recordedAt: Date.now(),
            payload: {
                point: 'request',
                method: textField(req.method, 8),
                route: textField(String(route), 64),
                status: res.statusCode,
                durationMs: Math.max(0, Date.now() - started),
                sessionId,
            },
        });
    });
    next();
}

export function resetBackendTraceForTests(sessions: string[] | null = null): void {
    buffer.splice(0, buffer.length);
    dropped = 0;
    seq = 0;
    testSessions = sessions;
    activeSessionIds = sessions ? [...sessions] : [];
    traceWanted = (sessions?.length ?? 0) > 0;
    if (loopDelay) {
        loopDelay.disable();
        loopDelay = null;
    }
}
