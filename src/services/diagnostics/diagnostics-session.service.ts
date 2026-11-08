import { z } from 'zod';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { DIAG_LIMITS, type DiagnosticsEnvironment } from './diagnostics.config';
import { DIAG_KEYS, diagRedis } from './diagnostics-redis';

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

export async function invalidateSessionCache(sessionId: string): Promise<void> {
    const redis = diagRedis();
    if (!redis) return;
    try {
        await redis.del(DIAG_KEYS.session(sessionId));
    } catch (err) {
        logger.warn('[DIAG] session cache invalidate failed', (err as Error)?.message);
    }
}
