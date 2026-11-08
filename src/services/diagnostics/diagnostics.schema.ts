import { z } from 'zod';
import { DIAG_LIMITS } from './diagnostics.config';

/**
 * Diagnostics telemetry contract, version 1.
 *
 * Every client event type has its own `data` schema. Unknown keys are stripped
 * and string fields only accept identifier-like characters, so free text,
 * match objects and user content cannot be stored even if a client sends them.
 */

export const DIAG_SCHEMA_VERSION = 1;

const SAFE_TEXT = /^[\w .:|+\-/()#@,]*$/;
const SAFE_ID = /^[\w\-:.]+$/;
const SIGNATURE = /^[\w.|+\-:]*$/;

const id = (max: number) => z.string().min(1).max(max).regex(SAFE_ID);
const txt = (max: number) => z.string().max(max).regex(SAFE_TEXT);
const sig = z.string().max(48).regex(SIGNATURE);

const DAY_MS = 24 * 60 * 60 * 1000;
const epochMs = z.number().min(1_500_000_000_000).max(4_000_000_000_000);
const durMs = z.number().min(0).max(7 * DAY_MS);
const signedMs = z.number().min(-7 * DAY_MS).max(7 * DAY_MS);
const monoMs = z.number().min(0).max(1e10);
const count = z.number().int().min(0).max(100_000_000);
const minute = z.number().int().min(0).max(300);

function boundedNumRecord(maxKeys: number) {
    return z
        .record(id(48), z.number().min(-1e12).max(1e12))
        .refine((value) => Object.keys(value).length <= maxKeys, { message: 'too_many_keys' });
}

export const CLIENT_EVENT_TYPES = [
    'session_start',
    'session_end',
    'session_summary',
    'app_state',
    'screen_focus',
    'category_switch',
    'details_open',
    'details_return',
    'foreground_recovery',
    'pull_refresh',
    'pipeline_trace',
    'pipeline_anomaly',
    'room_sub',
    'ws_state',
    'http_fetch',
    'render_window',
    'js_stall',
    'memory_sample',
    'list_load',
    'clock_summary',
    'clock_reanchor',
    'list_minute_mismatch',
    'clock_offset_sample',
    'queue_stats',
    'diag_overhead',
    'sentry_event_ref',
    'observe_entries_summary',
] as const;

export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

/** Written only by the backend trace sink; rejected when a client sends them. */
export const BACKEND_EVENT_TYPES = [
    'be_poll',
    'be_change',
    'be_redis_write',
    'be_ws_emit',
    'be_http_serve',
    'be_http_window',
    'be_event_loop',
] as const;

export type BackendEventType = (typeof BACKEND_EVENT_TYPES)[number];

export const PIPELINE_SOURCES = ['ws', 'http_fast', 'http_full', 'http_events', 'calendar', 'live_feed', 'bootstrap'] as const;
export const ANOMALY_KINDS = [
    'duplicate',
    'out_of_order',
    'stale',
    'overwritten',
    'delayed',
    'missing_stage',
    'regression',
] as const;

const DATA_SCHEMAS: Record<ClientEventType, z.ZodType> = {
    session_start: z.object({
        reason: z.enum(['cold_start', 'foreground', 'restore']),
        features: z.record(id(32), z.boolean()).optional(),
        sampling: z.record(id(32), z.number().min(0).max(1)).optional(),
        restoredEvents: count.optional(),
        expiresInMs: durMs.optional(),
    }),
    session_end: z.object({
        reason: z.enum(['expired', 'stopped', 'max_events', 'disabled', 'token_rejected', 'error']),
        recorded: count,
        dropped: count.optional(),
        durationMs: durMs.optional(),
    }),
    session_summary: z.object({
        counters: boundedNumRecord(64),
        durationMs: durMs.optional(),
    }),
    app_state: z.object({ from: id(16), to: id(16), durationMs: durMs.optional() }),
    screen_focus: z.object({ focused: z.boolean(), durationMs: durMs.optional() }),
    category_switch: z.object({
        from: id(24),
        to: id(24),
        toCommitMs: durMs.optional(),
        groups: count.optional(),
    }),
    details_open: z.object({ source: id(24).optional(), live: z.boolean().optional() }),
    details_return: z.object({ durationMs: durMs.optional(), toListCommitMs: durMs.optional() }),
    foreground_recovery: z.object({
        backgroundMs: durMs,
        toFirstWsMs: durMs.optional(),
        toFirstHttpMs: durMs.optional(),
        toFirstRowUpdateMs: durMs.optional(),
        wsConnectedAtForeground: z.boolean().optional(),
    }),
    pull_refresh: z.object({ tab: id(24).optional(), durationMs: durMs.optional(), ok: z.boolean().optional() }),
    pipeline_trace: z.object({
        source: z.enum(PIPELINE_SOURCES),
        decision: z.enum(['applied', 'skipped', 'partial', 'noop', 'unknown']),
        reason: id(48).optional(),
        sigBefore: sig.optional(),
        sigIn: sig.optional(),
        sigAfter: sig.optional(),
        recvWall: epochMs,
        recvMono: monoMs,
        storeMono: monoMs.optional(),
        overlayMono: monoMs.optional(),
        commitMono: monoMs.optional(),
        serverEmitAt: epochMs.optional(),
        detectedAt: epochMs.optional(),
        generatedAt: epochMs.optional(),
        traceGen: count.optional(),
        instanceId: id(64).optional(),
        offsetMs: signedMs.optional(),
        offsetUncMs: durMs.optional(),
        inRoom: z.boolean().optional(),
        interested: z.boolean().optional(),
        missingStages: z.array(z.enum(['store', 'overlay', 'commit'])).max(3).optional(),
    }),
    pipeline_anomaly: z.object({
        kind: z.enum(ANOMALY_KINDS),
        source: id(16).optional(),
        sigPrev: sig.optional(),
        sigIn: sig.optional(),
        detail: txt(96).optional(),
        count: count.optional(),
        latencyMs: durMs.optional(),
    }),
    room_sub: z.object({ action: z.enum(['sub', 'unsub']), roomCount: count.optional() }),
    ws_state: z.object({
        state: z.enum(['connect', 'disconnect', 'connect_error', 'reconnect_attempt', 'reconnect']),
        reason: txt(64).optional(),
        attempt: count.optional(),
        connectedForMs: durMs.optional(),
    }),
    http_fetch: z.object({
        endpoint: id(64),
        status: z.number().int().min(0).max(999),
        durationMs: durMs,
        ok: z.boolean(),
        bytes: count.optional(),
        xCache: id(16).optional(),
        generatedAt: epochMs.optional(),
        requestId: id(64).optional(),
        count: count.optional(),
    }),
    render_window: z.object({
        windowMs: durMs,
        rowRenders: count,
        redundantRenders: count,
        rowRenderMsSum: durMs.optional(),
        rowRenderMsMax: durMs.optional(),
        rowRenderSamples: count.optional(),
        storeSets: count.optional(),
        selectorRuns: count.optional(),
        selectorMsSampled: durMs.optional(),
        overlayRuns: count.optional(),
        overlayMsSum: durMs.optional(),
        overlayMsMax: durMs.optional(),
        groupMsMax: durMs.optional(),
        listCommits: count.optional(),
        rowCommits: count.optional(),
        scrollSessions: count.optional(),
    }),
    js_stall: z.object({ host: id(24), latenessMs: durMs, expectedMs: durMs }),
    memory_sample: z.object({ source: id(16), jsHeapSize: count.optional(), jsAllocated: count.optional() }),
    list_load: z.object({ list: id(24), elapsedMs: durMs }),
    clock_summary: z.object({
        windowMs: durMs.optional(),
        ticks: count.optional(),
        jitterP50: signedMs.optional(),
        jitterP95: signedMs.optional(),
        jitterMax: signedMs.optional(),
        missedTicks: count.optional(),
        driftMaxSec: z.number().min(-1e6).max(1e6).optional(),
        reanchors: count.optional(),
        listRows: count.optional(),
        listMismatches: count.optional(),
        detailsRenders: count.optional(),
        droppedEvents: count.optional(),
    }),
    clock_reanchor: z.object({
        reason: id(32),
        serverElapsed: minute.nullable().optional(),
        status: id(8).nullable().optional(),
    }),
    list_minute_mismatch: z.object({
        label: txt(16),
        elapsed: minute.nullable().optional(),
        deltaMin: z.number().min(-300).max(300),
    }),
    clock_offset_sample: z.object({
        t0: epochMs,
        t1: epochMs,
        t2: epochMs,
        t3: epochMs,
        offsetMs: signedMs,
        rttMs: durMs,
    }),
    queue_stats: z.object({
        size: count,
        persisted: count.optional(),
        dropped: boundedNumRecord(8).optional(),
        criticalDropped: count.optional(),
        flushFailures: count.optional(),
        backoffMs: durMs.optional(),
        uploadedBatches: count.optional(),
        uploadedEvents: count.optional(),
        bytesUploaded: count.optional(),
    }),
    diag_overhead: z.object({
        windowMs: durMs,
        recordMs: durMs,
        flushMs: durMs.optional(),
        persistMs: durMs.optional(),
        serializeMs: durMs.optional(),
        events: count,
        bytes: count.optional(),
    }),
    sentry_event_ref: z.object({
        sentryEventId: z.string().regex(/^[a-f0-9]{32}$/),
        level: id(16),
        exceptionType: z.string().max(96).regex(/^[\w.$:]*$/).optional(),
    }),
    observe_entries_summary: z.object({
        count,
        observeSessionIds: z.array(id(64)).max(5).optional(),
        metrics: boundedNumRecord(48).optional(),
    }),
};

export const SEVERITIES = ['debug', 'info', 'warn', 'error', 'critical'] as const;
export const PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;

const eventBaseSchema = z.object({
    eventId: z.string().regex(/^[\w-]{6,64}$/),
    seq: z.number().int().min(0).max(1_000_000_000),
    type: z.string().max(48),
    severity: z.enum(SEVERITIES),
    priority: z.enum(PRIORITIES).optional(),
    wall: epochMs,
    mono: monoMs.optional(),
    screen: id(48).optional(),
    component: id(48).optional(),
    fixtureId: z.number().int().min(1).max(2_147_483_647).nullable().optional(),
    traceId: z.string().regex(/^[\w.:-]{1,64}$/).nullable().optional(),
    data: z.unknown().optional(),
});

export const batchEnvelopeSchema = z.object({
    schemaVersion: z.literal(DIAG_SCHEMA_VERSION),
    sessionId: z.string().uuid(),
    batchId: z.string().regex(/^[\w-]{6,64}$/),
    deviceId: z.string().regex(/^[\w-]{8,64}$/),
    sentAtWall: epochMs,
    sentAtMono: monoMs.optional(),
    app: z.object({
        version: txt(32),
        build: txt(16),
        platform: z.enum(['ios', 'android', 'web']),
        osVersion: txt(32).optional(),
        runtimeVersion: txt(32).optional(),
        updateId: z.string().max(64).regex(/^[\w-]*$/).nullable().optional(),
        channel: txt(32).nullable().optional(),
        environment: z.enum(['production', 'development']),
    }),
    events: z.array(z.unknown()).min(1).max(DIAG_LIMITS.maxEventsPerBatch),
});

export type BatchEnvelope = z.infer<typeof batchEnvelopeSchema>;

export interface NormalizedClientEvent {
    eventId: string;
    seq: number;
    type: ClientEventType;
    severity: (typeof SEVERITIES)[number];
    priority: (typeof PRIORITIES)[number];
    wall: number;
    mono?: number;
    screen?: string;
    component?: string;
    fixtureId?: number;
    traceId?: string;
    data: Record<string, unknown>;
}

export type EventRejectReason = 'invalid_event' | 'unknown_type' | 'invalid_data' | 'data_too_large';

export type EventValidation =
    | { ok: true; event: NormalizedClientEvent }
    | { ok: false; eventId: string | null; reason: EventRejectReason };

const CLIENT_TYPE_SET = new Set<string>(CLIENT_EVENT_TYPES);

function safeEventId(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object') return null;
    const value = (raw as { eventId?: unknown }).eventId;
    return typeof value === 'string' && /^[\w-]{6,64}$/.test(value) ? value : null;
}

export function validateClientEvent(raw: unknown): EventValidation {
    const base = eventBaseSchema.safeParse(raw);
    if (!base.success) return { ok: false, eventId: safeEventId(raw), reason: 'invalid_event' };
    const event = base.data;
    if (!CLIENT_TYPE_SET.has(event.type)) return { ok: false, eventId: event.eventId, reason: 'unknown_type' };
    const type = event.type as ClientEventType;

    const parsedData = DATA_SCHEMAS[type].safeParse(event.data ?? {});
    if (!parsedData.success) return { ok: false, eventId: event.eventId, reason: 'invalid_data' };
    const data = parsedData.data as Record<string, unknown>;
    if (JSON.stringify(data).length > DIAG_LIMITS.maxEventDataBytes) {
        return { ok: false, eventId: event.eventId, reason: 'data_too_large' };
    }

    return {
        ok: true,
        event: {
            eventId: event.eventId,
            seq: event.seq,
            type,
            severity: event.severity,
            priority: event.priority ?? 'normal',
            wall: event.wall,
            ...(event.mono !== undefined ? { mono: event.mono } : {}),
            ...(event.screen ? { screen: event.screen } : {}),
            ...(event.component ? { component: event.component } : {}),
            ...(event.fixtureId ? { fixtureId: event.fixtureId } : {}),
            ...(event.traceId ? { traceId: event.traceId } : {}),
            data,
        },
    };
}

/** Issue paths and codes only: request values are never echoed back or logged. */
export function summarizeIssues(error: z.ZodError): Array<{ path: string; code: string }> {
    return error.issues.slice(0, 10).map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
}
