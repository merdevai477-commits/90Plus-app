import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Spin wheel prizes with probabilities
const SPIN_PRIZES = [
  { coins: 5, probability: 50, label: '5 كوين', color: '#32cd32' },
  { coins: 10, probability: 35, label: '10 كوين', color: '#00bfff' },
  { coins: 25, probability: 10, label: '25 كوين', color: '#9b59b6' },
  { coins: 50, probability: 4.5, label: '50 كوين', color: '#f39c12' },
  { coins: 200, probability: 0.5, label: '200 كوين', color: '#e74c3c' },
];

// Helper function to select prize based on probability
function selectPrize(): typeof SPIN_PRIZES[0] {
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

// Check if 24 hours have passed since last spin
function canSpinToday(lastSpin: Date | null): boolean {
  if (!lastSpin) return true;
  
  const now = new Date();
  const lastSpinDate = new Date(lastSpin);
  const hoursSinceLastSpin = (now.getTime() - lastSpinDate.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceLastSpin >= 24;
}

// Get time remaining until next spin
function getTimeUntilNextSpin(lastSpin: Date | null): { hours: number; minutes: number } {
  if (!lastSpin) return { hours: 0, minutes: 0 };
  
  const now = new Date();
  const lastSpinDate = new Date(lastSpin);
  const nextSpinTime = new Date(lastSpinDate.getTime() + 24 * 60 * 60 * 1000);
  
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
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, lastDailySpin: true, coins: true }
    });

    if (!user) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
      return;
    }

    const canSpin = canSpinToday(user.lastDailySpin);
    const timeRemaining = getTimeUntilNextSpin(user.lastDailySpin);

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
          color: p.color
        }))
      }
    });
  } catch (error: any) {
    logger.error('Get spin status error:', error);
    res.status(500).json({ status: 'ERROR', message: error.message });
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
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, lastDailySpin: true, coins: true }
    });

    if (!user) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
      return;
    }

    // Check if user can spin
    if (!canSpinToday(user.lastDailySpin)) {
      const timeRemaining = getTimeUntilNextSpin(user.lastDailySpin);
      res.status(429).json({
        status: 'ERROR',
        message: `يمكنك اللف مرة أخرى بعد ${timeRemaining.hours} ساعة و ${timeRemaining.minutes} دقيقة`,
        code: 'SPIN_COOLDOWN',
        timeRemaining
      });
      return;
    }

    // Select prize
    const prize = selectPrize();
    const now = new Date();

    // Update user coins and last spin time, create history record
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          coins: { increment: prize.coins },
          lastDailySpin: now
        },
        select: { coins: true }
      }),
      prisma.dailySpinHistory.create({
        data: {
          userId: user.id,
          coinsWon: prize.coins,
          spinDate: now
        }
      }),
      prisma.coinTransaction.create({
        data: {
          userId: user.id,
          amount: prize.coins,
          type: 'DAILY_LOGIN',
          description: `عجلة الحظ اليومية - ربحت ${prize.coins} كوين`
        }
      })
    ]);

    // Create notification for the win
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: '🎉 مبروك!',
        message: `ربحت ${prize.coins} كوين من عجلة الحظ اليومية!`,
        type: 'GENERAL',
        data: { coinsWon: prize.coins, spinDate: now.toISOString() }
      }
    });

    res.json({
      status: 'SUCCESS',
      data: {
        prize: {
          coins: prize.coins,
          label: prize.label,
          color: prize.color
        },
        newBalance: updatedUser.coins,
        nextSpinTime: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      },
      message: `مبروك! ربحت ${prize.coins} كوين 🎉`
    });
  } catch (error: any) {
    logger.error('Spin wheel error:', error);
    res.status(500).json({ status: 'ERROR', message: error.message });
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
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

export default router;
