import { Router } from 'express';
import { requireAuth as clerkMiddleware } from '../middleware/clerk.middleware';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/eula/accept
 * Accept EULA/Terms of Use
 * Required for Apple UGC Compliance (Guideline 1.2)
 */
router.post('/accept', clerkMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { version = '1.0' } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'E002',
        message: 'Authentication required',
      });
    }

    // Update user's EULA acceptance
    const user = await prisma.user.update({
      where: { clerkUserId: userId },
      data: {
        eulaAccepted: true,
        eulaAcceptedAt: new Date(),
        eulaVersion: version,
      },
      select: {
        id: true,
        username: true,
        eulaAccepted: true,
        eulaAcceptedAt: true,
        eulaVersion: true,
      },
    });

    logger.info(`User ${user.username} accepted EULA v${version}`);

    return res.status(200).json({
      success: true,
      message: 'EULA accepted successfully',
      data: {
        eulaAccepted: user.eulaAccepted,
        eulaAcceptedAt: user.eulaAcceptedAt,
        eulaVersion: user.eulaVersion,
      },
    });
  } catch (error: any) {
    logger.error('Failed to accept EULA:', error);
    return res.status(500).json({
      error: 'E010',
      message: 'Failed to accept EULA',
      details: error.message,
    });
  }
});

/**
 * GET /api/eula/status
 * Check if user has accepted EULA
 */
router.get('/status', clerkMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'E002',
        message: 'Authentication required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        eulaAccepted: true,
        eulaAcceptedAt: true,
        eulaVersion: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'E004',
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        eulaAccepted: user.eulaAccepted,
        eulaAcceptedAt: user.eulaAcceptedAt,
        eulaVersion: user.eulaVersion,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get EULA status:', error);
    return res.status(500).json({
      error: 'E010',
      message: 'Failed to get EULA status',
      details: error.message,
    });
  }
});

export default router;
