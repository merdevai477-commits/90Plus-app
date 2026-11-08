/**
 * Switches and limits for remote diagnostics. Nothing here is active unless
 * DIAGNOSTICS_ENABLED is set, so shipping this code does not change runtime
 * behaviour for any user.
 */

function envFlag(name: string): boolean {
    const raw = process.env[name]?.trim().toLowerCase();
    return raw === '1' || raw === 'true';
}

function envInt(name: string, fallback: number, min: number, max: number): number {
    const raw = Number(process.env[name]);
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(raw)));
}

export function isDiagnosticsEnabled(): boolean {
    return envFlag('DIAGNOSTICS_ENABLED');
}

/** Backend trace capture additionally requires an active session at record time. */
export function isBackendTraceConfigured(): boolean {
    return isDiagnosticsEnabled() && envFlag('DIAG_BACKEND_TRACE');
}

export type DiagnosticsEnvironment = 'production' | 'development';

export function getServerDiagnosticsEnvironment(): DiagnosticsEnvironment {
    return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export interface DiagnosticsSecrets {
    tokenSecret: string;
    idSecret: string;
}

const MIN_SECRET_LENGTH = 32;

/** Returns null when either secret is missing or too short; callers fail closed. */
export function getDiagnosticsSecrets(): DiagnosticsSecrets | null {
    const tokenSecret = process.env.DIAG_TOKEN_SECRET?.trim() ?? '';
    const idSecret = process.env.DIAG_ID_SECRET?.trim() ?? '';
    if (tokenSecret.length < MIN_SECRET_LENGTH || idSecret.length < MIN_SECRET_LENGTH) return null;
    return { tokenSecret, idSecret };
}

export function getDiagnosticsAdminKey(): string | null {
    const key = process.env.DIAGNOSTICS_ADMIN_KEY?.trim() ?? '';
    return key.length >= MIN_SECRET_LENGTH ? key : null;
}

export const DIAG_LIMITS = {
    maxBodyBytes: 256 * 1024,
    maxEventsPerBatch: 200,
    maxEventDataBytes: 4096,
    defaultDurationMin: 30,
    maxDurationMin: 120,
    defaultMaxEvents: 20_000,
    maxMaxEvents: 50_000,
    defaultMaxDevices: 3,
    maxMaxDevices: 10,
    /** Ingest tokens stay verifiable this long after expiry so the client receives a session rejection instead of a token error. Ingest itself does not accept events during this window. */
    uploadGraceMs: 24 * 60 * 60 * 1000,
    /** Device wall clocks drift; events stamped slightly after close are still accepted. */
    closeSkewAllowanceMs: 5 * 60 * 1000,
    batchDedupTtlSec: 24 * 60 * 60,
    sessionCacheTtlSec: 30,
} as const;

export function getRetentionDays(): { events: number; sessions: number } {
    const events = envInt('DIAG_RETENTION_DAYS', 14, 1, 90);
    return { events, sessions: Math.max(events, envInt('DIAG_SESSION_RETENTION_DAYS', 30, 1, 365)) };
}

export function getIngestRateLimits(): { perTokenPerMin: number; perIpPerMin: number } {
    return {
        perTokenPerMin: envInt('DIAG_INGEST_TOKEN_RATE_MAX', 60, 1, 10_000),
        perIpPerMin: envInt('DIAG_INGEST_IP_RATE_MAX', 600, 1, 100_000),
    };
}

export function getDirectiveRateLimit(): number {
    return envInt('DIAG_DIRECTIVE_RATE_MAX', 30, 1, 10_000);
}
