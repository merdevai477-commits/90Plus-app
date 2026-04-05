import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Helper function to ensure param is string
const ensureString = (param: string | string[] | undefined): string => {
    if (Array.isArray(param)) return param[0];
    return param || '';
};

// POST /api/reports/reel/:reelId
router.post('/reel/:reelId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reelId } = req.params;
    const reelIdStr = ensureString(reelId);
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
      where: { id: reelIdStr },
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
        reportedReelId: reelIdStr,
        reportedUserId: reel.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
    });

    logger.info(`User ${user.id} reported reel ${reelIdStr} for: ${reason}`);

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
    const commentIdStr = ensureString(commentId);
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
      where: { id: commentIdStr },
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
        reportedCommentId: commentIdStr,
        reportedUserId: comment.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
    });

    logger.info(`User ${user.id} reported comment ${commentIdStr} for: ${reason}`);

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

// POST /api/reports/user/:userId
router.post('/user/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const userIdStr = ensureString(userId);
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const reporter = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!reporter) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
      return;
    }

    // Prevent self-reporting
    if (reporter.id === userIdStr) {
      res.status(400).json({ status: 'ERROR', message: 'Cannot report yourself' });
      return;
    }

    const reportedUser = await prisma.user.findUnique({
      where: { id: userIdStr },
      select: { id: true },
    });

    if (!reportedUser) {
      res.status(404).json({ status: 'ERROR', message: 'Reported user not found' });
      return;
    }

    // Check for duplicate report
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: reporter.id,
        reportedUserId: userIdStr,
        reportedReelId: null,
        reportedCommentId: null,
      },
    });

    if (existing) {
      res.status(409).json({ status: 'ERROR', message: 'You have already reported this user' });
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
        reporterId: reporter.id,
        reportedUserId: userIdStr,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
    });

    logger.info(`User ${reporter.id} reported user ${userIdStr} for: ${reason}`);

    res.json({
      status: 'SUCCESS',
      message: 'Report submitted successfully',
    });
  } catch (error: any) {
    logger.error('Report user error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
