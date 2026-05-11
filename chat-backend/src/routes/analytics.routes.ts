import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../services/logger.service.js';

export const analyticsRouter = Router();
const prisma = new PrismaClient();

analyticsRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Basic aggregation for dashboard
    const [totalSavings, totalHits] = await Promise.all([
      prisma.analytics.aggregate({ _sum: { costSaved: true } }),
      prisma.analytics.count()
    ]);

    const cacheHits = await prisma.analytics.count({ where: { fromCache: true } });
    const hitRate = totalHits > 0 ? (cacheHits / totalHits) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalCostSaved: totalSavings._sum.costSaved || 0,
        totalRequests: totalHits,
        cacheHitRate: hitRate.toFixed(2) + '%',
      }
    });
  } catch (error) {
    logger.error('❌ Failed to fetch analytics', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});
