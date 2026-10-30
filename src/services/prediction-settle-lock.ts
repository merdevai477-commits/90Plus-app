/**
 * Per-match settlement lock backed by a single Postgres lease row
 * (`settle_leases`). One lock domain for every replica — a Redis lock on one
 * instance and an advisory lock on another would not exclude each other, and
 * session advisory locks do not survive pooled connections (A5).
 * Fail-closed — no settle without a lease.
 */

import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const LEASE_TTL_MS = 60_000;
/** Heartbeat well inside the TTL so one slow tick never loses the lease. */
export const SETTLE_HEARTBEAT_MS = 20_000;

export type SettleLockKind = 'lease';

export type SettleLockHandle = {
  kind: SettleLockKind;
  owner: string;
  /** Push expiry forward; false when another owner took the lease (lock lost). */
  extend: () => Promise<boolean>;
  release: () => Promise<void>;
};

export type SettleLockAcquireResult =
  | { ok: true; handle: SettleLockHandle; waitMs: number }
  | { ok: false; reason: 'SETTLE_SKIPPED_LOCKED' | 'SETTLE_SKIPPED_NO_LOCK'; waitMs: number };

async function extendLease(apiMatchId: number, owner: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ owner: string }>>`
      UPDATE settle_leases
         SET "expiresAt" = now() + (${LEASE_TTL_MS}::int * interval '1 millisecond')
       WHERE "apiMatchId" = ${apiMatchId}::int AND owner = ${owner}
      RETURNING owner
    `;
    return rows.length === 1;
  } catch (err: any) {
    logger.warn(`[SettleLock] lease extend error for ${apiMatchId}:`, err?.message);
    return false;
  }
}

async function releaseLease(apiMatchId: number, owner: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM settle_leases WHERE "apiMatchId" = ${apiMatchId}::int AND owner = ${owner}
    `;
  } catch (err: any) {
    logger.debug(`[SettleLock] lease release failed for ${apiMatchId}:`, err?.message);
  }
}

/**
 * Acquire the lease for apiMatchId: insert, or take over an expired row.
 * A live lease held by someone else → SETTLE_SKIPPED_LOCKED; DB error →
 * SETTLE_SKIPPED_NO_LOCK.
 */
export async function acquireSettleLock(apiMatchId: number): Promise<SettleLockAcquireResult> {
  const started = Date.now();
  const owner = randomUUID();
  try {
    const rows = await prisma.$queryRaw<Array<{ owner: string }>>`
      INSERT INTO settle_leases ("apiMatchId", owner, "expiresAt", "acquiredAt")
      VALUES (${apiMatchId}::int, ${owner}, now() + (${LEASE_TTL_MS}::int * interval '1 millisecond'), now())
      ON CONFLICT ("apiMatchId") DO UPDATE
         SET owner = EXCLUDED.owner,
             "expiresAt" = EXCLUDED."expiresAt",
             "acquiredAt" = EXCLUDED."acquiredAt"
       WHERE settle_leases."expiresAt" < now()
      RETURNING owner
    `;
    if (rows[0]?.owner !== owner) {
      return { ok: false, reason: 'SETTLE_SKIPPED_LOCKED', waitMs: Date.now() - started };
    }
  } catch (err: any) {
    logger.warn(`[SettleLock] lease acquire error for ${apiMatchId}:`, err?.message);
    return { ok: false, reason: 'SETTLE_SKIPPED_NO_LOCK', waitMs: Date.now() - started };
  }

  return {
    ok: true,
    waitMs: Date.now() - started,
    handle: {
      kind: 'lease',
      owner,
      extend: () => extendLease(apiMatchId, owner),
      release: () => releaseLease(apiMatchId, owner),
    },
  };
}

export type LeaseHeartbeat = {
  isLost: () => boolean;
  /** Extend now (chunk boundary); marks the lease lost on failure. */
  beat: () => Promise<boolean>;
  stop: () => void;
};

export function startLeaseHeartbeat(
  handle: SettleLockHandle,
  intervalMs: number = SETTLE_HEARTBEAT_MS,
): LeaseHeartbeat {
  let lost = false;
  const beat = async () => {
    if (lost) return false;
    const ok = await handle.extend();
    if (!ok) lost = true;
    return ok;
  };
  const timer = setInterval(() => void beat(), intervalMs);
  timer.unref?.();
  return { isLost: () => lost, beat, stop: () => clearInterval(timer) };
}

export const SETTLE_LOCK_TTL_SEC = LEASE_TTL_MS / 1000;
