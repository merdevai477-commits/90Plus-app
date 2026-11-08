import Redis from 'ioredis';
import { logger } from '../../utils/logger';
import { getServerDiagnosticsEnvironment } from './diagnostics.config';

/**
 * Diagnostics Redis is optional and isolated from the application Redis.
 *
 * REDIS_URL is never used here. Set DIAG_REDIS_URL to opt in. Outside
 * production, a URL that points at the same host and port as REDIS_URL is
 * refused unless DIAG_REDIS_ALLOW_PRODUCTION=1. With no diagnostic URL,
 * callers use Postgres only.
 */

export type DiagnosticRedisMode = 'disabled' | 'isolated' | 'refused';

export interface DiagnosticRedisDescription {
    environment: 'production' | 'development';
    mode: DiagnosticRedisMode;
    host: string | null;
    port: string | null;
    namespace: string;
    reason: string;
}

interface RedisEndpoint {
    host: string;
    port: string;
}

let client: Redis | null = null;
let logged = false;
let testOverride: { client: Redis | null } | null = null;

export function diagnosticKeyNamespace(): string {
    return `diag:${getServerDiagnosticsEnvironment()}`;
}

export function parseRedisEndpoint(value: string | undefined): RedisEndpoint | null {
    const raw = value?.trim();
    if (!raw) return null;
    try {
        const url = new URL(raw);
        if (!url.hostname) return null;
        return { host: url.hostname.toLowerCase(), port: url.port || '6379' };
    } catch {
        return null;
    }
}

export function describeDiagnosticRedis(): DiagnosticRedisDescription {
    const environment = getServerDiagnosticsEnvironment();
    const namespace = diagnosticKeyNamespace();
    const diagnostic = parseRedisEndpoint(process.env.DIAG_REDIS_URL);
    const application = parseRedisEndpoint(process.env.REDIS_URL);
    if (!process.env.DIAG_REDIS_URL?.trim() || !diagnostic) {
        return {
            environment,
            mode: 'disabled',
            host: null,
            port: null,
            namespace,
            reason: 'DIAG_REDIS_URL is unset. Diagnostics use Postgres only and do not read REDIS_URL.',
        };
    }
    const sameServer = application !== null && application.host === diagnostic.host && application.port === diagnostic.port;
    const allowed = process.env.DIAG_REDIS_ALLOW_PRODUCTION === '1' || process.env.NODE_ENV === 'production';
    if (sameServer && !allowed) {
        return {
            environment,
            mode: 'refused',
            host: diagnostic.host,
            port: diagnostic.port,
            namespace,
            reason: 'DIAG_REDIS_URL matches REDIS_URL outside production. Refusing the connection.',
        };
    }
    return {
        environment,
        mode: 'isolated',
        host: diagnostic.host,
        port: diagnostic.port,
        namespace,
        reason: 'Using DIAG_REDIS_URL.',
    };
}

function logSelection(description: DiagnosticRedisDescription): void {
    if (logged) return;
    logged = true;
    logger.info(
        `[DIAG] ${JSON.stringify({
            evt: 'redis',
            environment: description.environment,
            mode: description.mode,
            host: description.host,
            port: description.port,
            namespace: description.namespace,
            reason: description.reason,
        })}`,
    );
}

/** Connected diagnostic Redis, or null when disabled or refused. Never uses REDIS_URL. */
export function diagRedis(): Redis | null {
    if (testOverride) return testOverride.client;
    const description = describeDiagnosticRedis();
    logSelection(description);
    if (description.mode !== 'isolated') return null;
    if (client) return client;
    client = new Redis(process.env.DIAG_REDIS_URL!.trim(), {
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
        lazyConnect: true,
        enableOfflineQueue: false,
    });
    client.on('error', (err) => {
        logger.warn('[DIAG] redis error', err.message);
    });
    void client.connect().catch((err) => {
        logger.warn('[DIAG] redis connect failed', (err as Error).message);
    });
    return client;
}

export const DIAG_KEYS = {
    session: (sessionId: string) => `${diagnosticKeyNamespace()}:session:${sessionId}`,
    eventCount: (sessionId: string) => `${diagnosticKeyNamespace()}:sess:${sessionId}:count`,
    batch: (sessionId: string, batchId: string) => `${diagnosticKeyNamespace()}:batch:${sessionId}:${batchId}`,
    activeSessions: () => `${diagnosticKeyNamespace()}:active_sessions`,
    seenDevices: () => `${diagnosticKeyNamespace()}:seen_devices`,
    seenDevice: (deviceRef: string) => `${diagnosticKeyNamespace()}:seen_device:${deviceRef}`,
} as const;

/**
 * Refuses a local diagnostic run that would attach to the application Redis.
 * Call this before importing modules that connect to REDIS_URL.
 */
export function guardDiagnosticTestProcess(): void {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Diagnostic test refused: NODE_ENV is production.');
    }
    const description = describeDiagnosticRedis();
    if (description.mode === 'refused') {
        throw new Error(`Diagnostic test refused: ${description.reason}`);
    }
}

export function setDiagnosticRedisForTests(client: Redis | null): void {
    testOverride = { client };
}

export function resetDiagnosticRedisForTests(): void {
    testOverride = null;
    logged = false;
    if (client) {
        client.disconnect();
        client = null;
    }
}
