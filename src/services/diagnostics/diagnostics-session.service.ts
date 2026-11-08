import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import {
    DIAG_LIMITS,
    getServerDiagnosticsEnvironment,
    type DiagnosticsEnvironment,
    type DiagnosticsSecrets,
} from './diagnostics.config';
import { DIAG_KEYS, diagRedis } from './diagnostics-redis';
import { computeRef, signIngestToken } from './diagnostics-token';
import type { DiagApp } from './diagnostics.schema';

export const sessionFeaturesSchema = z.object({
    pipeline: z.boolean().default(true),
    render: z.boolean().default(true),
    clock: z.boolean().default(true),
    sentryTags: z.boolean().default(true),
    observe: z.boolean().default(true),
    backendTrace: z.boolean().default(true),
});

export const sessionSamplingSchema = z.object({
    pipeline: z.number().min(0).max(1).default(1),
    render: z.number().min(0).max(1).default(1),
    selectorTiming: z.number().min(0).max(1).default(0.1),
});

export const sessionConfigSchema = z.object({
    maxEvents: z.number().int().min(100).max(DIAG_LIMITS.maxMaxEvents).default(DIAG_LIMITS.defaultMaxEvents),
    maxDevices: z.number().int().min(1).max(DIAG_LIMITS.maxMaxDevices).default(DIAG_LIMITS.defaultMaxDevices),
    features: sessionFeaturesSchema.default(sessionFeaturesSchema.parse({})),
    sampling: sessionSamplingSchema.default(sessionSamplingSchema.parse({})),
});

const refList = z.array(z.string().regex(/^[a-f0-9]{32}$/)).max(20);

export const sessionTargetSchema = z
    .object({
        platform: z.enum(['ios', 'android']).optional(),
        buildNumbers: z.array(z.string().regex(/^[\w.-]{1,16}$/)).max(20).optional(),
        appVersion: z.string().regex(/^[\w.-]{1,32}$/).optional(),
        deviceRefs: refList.optional(),
        userRefs: refList.optional(),
    })
    .refine(
        (target) =>
            Boolean(target.buildNumbers?.length || target.appVersion || target.deviceRefs?.length || target.userRefs?.length),
        { message: 'target_needs_build_version_device_or_user' },
    );

export type SessionConfig = z.infer<typeof sessionConfigSchema>;
export type SessionTarget = z.infer<typeof sessionTargetSchema>;

export type StoredSessionStatus = 'active' | 'stopped' | 'expired';
export type EffectiveSessionState = 'active' | 'stopped' | 'expired';

export interface SessionSnapshot {
    id: string;
    label: string | null;
    status: StoredSessionStatus;
    environment: DiagnosticsEnvironment;
    target: SessionTarget;
    config: SessionConfig;
    startsAt: number;
    expiresAt: number;
    stoppedAt: number | null;
    eventCount: number;
    createdBy: string | null;
}

interface SessionRow {
    id: string;
    label: string | null;
    status: string;
    environment: string;
    target: unknown;
    config: unknown;
    startsAt: Date;
    expiresAt: Date;
    stoppedAt: Date | null;
    eventCount: number;
    createdBy?: string | null;
}

export function toSessionSnapshot(row: SessionRow): SessionSnapshot {
    const config = sessionConfigSchema.safeParse(row.config ?? {});
    const target = sessionTargetSchema.safeParse(row.target ?? {});
    return {
        id: row.id,
        label: row.label,
        status: row.status === 'stopped' || row.status === 'expired' ? row.status : 'active',
        environment: row.environment === 'development' ? 'development' : 'production',
        target: target.success ? target.data : {},
        config: config.success ? config.data : sessionConfigSchema.parse({}),
        startsAt: row.startsAt.getTime(),
        expiresAt: row.expiresAt.getTime(),
        stoppedAt: row.stoppedAt ? row.stoppedAt.getTime() : null,
        eventCount: row.eventCount,
        createdBy: row.createdBy ?? null,
    };
}

export function effectiveSessionState(session: SessionSnapshot, nowMs: number): EffectiveSessionState {
    if (session.status === 'stopped') return 'stopped';
    if (session.status === 'expired' || nowMs >= session.expiresAt) return 'expired';
    return 'active';
}

/** The moment recording ended (or will end) for this session. */
export function sessionCloseAt(session: SessionSnapshot): number {
    return session.stoppedAt ?? session.expiresAt;
}

export async function getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
    const redis = diagRedis();
    if (redis) {
        try {
            const cached = await redis.get(DIAG_KEYS.session(sessionId));
            if (cached) return JSON.parse(cached) as SessionSnapshot;
        } catch (err) {
            logger.warn('[DIAG] session cache read failed', (err as Error)?.message);
        }
    }

    const row = await prisma.diagnosticSession.findUnique({ where: { id: sessionId } });
    if (!row) return null;
    const snapshot = toSessionSnapshot(row);

    if (redis) {
        try {
            await redis.set(DIAG_KEYS.session(sessionId), JSON.stringify(snapshot), 'EX', DIAG_LIMITS.sessionCacheTtlSec);
        } catch (err) {
            logger.warn('[DIAG] session cache write failed', (err as Error)?.message);
        }
    }
    return snapshot;
}

const activeSessionsKey = (environment: DiagnosticsEnvironment) => `${DIAG_KEYS.activeSessions}:${environment}`;
const ACTIVE_SESSIONS_CACHE_TTL_SEC = 15;
const SEEN_DEVICE_TTL_SEC = 24 * 60 * 60;
const SEEN_DEVICES_CAP = 200;

export async function invalidateSessionCache(sessionId: string): Promise<void> {
    const redis = diagRedis();
    if (!redis) return;
    try {
        await redis.del(
            DIAG_KEYS.session(sessionId),
            activeSessionsKey('production'),
            activeSessionsKey('development'),
        );
    } catch (err) {
        logger.warn('[DIAG] session cache invalidate failed', (err as Error)?.message);
    }
}

// ---------------------------------------------------------------------------
// Admin: create / list / stop
// ---------------------------------------------------------------------------

const SAFE_LABEL = /^[\w .:#()+-]*$/;

export const createSessionRequestSchema = z.object({
    label: z.string().max(80).regex(SAFE_LABEL).optional(),
    durationMin: z
        .number()
        .int()
        .min(1)
        .max(DIAG_LIMITS.maxDurationMin)
        .default(DIAG_LIMITS.defaultDurationMin),
    target: z.object({
        platform: z.enum(['ios', 'android']).optional(),
        buildNumbers: z.array(z.string().regex(/^[\w.-]{1,16}$/)).max(20).optional(),
        appVersion: z.string().regex(/^[\w.-]{1,32}$/).optional(),
        deviceRefs: refList.optional(),
        /** Clerk user ids (`user_...`) or internal user ids; only their HMAC refs are stored. */
        userIds: z.array(z.string().regex(/^[\w-]{3,64}$/)).max(10).optional(),
    }),
    config: z
        .object({
            maxEvents: z.number().int().min(100).max(DIAG_LIMITS.maxMaxEvents).optional(),
            maxDevices: z.number().int().min(1).max(DIAG_LIMITS.maxMaxDevices).optional(),
            features: sessionFeaturesSchema.partial().optional(),
            sampling: sessionSamplingSchema.partial().optional(),
        })
        .optional(),
});

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export type CreateSessionResult =
    | { ok: true; session: SessionSnapshot }
    | { ok: false; error: 'user_not_found' | 'invalid_target' };

async function resolveClerkUserId(id: string): Promise<string | null> {
    if (id.startsWith('user_')) return id;
    const user = await prisma.user.findUnique({ where: { id }, select: { clerkUserId: true } });
    return user?.clerkUserId ?? null;
}

export async function createSession(
    input: CreateSessionRequest,
    secrets: DiagnosticsSecrets,
    createdBy: string | null,
    nowMs: number,
): Promise<CreateSessionResult> {
    const userRefs: string[] = [];
    for (const id of input.target.userIds ?? []) {
        const clerkUserId = await resolveClerkUserId(id);
        if (!clerkUserId) return { ok: false, error: 'user_not_found' };
        userRefs.push(computeRef('user', clerkUserId, secrets.idSecret));
    }

    const target = sessionTargetSchema.safeParse({
        platform: input.target.platform,
        buildNumbers: input.target.buildNumbers,
        appVersion: input.target.appVersion,
        deviceRefs: input.target.deviceRefs,
        userRefs: userRefs.length ? userRefs : undefined,
    });
    if (!target.success) return { ok: false, error: 'invalid_target' };

    const config = sessionConfigSchema.parse({
        maxEvents: input.config?.maxEvents,
        maxDevices: input.config?.maxDevices,
        features: input.config?.features ?? {},
        sampling: input.config?.sampling ?? {},
    });

    const row = await prisma.diagnosticSession.create({
        data: {
            label: input.label ?? null,
            status: 'active',
            environment: getServerDiagnosticsEnvironment(),
            target: target.data as Prisma.InputJsonValue,
            config: config as Prisma.InputJsonValue,
            startsAt: new Date(nowMs),
            expiresAt: new Date(nowMs + input.durationMin * 60_000),
            createdBy,
        },
    });
    const session = toSessionSnapshot(row);
    await invalidateSessionCache(session.id);
    logger.info(
        `[DIAG] ${JSON.stringify({
            evt: 'session_created',
            session: session.id.slice(0, 8),
            durationMin: input.durationMin,
            maxDevices: config.maxDevices,
            maxEvents: config.maxEvents,
        })}`,
    );
    return { ok: true, session };
}

export interface SessionListItem extends SessionSnapshot {
    state: EffectiveSessionState;
    deviceCount: number;
}

export async function listSessions(limit: number, nowMs: number): Promise<SessionListItem[]> {
    const rows = await prisma.diagnosticSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
        include: { _count: { select: { devices: true } } },
    });
    return rows.map((row) => {
        const snapshot = toSessionSnapshot(row);
        return { ...snapshot, state: effectiveSessionState(snapshot, nowMs), deviceCount: row._count.devices };
    });
}

export async function stopSession(sessionId: string, nowMs: number): Promise<SessionSnapshot | null> {
    await prisma.diagnosticSession.updateMany({
        where: { id: sessionId, status: 'active' },
        data: { status: 'stopped', stoppedAt: new Date(nowMs) },
    });
    await invalidateSessionCache(sessionId);
    const row = await prisma.diagnosticSession.findUnique({ where: { id: sessionId } });
    return row ? toSessionSnapshot(row) : null;
}

export async function listSessionDevices(sessionId: string) {
    return prisma.diagnosticSessionDevice.findMany({
        where: { sessionId },
        orderBy: { joinedAt: 'asc' },
        select: {
            deviceRef: true,
            userRef: true,
            platform: true,
            appVersion: true,
            buildNumber: true,
            runtimeVersion: true,
            updateId: true,
            channel: true,
            osVersion: true,
            joinedAt: true,
            lastSeenAt: true,
            eventCount: true,
        },
    });
}

// ---------------------------------------------------------------------------
// Device directive
// ---------------------------------------------------------------------------

export interface TargetContext {
    platform: string;
    build: string;
    version: string;
    deviceRef: string;
    userRef: string | null;
}

/** Every configured selector must match; a target with no selector matches nothing. */
export function matchesTarget(target: SessionTarget, ctx: TargetContext): boolean {
    const hasSelector = Boolean(
        target.buildNumbers?.length || target.appVersion || target.deviceRefs?.length || target.userRefs?.length,
    );
    if (!hasSelector) return false;
    if (target.platform && target.platform !== ctx.platform) return false;
    if (target.buildNumbers?.length && !target.buildNumbers.includes(ctx.build)) return false;
    if (target.appVersion && target.appVersion !== ctx.version) return false;
    if (target.deviceRefs?.length && !target.deviceRefs.includes(ctx.deviceRef)) return false;
    if (target.userRefs?.length && (!ctx.userRef || !target.userRefs.includes(ctx.userRef))) return false;
    return true;
}

export async function listActiveSessions(environment: DiagnosticsEnvironment, nowMs: number): Promise<SessionSnapshot[]> {
    const redis = diagRedis();
    let sessions: SessionSnapshot[] | null = null;
    if (redis) {
        try {
            const cached = await redis.get(activeSessionsKey(environment));
            if (cached) sessions = JSON.parse(cached) as SessionSnapshot[];
        } catch {
            sessions = null;
        }
    }
    if (!sessions) {
        const rows = await prisma.diagnosticSession.findMany({
            where: { status: 'active', environment, expiresAt: { gt: new Date(nowMs) } },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        sessions = rows.map(toSessionSnapshot);
        if (redis) {
            try {
                await redis.set(activeSessionsKey(environment), JSON.stringify(sessions), 'EX', ACTIVE_SESSIONS_CACHE_TTL_SEC);
            } catch {
                /* next directive reads Postgres again */
            }
        }
    }
    return sessions.filter((session) => effectiveSessionState(session, nowMs) === 'active');
}

/**
 * Reserves a device slot. The session row is locked so concurrent joins can
 * never exceed maxDevices; a device that already joined keeps its slot.
 */
async function joinSession(
    session: SessionSnapshot,
    deviceRef: string,
    userRef: string | null,
    app: DiagApp,
    nowMs: number,
): Promise<boolean> {
    const details = {
        userRef,
        platform: app.platform,
        appVersion: app.version,
        buildNumber: app.build,
        runtimeVersion: app.runtimeVersion ?? null,
        updateId: app.updateId ?? null,
        channel: app.channel ?? null,
        osVersion: app.osVersion ?? null,
    };
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "diagnostic_sessions" WHERE "id" = ${session.id} FOR UPDATE`;
        const existing = await tx.diagnosticSessionDevice.findUnique({
            where: { sessionId_deviceRef: { sessionId: session.id, deviceRef } },
            select: { id: true },
        });
        if (existing) {
            await tx.diagnosticSessionDevice.update({
                where: { id: existing.id },
                data: { ...details, lastSeenAt: new Date(nowMs) },
            });
            return true;
        }
        const joined = await tx.diagnosticSessionDevice.count({ where: { sessionId: session.id } });
        if (joined >= session.config.maxDevices) return false;
        await tx.diagnosticSessionDevice.create({
            data: { sessionId: session.id, deviceRef, ...details, joinedAt: new Date(nowMs), lastSeenAt: new Date(nowMs) },
        });
        return true;
    });
}

export interface SeenDevice {
    deviceRef: string;
    platform: string;
    version: string;
    build: string;
    channel: string | null;
    updateId: string | null;
    signedIn: boolean;
    lastSeenAt: number;
}

async function rememberSeenDevice(device: SeenDevice): Promise<void> {
    const redis = diagRedis();
    if (!redis) return;
    try {
        await redis
            .multi()
            .set(DIAG_KEYS.seenDevice(device.deviceRef), JSON.stringify(device), 'EX', SEEN_DEVICE_TTL_SEC)
            .zadd(DIAG_KEYS.seenDevices, device.lastSeenAt, device.deviceRef)
            .zremrangebyscore(DIAG_KEYS.seenDevices, 0, device.lastSeenAt - SEEN_DEVICE_TTL_SEC * 1000)
            .zremrangebyrank(DIAG_KEYS.seenDevices, 0, -(SEEN_DEVICES_CAP + 1))
            .expire(DIAG_KEYS.seenDevices, SEEN_DEVICE_TTL_SEC)
            .exec();
    } catch (err) {
        logger.warn('[DIAG] seen-device write failed', (err as Error)?.message);
    }
}

/** Diagnostics-capable devices that asked for a directive in the last 24h (Redis only). */
export async function listSeenDevices(nowMs: number): Promise<SeenDevice[]> {
    const redis = diagRedis();
    if (!redis) return [];
    const refs = await redis.zrevrangebyscore(
        DIAG_KEYS.seenDevices,
        '+inf',
        nowMs - SEEN_DEVICE_TTL_SEC * 1000,
        'LIMIT',
        0,
        100,
    );
    if (!refs.length) return [];
    const raw = await redis.mget(...refs.map((ref) => DIAG_KEYS.seenDevice(ref)));
    return raw.flatMap((value) => {
        if (!value) return [];
        try {
            return [JSON.parse(value) as SeenDevice];
        } catch {
            return [];
        }
    });
}

export type DirectiveResult =
    | { active: false }
    | {
          active: true;
          session: SessionSnapshot;
          token: string;
          deviceRef: string;
          uploadUntil: number;
      };

export async function resolveDirective(input: {
    deviceId: string;
    app: DiagApp;
    clerkUserId: string | null;
    secrets: DiagnosticsSecrets;
    nowMs: number;
}): Promise<DirectiveResult> {
    const { app, secrets, nowMs } = input;
    const deviceRef = computeRef('device', input.deviceId, secrets.idSecret);
    const userRef = input.clerkUserId ? computeRef('user', input.clerkUserId, secrets.idSecret) : null;

    await rememberSeenDevice({
        deviceRef,
        platform: app.platform,
        version: app.version,
        build: app.build,
        channel: app.channel ?? null,
        updateId: app.updateId ?? null,
        signedIn: userRef !== null,
        lastSeenAt: nowMs,
    });

    const environment = getServerDiagnosticsEnvironment();
    if (app.environment !== environment) return { active: false };

    const ctx: TargetContext = { platform: app.platform, build: app.build, version: app.version, deviceRef, userRef };
    for (const session of await listActiveSessions(environment, nowMs)) {
        if (!matchesTarget(session.target, ctx)) continue;
        if (session.eventCount >= session.config.maxEvents) continue;
        if (!(await joinSession(session, deviceRef, userRef, app, nowMs))) continue;

        const uploadUntil = session.expiresAt + DIAG_LIMITS.uploadGraceMs;
        const token = signIngestToken(
            { sessionId: session.id, deviceRef, expSec: Math.ceil(uploadUntil / 1000) },
            secrets.tokenSecret,
        );
        return { active: true, session, token, deviceRef, uploadUntil };
    }
    return { active: false };
}
