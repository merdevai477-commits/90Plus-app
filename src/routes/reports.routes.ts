import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { strictLimiter } from '../middleware/rateLimit.middleware';
import { ErrorCode, sendError } from '../constants/errors';
import { notifyUser } from '../services/notify.service';
import { NotificationType } from '../services/notification.service';

const router = Router();

// Helper function to ensure param is string
const ensureString = (param: string | string[] | undefined): string => {
    if (Array.isArray(param)) return param[0];
    return param || '';
};

// POST /api/reports/reel/:reelId
router.post('/reel/:reelId', requireAuth, strictLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reelId } = req.params;
    const reelIdStr = ensureString(reelId);
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    // Get reel owner
    const reel = await prisma.reel.findUnique({
      where: { id: reelIdStr },
      select: { userId: true },
    });

    if (!reel) { sendError(req, res, ErrorCode.NOT_FOUND, 'Reel not found'); return; }

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
    // Duplicate detection: allow re-report after 24 hours only
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        reportedReelId: reelIdStr,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: { id: true },
    });
    if (existing) {
      sendError(req, res, ErrorCode.CONFLICT, 'You have already reported this content recently.');
      return;
    }

    const createdReport = await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedReelId: reelIdStr,
        reportedUserId: reel.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
      select: { id: true },
    });

    logger.info(`User ${user.id} reported reel ${reelIdStr} for: ${reason}`);

    // Acknowledge the reporter — inbox + push + WebSocket, localized.
    // Idempotency is keyed off the report id so a retried POST cannot double-notify.
    notifyUser({
      userId: user.id,
      type: NotificationType.REPORT_SUBMITTED,
      titleKey: 'reportSubmittedTitle',
      bodyKey: 'reportSubmittedBody',
      data: {
        screen: '/(tabs)/reels',
        reportId: createdReport.id,
        reportedReelId: reelIdStr,
        contentType: 'reel',
      },
      idempotencyKey: `report-submitted:${createdReport.id}`,
    }).catch((err) => logger.warn('[report/reel] reporter notify failed:', err?.message));

    res.json({ status: 'SUCCESS', message: 'Report submitted successfully' });
  } catch (error: any) {
    logger.error('Report reel error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

// POST /api/reports/comment/:commentId
router.post('/comment/:commentId', requireAuth, strictLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const commentIdStr = ensureString(commentId);
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    // Get comment owner
    const comment = await prisma.comment.findUnique({
      where: { id: commentIdStr },
      select: { userId: true },
    });

    if (!comment) { sendError(req, res, ErrorCode.NOT_FOUND, 'Comment not found'); return; }

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

    // Duplicate detection: allow re-report after 24 hours only
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        reportedCommentId: commentIdStr,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: { id: true },
    });
    if (existing) {
      sendError(req, res, ErrorCode.CONFLICT, 'You have already reported this content recently.');
      return;
    }

    const createdReport = await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedCommentId: commentIdStr,
        reportedUserId: comment.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
      select: { id: true },
    });

    logger.info(`User ${user.id} reported comment ${commentIdStr} for: ${reason}`);

    notifyUser({
      userId: user.id,
      type: NotificationType.REPORT_SUBMITTED,
      titleKey: 'reportCommentSubmittedTitle',
      bodyKey: 'reportCommentSubmittedBody',
      data: {
        screen: '/(tabs)/reels',
        reportId: createdReport.id,
        reportedCommentId: commentIdStr,
        contentType: 'comment',
      },
      idempotencyKey: `report-submitted:${createdReport.id}`,
    }).catch((err) => logger.warn('[report/comment] reporter notify failed:', err?.message));

    res.json({ status: 'SUCCESS', message: 'Report submitted successfully' });
  } catch (error: any) {
    logger.error('Report comment error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

// POST /api/reports/user/:userId
router.post('/user/:userId', requireAuth, strictLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = ensureString(req.params.userId);
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    if (!reason || String(reason).trim().length === 0) {
      sendError(req, res, ErrorCode.VALIDATION, 'Report reason is required');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

    if (user.id === targetUserId) {
      sendError(req, res, ErrorCode.VALIDATION, 'Cannot report yourself');
      return;
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!target) { sendError(req, res, ErrorCode.NOT_FOUND, 'Target user not found'); return; }

    // Duplicate detection: allow re-report after 24 hours only
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        reportedUserId: targetUserId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: { id: true },
    });
    if (existing) {
      sendError(req, res, ErrorCode.CONFLICT, 'You have already reported this content recently.');
      return;
    }

    const reasonToType: Record<string, string> = {
      spam: 'SPAM',
      harassment: 'HARASSMENT',
      inappropriate: 'INAPPROPRIATE',
      fake: 'HARASSMENT',
      other: 'OTHER',
    };

    const reportType = reasonToType[reason] || 'OTHER';

    const createdUserReport = await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedUserId: targetUserId,
        type: reportType as any,
        reason: (additionalInfo || reason).trim(),
        status: 'PENDING',
      },
      select: { id: true },
    });

    logger.info(`User ${user.id} reported user ${targetUserId} for: ${reason}`);

    notifyUser({
      userId: user.id,
      type: NotificationType.REPORT_SUBMITTED,
      titleKey: 'reportSubmittedTitle',
      bodyKey: 'reportSubmittedBody',
      data: {
        screen: '/(tabs)/profile',
        reportId: createdUserReport.id,
        reportedUserId: targetUserId,
        contentType: 'user',
      },
      idempotencyKey: `report-submitted:${createdUserReport.id}`,
    }).catch((err) => logger.warn('[report/user] reporter notify failed:', err?.message));

    res.json({ status: 'SUCCESS', message: 'Report submitted successfully' });
  } catch (error: any) {
    logger.error('Report user error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

// GET /api/reports/my-reports
router.get('/my-reports', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) { sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized'); return; }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) { sendError(req, res, ErrorCode.NOT_FOUND, 'User not found'); return; }

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

    res.json({ status: 'SUCCESS', reports: formattedReports });
  } catch (error: any) {
    logger.error('Get my reports error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Internal server error');
  }
});

export default router;
