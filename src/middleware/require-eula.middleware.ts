/**
 * EULA Requirement Middleware
 * Apple Compliance - Guideline 1.2
 * 
 * Ensures users have accepted the EULA before accessing protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Middleware to check if user has accepted EULA
 * Requires clerk middleware to run first to set req.userId
 */
export async function requireEULA(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({
        error: 'E002',
        message: 'Authentication required',
      });
      return;
    }

    // Check if user has accepted EULA
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { eulaAccepted: true, eulaVersion: true },
    });

    if (!user) {
      res.status(404).json({
        error: 'E004',
        message: 'User not found',
      });
      return;
    }

    if (!user.eulaAccepted) {
      res.status(403).json({
        error: 'E003',
        message: 'EULA acceptance required',
        details: {
          reason: 'You must accept the End User License Agreement to continue',
          action: 'Navigate to /eula to accept',
        },
      });
      return;
    }

    // Optional: Check if EULA version is current
    const currentEULAVersion = '1.0';
    if (user.eulaVersion !== currentEULAVersion) {
      logger.warn('User has outdated EULA version', {
        userId,
        userVersion: user.eulaVersion,
        currentVersion: currentEULAVersion,
      });
      // You can choose to require re-acceptance here
    }

    next();
  } catch (error: any) {
    logger.error('EULA middleware error:', error);
    res.status(500).json({
      error: 'E010',
      message: 'Internal server error',
    });
  }
}
