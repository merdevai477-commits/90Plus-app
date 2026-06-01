import prisma from '../lib/prisma';
import { ClerkUserService } from '../services/clerk-user.service';
import { logger } from '../utils/logger';

/**
 * Resolve DB user for a Clerk id — auto-sync from Clerk on first API call
 * (covers iOS race where tabs mount before /clerk/me completes).
 */
export async function ensureBackendUser(clerkUserId: string) {
  const existing = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, coins: true, xp: true, level: true, settings: true, streakFreezes: true, lastActiveAt: true },
  });
  if (existing) return existing;

  logger.info('[ensureBackendUser] User missing in DB — syncing from Clerk', { clerkUserId });
  await ClerkUserService.syncUserFromClerk(clerkUserId);

  const synced = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, coins: true, xp: true, level: true, settings: true, streakFreezes: true, lastActiveAt: true },
  });
  if (!synced) throw new Error('USER_NOT_FOUND');
  return synced;
}

/** Lighter lookup — id only */
export async function ensureBackendUserId(clerkUserId: string): Promise<string> {
  const user = await ensureBackendUser(clerkUserId);
  return user.id;
}
