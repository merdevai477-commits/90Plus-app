import crypto from 'crypto';
import { clerkClient } from '@clerk/express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Long-lived per-device keys that let the app silently restore a Clerk session
 * after Clerk's fixed 7-day maximum session lifetime (Hobby plan) ends it.
 *
 * Only a SHA-256 hash of the key is stored. Keys rotate on every resume.
 *
 * Concurrent resumes with the same key (app remount / double effect) used to
 * treat the loser as theft and wipe every key for the user — that forced mass
 * logouts. Rotation is now claimed atomically; a key revoked within the grace
 * window returns `already_rotated` without wiping siblings.
 */

const DEVICE_KEY_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SIGN_IN_TICKET_TTL_SECONDS = 5 * 60;
const MAX_ACTIVE_KEYS_PER_USER = 10;
/** Rotated keys are kept this long so a replayed old key can still be detected. */
const REVOKED_KEY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * If two resume calls race, the loser sees a just-revoked key. Inside this
 * window we treat that as concurrency, not theft.
 */
export const CONCURRENT_ROTATION_GRACE_MS = 60_000;

export interface DeviceKeyMeta {
  deviceInfo?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IssuedDeviceKey {
  deviceKey: string;
  expiresAt: Date;
}

export type ResumeResult =
  | { ok: true; ticket: string; deviceKey: string; expiresAt: Date }
  | {
      ok: false;
      reason: 'invalid' | 'expired' | 'reused' | 'already_rotated' | 'user_unavailable';
    };

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey(): string {
  return crypto.randomBytes(48).toString('base64url');
}

function trimMeta(meta: DeviceKeyMeta) {
  return {
    deviceInfo: meta.deviceInfo?.slice(0, 200) ?? null,
    ipAddress: meta.ipAddress?.slice(0, 100) ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  };
}

async function pruneUserKeys(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
      OR: [
        { expiresAt: { lt: new Date() } },
        { isRevoked: true, lastUsedAt: { lt: new Date(Date.now() - REVOKED_KEY_RETENTION_MS) } },
      ],
    },
  });

  const active = await prisma.refreshToken.findMany({
    where: { userId, isRevoked: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const overflow = active.slice(MAX_ACTIVE_KEYS_PER_USER - 1).map((r) => r.id);
  if (overflow.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { id: { in: overflow } } });
  }
}

export async function issueDeviceKey(userId: string, meta: DeviceKeyMeta): Promise<IssuedDeviceKey> {
  await pruneUserKeys(userId);

  const deviceKey = generateRawKey();
  const expiresAt = new Date(Date.now() + DEVICE_KEY_TTL_MS);
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashKey(deviceKey),
      expiresAt,
      ...trimMeta(meta),
    },
  });
  return { deviceKey, expiresAt };
}

/**
 * True when a revoked key was rotated moments ago (concurrent resume), not a
 * stale replay that should trigger theft lockdown.
 */
export function isRecentConcurrentRotation(
  lastUsedAt: Date | null | undefined,
  nowMs = Date.now(),
  graceMs = CONCURRENT_ROTATION_GRACE_MS,
): boolean {
  if (!lastUsedAt) return false;
  const age = nowMs - lastUsedAt.getTime();
  return age >= 0 && age < graceMs;
}

export async function resumeWithDeviceKey(rawKey: string, meta: DeviceKeyMeta): Promise<ResumeResult> {
  const hashed = hashKey(rawKey);

  const record = await prisma.refreshToken.findUnique({
    where: { token: hashed },
    include: {
      user: {
        select: {
          id: true,
          clerkUserId: true,
          isBanned: true,
          isDeleted: true,
          deletionRequestedAt: true,
        },
      },
    },
  });

  if (!record) return { ok: false, reason: 'invalid' };

  if (record.isRevoked) {
    if (isRecentConcurrentRotation(record.lastUsedAt)) {
      logger.info('[DeviceSession] Concurrent resume of recently rotated key — ignoring', {
        userId: record.userId,
      });
      return { ok: false, reason: 'already_rotated' };
    }
    logger.warn('[DeviceSession] Rotated device key reused — revoking all keys for user', {
      userId: record.userId,
    });
    await prisma.refreshToken.deleteMany({ where: { userId: record.userId } });
    return { ok: false, reason: 'reused' };
  }

  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {});
    return { ok: false, reason: 'expired' };
  }

  const { user } = record;
  if (!user.clerkUserId || user.isBanned || user.isDeleted || user.deletionRequestedAt) {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    return { ok: false, reason: 'user_unavailable' };
  }

  let ticket: string;
  try {
    const signInToken = await clerkClient.signInTokens.createSignInToken({
      userId: user.clerkUserId,
      expiresInSeconds: SIGN_IN_TICKET_TTL_SECONDS,
    });
    ticket = signInToken.token;
  } catch (error: any) {
    const status = error?.status ?? error?.errors?.[0]?.status;
    if (status === 404 || status === 403 || status === 422) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      return { ok: false, reason: 'user_unavailable' };
    }
    throw error;
  }

  const deviceKey = generateRawKey();
  const expiresAt = new Date(Date.now() + DEVICE_KEY_TTL_MS);
  const claimedAt = new Date();

  // Atomic claim: only one concurrent winner rotates this row.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: record.id, isRevoked: false },
    data: { isRevoked: true, lastUsedAt: claimedAt },
  });

  if (claimed.count === 0) {
    logger.info('[DeviceSession] Lost rotation race after ticket issue — ignoring', {
      userId: user.id,
    });
    return { ok: false, reason: 'already_rotated' };
  }

  try {
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { expiresAt: { lt: new Date() } },
            {
              isRevoked: true,
              lastUsedAt: { lt: new Date(Date.now() - REVOKED_KEY_RETENTION_MS) },
              NOT: { id: record.id },
            },
          ],
        },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: hashKey(deviceKey),
          expiresAt,
          ...trimMeta({ ...meta, deviceInfo: meta.deviceInfo ?? record.deviceInfo }),
        },
      }),
    ]);
  } catch (error) {
    // Claim succeeded but we failed to persist the replacement key — restore
    // the claimed row so the client can retry with the same device key.
    logger.error('[DeviceSession] Failed to persist rotated key — restoring claim', {
      userId: user.id,
      error,
    });
    await prisma.refreshToken
      .update({
        where: { id: record.id },
        data: { isRevoked: false, lastUsedAt: record.lastUsedAt },
      })
      .catch(() => {});
    throw error;
  }

  return { ok: true, ticket, deviceKey, expiresAt };
}

export async function revokeDeviceKey(rawKey: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: hashKey(rawKey) } });
}
