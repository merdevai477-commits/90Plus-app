import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { enqueueNotification } from '../queues/notification.queue';
import { ErrorCode, sendError } from '../constants/errors';
import { sanitizeTimezone, nextMidnightInTimezone } from '../utils/chat-timezone';

const router = Router();
function getRequestTimezone(req: Request): string {
  return sanitizeTimezone(req.headers['x-user-timezone']);
}

// Spin wheel prizes with probabilities
// Spin wheel prizes with probabilities (Total exactly 100%)
const SPIN_PRIZES = [
  { index: 0, coins: 5, probability: 35, label: '5', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { index: 1, coins: 10, probability: 25, label: '10', colorLight: '#7C3AED', colorDark: '#5B21B6' },
  { index: 2, coins: 25, probability: 20, label: '25', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { index: 3, coins: 50, probability: 8.9, label: '50', colorLight: '#7C3AED', colorDark: '#5B21B6' },
  { index: 4, coins: 100, probability: 1, label: '100', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { index: 5, coins: 200, probability: 0.1, label: '200', colorLight: '#7C3AED', colorDark: '#5B21B6' },
  { index: 6, coins: 5, probability: 6, label: '5', colorLight: '#8B5CF6', colorDark: '#6D28D9' },
  { index: 7, coins: 10, probability: 4, label: '10', colorLight: '#7C3AED', colorDark: '#5B21B6' },
] as const;

type SpinPrize = (typeof SPIN_PRIZES)[number];

// Helper function to select prize based on probability
function selectPrize(): SpinPrize {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const prize of SPIN_PRIZES) {
    cumulative += prize.probability;
    if (random <= cumulative) {
      return prize;
    }
  }
  
  // Fallback to first prize
  return SPIN_PRIZES[0];
}

function getStartOfTodayInTimezone(timezone: string, now: Date = new Date()): Date {
  return nextMidnightInTimezone(timezone, new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

// Check if the user is eligible to spin again for the current day in their timezone.
function canSpinToday(lastSpin: Date | null, timezone = 'UTC'): boolean {
  if (!lastSpin) return true;

  const now = new Date();
  const startOfToday = getStartOfTodayInTimezone(timezone, now);
  return lastSpin < startOfToday;
}

// Get time remaining until the next daily spin window in the user's timezone.
function getTimeUntilNextSpin(lastSpin: Date | null, timezone = 'UTC'): { hours: number; minutes: number } {
  if (!lastSpin) return { hours: 0, minutes: 0 };

  const now = new Date();
  const nextSpinTime = nextMidnightInTimezone(timezone, now);
  const msRemaining = nextSpinTime.getTime() - now.getTime();

  if (msRemaining <= 0) return { hours: 0, minutes: 0 };

  const hours = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes };
}

/**
 * GET /api/daily-spin/status
 * Check if user can spin today and get spin history
 */
router.get('/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, lastDailySpin: true, coins: true }
    });

    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    const timezone = getRequestTimezone(req);
    const canSpin = canSpinToday(user.lastDailySpin, timezone);
    const timeRemaining = getTimeUntilNextSpin(user.lastDailySpin, timezone);

    // Get last 7 days spin history
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const spinHistory = await prisma.dailySpinHistory.findMany({
      where: {
        userId: user.id,
        spinDate: { gte: weekAgo }
      },
      orderBy: { spinDate: 'desc' },
      take: 7
    });

    // Calculate total coins won this week
    const totalCoinsThisWeek = spinHistory.reduce((sum, spin) => sum + spin.coinsWon, 0);

    res.json({
      status: 'SUCCESS',
      data: {
        canSpin,
        timeRemaining,
        currentCoins: user.coins,
        lastSpin: user.lastDailySpin,
        spinHistory: spinHistory.map(s => ({
          coinsWon: s.coinsWon,
          date: s.spinDate
        })),
        totalCoinsThisWeek,
        prizes: SPIN_PRIZES.map(p => ({
          coins: p.coins,
          label: p.label,
          colorLight: p.colorLight,
          colorDark: p.colorDark
        }))
      }
    });
  } catch (error: any) {
    logger.error('Get spin status error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * POST /api/daily-spin/spin
 * Spin the wheel and get prize
 */
router.post('/spin', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, lastDailySpin: true, coins: true }
    });

    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }

    const now = new Date();
    const timezone = getRequestTimezone(req);
    const startOfToday = getStartOfTodayInTimezone(timezone, now);

    logger.info('[DailySpin] spin request', {
      userId: user.id,
      clerkUserId,
      timezone,
      now: now.toISOString(),
    });

    const result = await prisma.$transaction(async (tx) => {
      logger.debug('[DailySpin] spin eligibility check', {
        userId: user.id,
        timezone,
        lastDailySpin: user.lastDailySpin?.toISOString() ?? null,
        startOfToday: startOfToday.toISOString(),
      });

      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, lastDailySpin: true, coins: true },
      });

      if (!currentUser) {
        throw new Error('USER_NOT_FOUND');
      }

      if (!canSpinToday(currentUser.lastDailySpin, timezone)) {
        const timeRemaining = getTimeUntilNextSpin(currentUser.lastDailySpin, timezone);
        logger.info('[DailySpin] duplicate spin rejected', {
          userId: user.id,
          timezone,
          lastDailySpin: currentUser.lastDailySpin?.toISOString() ?? null,
        });
        return {
          status: 'cooldown' as const,
          timeRemaining,
        };
      }

      /*
       * The claim predicate MUST express the same rule as canSpinToday() above,
       * which is the rule /status reports to the app. It previously used a
       * rolling 24h cutoff (now - 24h) while canSpinToday() used the local
       * calendar day, so anyone whose last spin was earlier the previous day —
       * but less than 24h ago — was told `canSpin: true`, played the wheel
       * animation, and then had this claim match 0 rows: SPIN_COOLDOWN, no
       * coins, no footer change. Spinning at 20:00 broke the next 20 hours.
       * One rule, stated once, enforced here atomically.
       */
      const claimed = await tx.user.updateMany({
        where: {
          id: user.id,
          OR: [{ lastDailySpin: null }, { lastDailySpin: { lt: startOfToday } }],
        },
        data: {
          coins: { increment: 0 },
          lastDailySpin: now,
        },
      });

      if (claimed.count !== 1) {
        const timeRemaining = getTimeUntilNextSpin(currentUser.lastDailySpin, timezone);
        logger.info('[DailySpin] spin claim lost to race', {
          userId: user.id,
          timezone,
          claimedCount: claimed.count,
        });
        return {
          status: 'cooldown' as const,
          timeRemaining,
        };
      }

      const prize = selectPrize();
      logger.debug('[DailySpin] generated reward', {
        userId: user.id,
        timezone,
        rewardPoints: prize.coins,
        previousBalance: currentUser.coins,
      });

      const [updatedUser, rewardRecord] = await Promise.all([
        tx.user.update({
          where: { id: user.id },
          data: {
            coins: { increment: prize.coins },
            lastDailySpin: now,
          },
          select: { coins: true },
        }),
        tx.dailySpinHistory.create({
          data: {
            userId: user.id,
            coinsWon: prize.coins,
            spinDate: now,
          },
        }),
        tx.coinTransaction.create({
          data: {
            userId: user.id,
            amount: prize.coins,
            type: 'DAILY_LOGIN',
            description: `عجلة الحظ اليومية - ربحت ${prize.coins} كوين`,
          },
        }),
      ]);

      logger.info('[DailySpin] reward persisted', {
        userId: user.id,
        timezone,
        rewardPoints: prize.coins,
        previousBalance: currentUser.coins,
        balanceAfterUpdate: updatedUser.coins,
        rewardRecordId: rewardRecord.id,
      });

      return {
        status: 'ok' as const,
        prize,
        updatedUser,
        now,
        rewardRecordId: rewardRecord.id,
      };
    });

    if (result.status === 'cooldown') {
      const timeRemaining = result.timeRemaining;
      sendError(req, res, ErrorCode.RATE_LIMIT, `يمكنك اللف مرة أخرى بعد ${timeRemaining.hours} ساعة و ${timeRemaining.minutes} دقيقة`, { code: 'SPIN_COOLDOWN', timeRemaining });
      return;
    }

    const prize = result.prize;
    const updatedUser = result.updatedUser;
    const rewardRecordId = result.rewardRecordId;

    // Create notification for the win
    await enqueueNotification({
      userId: user.id,
      title: '🎉 مبروك!',
      message: `ربحت ${prize.coins} كوين من عجلة الحظ اليومية!`,
      type: 'GIFT',
      data: { type: 'GIFT', coinsWon: prize.coins, spinDate: now.toISOString(), screen: '/(tabs)/profile', tab: 'wallet' },
    });

    // Check coin milestone
    const COIN_MILESTONES = [100, 500, 1000, 5000, 10000];
    const oldBalance = user.coins;
    const newBalance = updatedUser.coins;
    const hitMilestone = COIN_MILESTONES.find(m => newBalance >= m && oldBalance < m);
    if (hitMilestone) {
      await enqueueNotification({
        userId: user.id,
        title: '🪙 إنجاز جديد!',
        message: `وصلت لـ ${hitMilestone.toLocaleString()} عملة! استمر 💪`,
        type: 'COIN_MILESTONE',
        data: { type: 'COIN_MILESTONE', milestone: hitMilestone, screen: '/(tabs)/profile', tab: 'wallet' },
      });
    }

    logger.info('[DailySpin] response sent', {
      userId: user.id,
      rewardRecordId,
      rewardPoints: prize.coins,
      newBalance: updatedUser.coins,
      timezone,
    });

    res.json({
      status: 'SUCCESS',
      data: {
        prize: {
          prizeIndex: prize.index,
          coins: prize.coins,
          label: prize.label,
          colorLight: prize.colorLight,
          colorDark: prize.colorDark
        },
        newBalance: updatedUser.coins,
        nextSpinTime: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      },
      message: `مبروك! ربحت ${prize.coins} كوين 🎉`
    });
  } catch (error: any) {
    logger.error('[DailySpin] transaction rollback', {
      clerkUserId: req.auth?.userId,
      error: error?.message ?? error,
    });
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

/**
 * GET /api/daily-spin/history
 * Get user's spin history
 */
router.get('/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }

    const { limit = '30' } = req.query;

    const history = await prisma.dailySpinHistory.findMany({
      where: { userId: user.id },
      orderBy: { spinDate: 'desc' },
      take: Math.min(parseInt(limit as string), 100)
    });

    const totalCoinsWon = await prisma.dailySpinHistory.aggregate({
      where: { userId: user.id },
      _sum: { coinsWon: true }
    });

    res.json({
      status: 'SUCCESS',
      data: {
        history: history.map(h => ({
          coinsWon: h.coinsWon,
          date: h.spinDate
        })),
        totalCoinsWon: totalCoinsWon._sum.coinsWon || 0,
        totalSpins: history.length
      }
    });
  } catch (error: any) {
    logger.error('Get spin history error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

export default router;
