/**
 * XP Routes
 * Public and authenticated endpoints for XP/level data.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { responseCacheMiddleware } from '../middleware/responseCache.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';
import { xpForLevel, xpForNextLevel, levelFromXp, levelTitle, grantStreakFreeze, getAppShareStatus, awardAppShare } from '../services/xp.service';
import { addSseConnection, removeSseConnection } from '../services/xp-sse.service';

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
      select: { id: true, xp: true, level: true, streakFreezes: true, lastActiveAt: true },
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

    // Rest period: inactive for 14+ days
    const REST_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;
    const isResting = user.lastActiveAt
      ? (Date.now() - new Date(user.lastActiveAt).getTime()) > REST_THRESHOLD_MS
      : false;
    const restingSince = isResting ? user.lastActiveAt : null;

    res.json({
      status: 'SUCCESS',
      data: {
        xp,
        level,
        title: levelTitle(level),
        xpToNext,                       // remaining XP to reach the next level
        currentLevelXp,                 // absolute XP threshold of the current level
        nextLevelXp,                    // absolute XP threshold of the next level
        xpInLevel: Math.max(0, xp - currentLevelXp),     // XP earned inside the current level
        xpForNextLevel: nextLevelXp - currentLevelXp,    // XP span between current and next level
        progressPct,
        streakFreezes: user.streakFreezes,
        isResting,
        restingSince,
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
      select: { xp: true, level: true, lastActiveAt: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    const REST_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;
    const isResting = user.lastActiveAt
      ? (Date.now() - new Date(user.lastActiveAt).getTime()) > REST_THRESHOLD_MS
      : false;

    res.json({
      status: 'SUCCESS',
      data: {
        xp: user.xp,
        level: user.level,
        title: levelTitle(user.level),
        isResting,
        restingSince: isResting ? user.lastActiveAt : null,
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

/**
 * GET /api/xp/stream
 * Server-Sent Events stream for real-time XP updates.
 */
router.get('/stream', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const clerkUserId = req.auth?.userId;
  if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Register connection
  addSseConnection(user.id, res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeSseConnection(user.id, res);
  });
});

/**
 * GET /api/xp/app-share/status
 * Whether the user can claim share-app XP (10 XP / 24h).
 */
router.get('/app-share/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    const user = await prisma.user.findFirst({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    const status = await getAppShareStatus(user.id);
    res.json({ status: 'SUCCESS', data: status });
  } catch (error: unknown) {
    logger.error('GET /api/xp/app-share/status error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * POST /api/xp/app-share/claim
 * Award 10 XP after the user completes a native share sheet.
 */
router.post('/app-share/claim', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    const user = await prisma.user.findFirst({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    const tz = (req.headers['x-user-timezone'] as string) || 'UTC';
    const result = await awardAppShare(user.id, tz);
    const status = await getAppShareStatus(user.id);

    const xpEvents =
      result.awarded > 0
        ? [{
            action: 'APP_SHARE',
            amount: result.awarded,
            leveledUp: result.leveledUp,
            newLevel: result.newLevel,
            newTitle: result.leveledUp ? levelTitle(result.newLevel) : undefined,
          }]
        : [];

    res.json({
      status: 'SUCCESS',
      data: {
        awarded: result.awarded,
        reason: result.reason,
        xpEvents,
        nextEligibleAt: status.nextEligibleAt,
        rewardXp: status.rewardXp,
      },
    });
  } catch (error: unknown) {
    logger.error('POST /api/xp/app-share/claim error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * POST /api/xp/streak-freeze/grant
 * Admin-only: grant streak freeze items to a user
 */
router.post('/streak-freeze/grant', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, amount } = req.body;

    if (!userId || typeof userId !== 'string') {
      sendError(req, res, ErrorCode.VALIDATION, 'userId is required');
      return;
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      sendError(req, res, ErrorCode.VALIDATION, 'amount must be a positive number');
      return;
    }

    const result = await grantStreakFreeze(userId, amount);

    res.json({
      status: 'SUCCESS',
      data: result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    logger.error('POST /api/xp/streak-freeze/grant error:', error);
    sendError(req, res, ErrorCode.INTERNAL, msg);
  }
});

export default router;
