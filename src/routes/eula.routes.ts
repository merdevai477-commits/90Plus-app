/**
 * EULA Routes
 * Apple Compliance - Guideline 1.2
 * 
 * Handles End User License Agreement acceptance
 */

import { Router } from 'express';
import { clerkMiddleware } from '../middleware/clerk.middleware';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/eula/status
 * Check if user has accepted EULA
 */
router.get('/status', clerkMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;

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

    res.json({
      eulaAccepted: user.eulaAccepted,
      eulaAcceptedAt: user.eulaAcceptedAt,
      eulaVersion: user.eulaVersion,
      currentVersion: '1.0',
    });
  } catch (error: any) {
    logger.error('Error fetching EULA status:', error);
    res.status(500).json({
      error: 'E010',
      message: 'Failed to fetch EULA status',
    });
  }
});

/**
 * POST /api/eula/accept
 * Accept EULA
 */
router.post('/accept', clerkMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { version } = req.body;

    if (!version) {
      return res.status(400).json({
        error: 'E001',
        message: 'EULA version is required',
      });
    }

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

    logger.info('User accepted EULA', {
      userId,
      version,
      acceptedAt: user.eulaAcceptedAt,
    });

    res.json({
      message: 'EULA accepted successfully',
      user: {
        eulaAccepted: user.eulaAccepted,
        eulaAcceptedAt: user.eulaAcceptedAt,
        eulaVersion: user.eulaVersion,
      },
    });
  } catch (error: any) {
    logger.error('Error accepting EULA:', error);
    res.status(500).json({
      error: 'E010',
      message: 'Failed to accept EULA',
    });
  }
});

/**
 * GET /api/eula/content
 * Get EULA content
 */
router.get('/content', async (req, res) => {
  try {
    // Return EULA content
    // In production, this should come from a database or file
    const eulaContent = {
      version: '1.0',
      lastUpdated: '2024-01-01',
      content: `
# End User License Agreement

## 1. Acceptance of Terms
By using 90Plus, you agree to these terms.

## 2. User Conduct
You agree not to:
- Post offensive, harmful, or illegal content
- Harass or abuse other users
- Violate intellectual property rights
- Spam or engage in fraudulent activity

## 3. Content Moderation
We reserve the right to remove content that violates our guidelines.

## 4. Privacy
Your data is handled according to our Privacy Policy.

## 5. Termination
We may terminate accounts that violate these terms.

## 6. Changes
We may update these terms. Continued use constitutes acceptance.
      `.trim(),
    };

    res.json(eulaContent);
  } catch (error: any) {
    logger.error('Error fetching EULA content:', error);
    res.status(500).json({
      error: 'E010',
      message: 'Failed to fetch EULA content',
    });
  }
});

export default router;
