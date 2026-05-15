/**
 * XP Routes
 * Public and authenticated endpoints for XP/level data.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { responseCacheMiddleware } from '../middleware/responseCache.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';
import { xpForLevel, xpForNextLevel, levelFromXp, levelTitle } from '../services/xp.service';

const router = Router();

/**
 * GET /api/xp/me
 * Current user's XP, level, title, progress, streak
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    const user = await prisma.user.findFirst({
      where: { clerkUserId },
      select: { id: true, xp: true, level: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    const streak = await prisma.loginStreak.findUnique({ where: { userId: user.id } });

    const level = user.level;
    const xp = user.xp;
    const nextLevelXp = xpForLevel(level + 1);
    const currentLevelXp = xpForLevel(level);
    const xpToNext = nextLevelXp - xp;
    const progressPct = nextLevelXp > currentLevelXp
      ? Math.min(100, Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100))
      : 100;

    res.json({
      status: 'SUCCESS',
      data: {
        xp,
        level,
        title: levelTitle(level),
        xpToNext,
        progressPct,
        streak: {
          current: streak?.current ?? 0,
          longest: streak?.longest ?? 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('GET /api/xp/me error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * GET /api/xp/users/:userId
 * Public XP/level for any user (no caps, no history exposed)
 */
router.get('/users/:userId', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const userIdStr = Array.isArray(userId) ? userId[0] : userId;

    const user = await prisma.user.findUnique({
      where: { id: userIdStr },
      select: { xp: true, level: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    res.json({
      status: 'SUCCESS',
      data: {
        xp: user.xp,
        level: user.level,
        title: levelTitle(user.level),
      },
    });
  } catch (error: any) {
    logger.error('GET /api/xp/users/:userId error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * GET /api/xp/me/history
 * Transaction history for current user
 */
router.get('/me/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    const user = await prisma.user.findFirst({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const transactions = await prisma.xpTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        action: true,
        amount: true,
        createdAt: true,
        metadata: true,
      },
    });

    res.json({
      status: 'SUCCESS',
      data: { transactions },
    });
  } catch (error: any) {
    logger.error('GET /api/xp/me/history error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * GET /api/xp/curve
 * Level curve data (cached 1h)
 */
router.get('/curve', responseCacheMiddleware({ ttl: 60 * 60 * 1000 }), async (_req: Request, res: Response): Promise<void> => {
  const levels = [];
  for (let i = 1; i <= 50; i++) {
    levels.push({ level: i, xpRequired: xpForLevel(i), title: levelTitle(i) });
  }

  res.json({
    status: 'SUCCESS',
    data: { levels },
  });
});

export default router;
