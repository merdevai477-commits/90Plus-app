import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/reports/reel/:reelId
router.post('/reel/:reelId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reelId } = req.params;
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
      return;
    }

    // Get reel owner
    const reel = await prisma.reel.findUnique({
      where: { id: reelId },
      select: { userId: true },
    });

    if (!reel) {
      res.status(404).json({ status: 'ERROR', message: 'Reel not found' });
      return;
    }

    // Map reason to ReportType
    const reasonToType: Record<string, string> = {
      'spam': 'SPAM',
      'harassment': 'HARASSMENT',
      'inappropriate': 'INAPPROPRIATE',
      'violence': 'INAPPROPRIATE',
      'hate': 'HARASSMENT',
      'copyright': 'COPYRIGHT',
      'other': 'OTHER',
    };

    const reportType = reasonToType[reason] || 'OTHER';

    // Create report
    await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedReelId: reelId,
        reportedUserId: reel.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
    });

    logger.info(`User ${user.id} reported reel ${reelId} for: ${reason}`);

    res.json({
      status: 'SUCCESS',
      message: 'Report submitted successfully',
    });
  } catch (error: any) {
    logger.error('Report reel error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Internal server error',
    });
  }
});

// POST /api/reports/comment/:commentId
router.post('/comment/:commentId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
      return;
    }

    // Get comment owner
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      res.status(404).json({ status: 'ERROR', message: 'Comment not found' });
      return;
    }

    const reasonToType: Record<string, string> = {
      'spam': 'SPAM',
      'harassment': 'HARASSMENT',
      'inappropriate': 'INAPPROPRIATE',
      'violence': 'INAPPROPRIATE',
      'hate': 'HARASSMENT',
      'copyright': 'COPYRIGHT',
      'other': 'OTHER',
    };

    const reportType = reasonToType[reason] || 'OTHER';

    await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedCommentId: commentId,
        reportedUserId: comment.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
    });

    logger.info(`User ${user.id} reported comment ${commentId} for: ${reason}`);

    res.json({
      status: 'SUCCESS',
      message: 'Report submitted successfully',
    });
  } catch (error: any) {
    logger.error('Report comment error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
