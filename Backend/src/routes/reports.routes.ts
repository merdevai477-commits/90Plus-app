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

// GET /api/reports/my-reports
router.get('/my-reports', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
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

    // Get user's reports
    const reports = await prisma.report.findMany({
      where: {
        reporterId: user.id,
      },
      select: {
        id: true,
        type: true,
        reason: true,
        status: true,
        createdAt: true,
        reportedReelId: true,
        reportedCommentId: true,
        reportedUserId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to last 50 reports
    });

    // Format reports with content type
    const formattedReports = reports.map(report => ({
      id: report.id,
      type: report.type,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      contentType: report.reportedReelId 
        ? 'reel' 
        : report.reportedCommentId 
        ? 'comment' 
        : 'user',
      contentId: report.reportedReelId || report.reportedCommentId || report.reportedUserId || '',
    }));

    res.json({
      status: 'SUCCESS',
      reports: formattedReports,
    });
  } catch (error: any) {
    logger.error('Get my reports error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
