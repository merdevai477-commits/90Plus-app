import type Redis from 'ioredis';
import { getRedisClient, isRedisConnected } from '../../lib/redis';

/**
 * Redis is an accelerator for diagnostics (session cache, counters, batch
 * dedup), never a requirement: when it is down every caller falls back to
 * Postgres instead of queueing commands behind a dead connection.
 */
export function diagRedis(): Redis | null {
    if (!isRedisConnected()) return null;
    return getRedisClient();
}

export const DIAG_KEYS = {
    session: (sessionId: string) => `diag:session:${sessionId}`,
    eventCount: (sessionId: string) => `diag:sess:${sessionId}:count`,
    batch: (sessionId: string, batchId: string) => `diag:batch:${sessionId}:${batchId}`,
    activeSessions: 'diag:active_sessions',
    seenDevices: 'diag:seen_devices',
    seenDevice: (deviceRef: string) => `diag:seen_device:${deviceRef}`,
} as const;
