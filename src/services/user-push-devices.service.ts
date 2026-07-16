/**
 * Multi-device Expo push tokens.
 * User.expoPushToken remains the "latest" token for backwards compatibility.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const MAX_DEVICES_PER_USER = 8;

export async function registerUserPushDevice(params: {
  userId: string;
  token: string;
  platform?: string;
}): Promise<void> {
  const platform = (params.platform || 'unknown').toLowerCase().slice(0, 32);

  // Token may have belonged to another account (reinstall / shared device).
  await prisma.userPushDevice.deleteMany({
    where: {
      token: params.token,
      NOT: { userId: params.userId },
    },
  });

  await prisma.userPushDevice.upsert({
    where: { token: params.token },
    create: {
      userId: params.userId,
      token: params.token,
      platform,
    },
    update: {
      userId: params.userId,
      platform,
      updatedAt: new Date(),
    },
  });

  // Cap devices per user (keep most recently updated).
  const devices = await prisma.userPushDevice.findMany({
    where: { userId: params.userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
  if (devices.length > MAX_DEVICES_PER_USER) {
    const dropIds = devices.slice(MAX_DEVICES_PER_USER).map((d) => d.id);
    await prisma.userPushDevice.deleteMany({ where: { id: { in: dropIds } } });
  }
}

/**
 * All active Expo tokens for a user (devices table + legacy User.expoPushToken).
 */
export async function getUserPushTokens(userId: string): Promise<string[]> {
  const [devices, user] = await Promise.all([
    prisma.userPushDevice.findMany({
      where: { userId },
      select: { token: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    }),
  ]);

  const tokens = new Set<string>();
  for (const d of devices) {
    if (d.token?.trim()) tokens.add(d.token.trim());
  }
  const legacy = user?.expoPushToken?.trim();
  if (legacy) tokens.add(legacy);
  return [...tokens];
}

export async function removePushTokenEverywhere(token: string): Promise<void> {
  try {
    await Promise.all([
      prisma.userPushDevice.deleteMany({ where: { token } }),
      prisma.user.updateMany({
        where: { expoPushToken: token },
        data: { expoPushToken: null },
      }),
    ]);
    logger.info(`Cleared invalid push token (${token.substring(0, 20)}...)`);
  } catch (err) {
    logger.warn('Failed to clear invalid push token:', err);
  }
}

/** One-time backfill: copy legacy User.expoPushToken rows into user_push_devices. */
export async function backfillLegacyPushTokens(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { expoPushToken: { not: null } },
    select: { id: true, expoPushToken: true },
  });
  let n = 0;
  for (const u of users) {
    const token = u.expoPushToken?.trim();
    if (!token) continue;
    try {
      await registerUserPushDevice({ userId: u.id, token, platform: 'legacy' });
      n += 1;
    } catch {
      /* unique race — ignore */
    }
  }
  return n;
}
