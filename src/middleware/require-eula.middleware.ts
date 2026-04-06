// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Middleware to require EULA acceptance before accessing UGC features
 * Apple Guideline 1.2 - UGC Safety Compliance
 * 
 * This middleware blocks API calls to UGC endpoints if user hasn't accepted EULA
 */
export const requireEULA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'E002',
        message: 'Authentication required',
      });
    }

    // Check if user has accepted EULA
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        eulaAccepted: true,
        eulaVersion: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'E004',
        message: 'User not found',
      });
    }

    // Block access if EULA not accepted
    if (!user.eulaAccepted) {
      logger.warn(`User ${userId} attempted to access UGC without accepting EULA`);
      return res.status(403).json({
        error: 'E003',
        message: 'EULA acceptance required',
        details: 'You must accept the Terms of Use before accessing this feature',
        requiresEULA: true,
      });
    }

    // EULA accepted, proceed
    next();
  } catch (error: any) {
    logger.error('EULA middleware error:', error);
    return res.status(500).json({
      error: 'E010',
      message: 'Internal server error',
      details: error.message,
    });
  }
};
