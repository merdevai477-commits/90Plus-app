import { Router, Request, Response } from 'express';
import { TermsService } from '../services/terms.service';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';

const router = Router();

/**
 * GET /api/terms/latest
 * Get the latest terms of service
 */
router.get('/latest', async (req: Request, res: Response): Promise<void> => {
  try {
    const terms = await TermsService.getLatestTerms();
    res.json({ status: 'SUCCESS', data: terms });
  } catch (error: any) {
    logger.error('Get latest terms error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to get terms');
  }
});

/**
 * POST /api/terms/accept
 * Record user acceptance of terms
 */
router.post('/accept', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    const { version } = req.body;

    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    if (!version) {
      sendError(req, res, ErrorCode.VALIDATION, 'Version is required');
      return;
    }

    // Get user from database
    const user = await require('../lib/prisma').default.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }

    // Get IP address and user agent
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;
    const userAgent = req.headers['user-agent'];

    // Record acceptance
    await TermsService.recordAcceptance(user.id, version, ipAddress, userAgent);

    res.json({ status: 'SUCCESS', message: 'Terms accepted successfully' });
  } catch (error: any) {
    logger.error('Accept terms error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to accept terms');
  }
});

/**
 * GET /api/terms/user-acceptance
 * Get user's terms acceptance history
 */
router.get('/user-acceptance', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    // Get user from database
    const user = await require('../lib/prisma').default.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }

    const acceptances = await TermsService.getUserAcceptanceHistory(user.id);

    res.json({
      status: 'SUCCESS',
      data: {
        acceptances,
        currentVersion: TermsService.getCurrentVersion(),
        hasAcceptedLatest: await TermsService.hasAcceptedLatestTerms(user.id),
      },
    });
  } catch (error: any) {
    logger.error('Get user acceptance error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to get acceptance history');
  }
});

export default router;
