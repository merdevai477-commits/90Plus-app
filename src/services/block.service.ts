import prisma from '../lib/prisma';

export interface BlockRelation {
  blockedByMe: boolean;
  blockedMe: boolean;
}

/**
 * Returns whether viewer blocked target and/or target blocked viewer.
 * Safe when blocks table is missing (returns false/false).
 */
export async function getBlockRelation(
  viewerUserId: string,
  targetUserId: string,
): Promise<BlockRelation> {
  if (!viewerUserId || !targetUserId || viewerUserId === targetUserId) {
    return { blockedByMe: false, blockedMe: false };
  }

  try {
    const rows = await prisma.$queryRaw<{ blockerId: string; blockedId: string }[]>`
      SELECT "blockerId", "blockedId"
      FROM blocks
      WHERE ("blockerId" = ${viewerUserId} AND "blockedId" = ${targetUserId})
         OR ("blockerId" = ${targetUserId} AND "blockedId" = ${viewerUserId})
    `;

    let blockedByMe = false;
    let blockedMe = false;
    for (const row of rows) {
      if (row.blockerId === viewerUserId && row.blockedId === targetUserId) {
        blockedByMe = true;
      }
      if (row.blockerId === targetUserId && row.blockedId === viewerUserId) {
        blockedMe = true;
      }
    }
    return { blockedByMe, blockedMe };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === '42P01') {
      return { blockedByMe: false, blockedMe: false };
    }
    throw error;
  }
}
