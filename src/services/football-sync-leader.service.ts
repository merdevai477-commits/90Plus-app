/**
 * Token-owned Redis leases for football background jobs.
 *
 * Each acquisition gets a unique token. Renewal and release use compare-token
 * Lua scripts so a stale worker can never extend or delete a newer worker's
 * lease. Jobs may use `withSyncLeaderLease` to heartbeat while they run.
 */

import { randomUUID } from 'crypto';
import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';

const LEADER_PREFIX = 'football:sync:leader';
const DEFAULT_TTL_SEC = 30;
const MIN_TTL_SEC = 2;

const INSTANCE_ID = process.env.INSTANCE_ID ?? randomUUID();
const legacyTokens = new Map<string, string>();

const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export function getSyncLeaderInstanceId(): string {
  return INSTANCE_ID;
}

function leaderKey(scope: string): string {
  return `${LEADER_PREFIX}:${scope}`;
}

function normalizedTtl(ttlSec: number): number {
  return Math.max(MIN_TTL_SEC, Math.floor(ttlSec) || DEFAULT_TTL_SEC);
}

export interface SyncLeaderLease {
  readonly scope: string;
  readonly token: string;
  readonly ttlSec: number;
  renew(): Promise<boolean>;
  release(): Promise<void>;
}

export interface SyncLeaderLeaseOptions {
  ttlSec?: number;
  heartbeatMs?: number;
  /** Override production's fail-closed Redis behavior for this call. */
  failClosed?: boolean;
}

export interface SyncLeaderLeaseResult<T> {
  acquired: boolean;
  value?: T;
  lost?: boolean;
}

export interface SyncLeaderLeaseContext {
  readonly signal: AbortSignal;
  isLost(): boolean;
}

function shouldFailClosed(override?: boolean): boolean {
  if (override != null) return override;
  const configured = process.env.FOOTBALL_SYNC_LEASE_FAIL_CLOSED?.trim().toLowerCase();
  if (configured === 'true' || configured === '1') return true;
  if (configured === 'false' || configured === '0') return false;
  return process.env.NODE_ENV === 'production';
}

export async function acquireSyncLeaderLease(
  scope: string,
  ttlSec = DEFAULT_TTL_SEC,
  options: { failClosed?: boolean } = {},
): Promise<SyncLeaderLease | null> {
  const redis = getRedisClient();
  const ttl = normalizedTtl(ttlSec);
  const token = `${INSTANCE_ID}:${randomUUID()}`;

  if (!redis) {
    if (shouldFailClosed(options.failClosed)) {
      logger.warn(`[SyncLeader] Redis unavailable; refusing ${scope} lease`);
      return null;
    }
    return {
      scope,
      token,
      ttlSec: ttl,
      renew: async () => true,
      release: async () => {},
    };
  }

  const key = leaderKey(scope);
  try {
    const acquired = await redis.set(key, token, 'EX', ttl, 'NX');
    if (acquired !== 'OK') {
      logger.debug(`[SyncLeader] Skipping ${scope} — lease already owned`);
      return null;
    }

    return {
      scope,
      token,
      ttlSec: ttl,
      renew: async () => {
        try {
          const renewed = await redis.eval(RENEW_SCRIPT, 1, key, token, String(ttl));
          return Number(renewed) === 1;
        } catch (err) {
          logger.warn(`[SyncLeader] renewal failed for ${scope}:`, err);
          return false;
        }
      },
      release: async () => {
        try {
          await redis.eval(RELEASE_SCRIPT, 1, key, token);
        } catch (err) {
          logger.warn(`[SyncLeader] release failed for ${scope}:`, err);
        }
      },
    };
  } catch (err: unknown) {
    if (shouldFailClosed(options.failClosed)) {
      logger.warn(`[SyncLeader] acquire failed closed for ${scope}:`, err);
      return null;
    }
    logger.warn('[SyncLeader] acquire failed (single-instance fallback):', err);
    return {
      scope,
      token,
      ttlSec: ttl,
      renew: async () => true,
      release: async () => {},
    };
  }
}

/**
 * Run work under a distributed lease and renew it until the work settles.
 */
export async function withSyncLeaderLease<T>(
  scope: string,
  work: (context: SyncLeaderLeaseContext) => Promise<T>,
  options: SyncLeaderLeaseOptions = {},
): Promise<SyncLeaderLeaseResult<T>> {
  const lease = await acquireSyncLeaderLease(scope, options.ttlSec, {
    failClosed: options.failClosed,
  });
  if (!lease) return { acquired: false };

  const heartbeatMs = Math.max(
    1_000,
    options.heartbeatMs ?? Math.floor((lease.ttlSec * 1_000) / 3),
  );
  let heartbeat: NodeJS.Timeout | null = null;
  let lost = false;
  let settled = false;
  const abortController = new AbortController();
  const context: SyncLeaderLeaseContext = {
    signal: abortController.signal,
    isLost: () => lost,
  };

  try {
    heartbeat = setInterval(() => {
      void lease.renew().then((renewed) => {
        if (!renewed && !settled && !lost) {
          lost = true;
          abortController.abort(new Error(`Lost ${scope} sync leader lease`));
          logger.warn(`[SyncLeader] Lost ${scope} lease while job was running`);
        }
      });
    }, heartbeatMs);
    heartbeat.unref?.();

    const value = await work(context);
    return { acquired: true, value, ...(lost ? { lost: true } : {}) };
  } finally {
    settled = true;
    if (heartbeat) clearInterval(heartbeat);
    await lease.release();
  }
}

/**
 * Try to become (or renew) the sync leader for a scoped background job.
 * Backward-compatible API for short ticks. New long-running jobs should use
 * `withSyncLeaderLease`, which has per-run ownership and heartbeat.
 */
export async function tryAcquireSyncLeader(
  scope: string,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return true;
  }

  const key = leaderKey(scope);
  const ttl = normalizedTtl(ttlSec);

  try {
    const existingToken = legacyTokens.get(scope);
    if (existingToken) {
      const renewed = await redis.eval(
        RENEW_SCRIPT,
        1,
        key,
        existingToken,
        String(ttl),
      );
      if (Number(renewed) === 1) return true;
      legacyTokens.delete(scope);
    }

    const token = `${INSTANCE_ID}:${randomUUID()}`;
    const acquired = await redis.set(key, token, 'EX', ttl, 'NX');
    if (acquired === 'OK') {
      legacyTokens.set(scope, token);
      return true;
    }

    logger.debug(`[SyncLeader] Skipping ${scope} — lease already owned`);
    return false;
  } catch (err: unknown) {
    logger.warn('[SyncLeader] acquire failed (fail open):', err);
    return true;
  }
}

export async function releaseSyncLeader(scope: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const key = leaderKey(scope);
  const token = legacyTokens.get(scope);
  if (!token) return;
  try {
    await redis.eval(RELEASE_SCRIPT, 1, key, token);
  } catch {
    // non-fatal
  } finally {
    legacyTokens.delete(scope);
  }
}
