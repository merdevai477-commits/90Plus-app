import { verifyToken } from '@clerk/backend';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { ensureBackendUser } from '../../utils/ensureBackendUser';
import type { MatchChatSocketUser } from './match-chat.types';

export async function verifyClerkSocketToken(token: string): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey || !token) return null;
  try {
    const payload = await verifyToken(token, { secretKey });
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch (err) {
    logger.debug('[match-chat] Clerk token verify failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function loadMatchChatUser(clerkUserId: string): Promise<MatchChatSocketUser | null> {
  let row = await prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      favoriteTeam: true,
      isBanned: true,
      isSuspended: true,
      isDeleted: true,
      ageTier: true,
    },
  });

  if (!row) {
    await ensureBackendUser(clerkUserId);
    row = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        favoriteTeam: true,
        isBanned: true,
        isSuspended: true,
        isDeleted: true,
        ageTier: true,
      },
    });
  }

  if (!row || row.isDeleted || row.isBanned || row.isSuspended) return null;
  if (row.ageTier === 'BLOCKED') return null;

  return {
    userId: row.id,
    clerkUserId,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    favoriteTeam: row.favoriteTeam,
  };
}
