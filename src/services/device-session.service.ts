import crypto from 'crypto';
import { clerkClient } from '@clerk/express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Long-lived per-device keys that let the app silently restore a Clerk session
 * after Clerk's fixed 7-day maximum session lifetime (Hobby plan) ends it.
 *
 * Only a SHA-256 hash of the key is stored. Keys rotate on every resume; a
 * rotated key being presented again is treated as theft and revokes every key
 * the user has.
 */

const DEVICE_KEY_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SIGN_IN_TICKET_TTL_SECONDS = 5 * 60;
const MAX_ACTIVE_KEYS_PER_USER = 10;
/** Rotated keys are kept this long so a replayed old key can still be detected. */
const REVOKED_KEY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
  | { ok: false; reason: 'invalid' | 'expired' | 'reused' | 'user_unavailable' };

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

export async function resumeWithDeviceKey(rawKey: string, meta: DeviceKeyMeta): Promise<ResumeResult> {
  const record = await prisma.refreshToken.findUnique({
    where: { token: hashKey(rawKey) },
    include: {
      user: { select: { id: true, clerkUserId: true, isBanned: true, isDeleted: true, deletionRequestedAt: true } },
    },
  });

  if (!record) return { ok: false, reason: 'invalid' };

  if (record.isRevoked) {
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
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, lastUsedAt: { lt: new Date(Date.now() - REVOKED_KEY_RETENTION_MS) } },
        ],
      },
    }),
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { isRevoked: true, lastUsedAt: new Date() },
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

  return { ok: true, ticket, deviceKey, expiresAt };
}

export async function revokeDeviceKey(rawKey: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: hashKey(rawKey) } });
}
