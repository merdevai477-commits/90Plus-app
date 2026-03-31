/**
 * Age Verification Middleware
 * 
 * Enforces age verification and content restrictions based on age tier
 * 
 * Middleware:
 * - requireAgeVerification: Ensures user has verified their age
 * - requireParentalConsent: Ensures TEEN users have parental consent
 * - requireAdultTier: Restricts access to 18+ users only
 * - checkContentRestrictions: Applies age-based content restrictions
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../lib/prisma-lazy';
import { logger } from '../utils/logger';

const prisma = getPrisma();

// ============================================================================
// TYPES
// ============================================================================

enum AgeTier {
  BLOCKED = 'BLOCKED',
  TEEN = 'TEEN',
  ADULT = 'ADULT',
}

// ============================================================================
// Middleware: Require Age Verification
// ============================================================================

export const requireAgeVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId; // From auth middleware

    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        code: 'E002',
        message: 'Authentication required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageVerifiedAt: true,
        ageTier: true,
        parentalConsent: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'User not found',
      });
    }

    // Check if age verified
    if (!user.ageVerifiedAt) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'AGE_NOT_VERIFIED',
        message: 'Age verification required',
        action: 'VERIFY_AGE',
      });
    }

    // Check if blocked tier
    if (user.ageTier === AgeTier.BLOCKED) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'AGE_RESTRICTED',
        message: 'Access denied for users under 13',
        ageTier: user.ageTier,
      });
    }

    // Check if teen without parental consent
    if (user.ageTier === AgeTier.TEEN && !user.parentalConsent) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'PARENTAL_CONSENT_REQUIRED',
        message: 'Parental consent required',
        action: 'REQUEST_PARENTAL_CONSENT',
        ageTier: user.ageTier,
      });
    }

    // Store age tier in request for later use
    req.ageTier = user.ageTier as string;

    next();
  } catch (error: any) {
    logger.error('Age verification middleware error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to verify age',
    });
  }
};

// ============================================================================
// Middleware: Require Parental Consent (for TEEN tier)
// ============================================================================

export const requireParentalConsent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageTier: true,
        parentalConsent: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'User not found',
      });
    }

    if (user.ageTier === AgeTier.TEEN && !user.parentalConsent) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'PARENTAL_CONSENT_REQUIRED',
        message: 'Parental consent required for this action',
        action: 'REQUEST_PARENTAL_CONSENT',
      });
    }

    next();
  } catch (error: any) {
    logger.error('Parental consent middleware error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to check parental consent',
    });
  }
};

// ============================================================================
// Middleware: Require Adult Tier (18+)
// ============================================================================

export const requireAdultTier = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageTier: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'User not found',
      });
    }

    if (user.ageTier !== AgeTier.ADULT) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'ADULT_ONLY',
        message: 'This feature is only available for users 18+',
        ageTier: user.ageTier,
      });
    }

    next();
  } catch (error: any) {
    logger.error('Adult tier middleware error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to check age tier',
    });
  }
};

// ============================================================================
// Middleware: Check Content Restrictions
// ============================================================================

export const checkContentRestrictions = (feature: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          ageTier: true,
          parentalConsent: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          status: 'ERROR',
          code: 'E004',
          message: 'User not found',
        });
      }

      // Define restrictions per feature
      const restrictions: Record<string, (ageTier: string, parentalConsent: boolean) => boolean> = {
        chat: (tier) => tier === AgeTier.ADULT,
        createReel: (tier) => tier !== AgeTier.BLOCKED,
        comment: (tier) => tier !== AgeTier.BLOCKED,
        follow: (tier) => tier !== AgeTier.BLOCKED,
        realMoney: (tier) => tier === AgeTier.ADULT,
        shareLocation: (tier) => tier === AgeTier.ADULT,
        publicProfile: (tier) => tier === AgeTier.ADULT,
      };

      const canAccess = restrictions[feature]?.(user.ageTier!, user.parentalConsent);

      if (!canAccess) {
        return res.status(403).json({
          status: 'ERROR',
          code: 'FEATURE_RESTRICTED',
          message: `This feature is not available for your age group`,
          feature,
          ageTier: user.ageTier,
        });
      }

      next();
    } catch (error: any) {
      logger.error('Content restrictions middleware error:', error);
      return res.status(500).json({
        status: 'ERROR',
        code: 'E010',
        message: 'Failed to check content restrictions',
      });
    }
  };
};

// ============================================================================
// Helper: Get User Age Tier
// ============================================================================

export async function getUserAgeTier(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ageTier: true },
    });

    return user?.ageTier || null;
  } catch (error) {
    logger.error('Get user age tier error:', error);
    return null;
  }
}

// ============================================================================
// Helper: Check if User Can Access Feature
// ============================================================================

export async function canUserAccessFeature(
  userId: string,
  feature: string
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageTier: true,
        parentalConsent: true,
      },
    });

    if (!user) return false;

    const restrictions: Record<string, (ageTier: string) => boolean> = {
      chat: (tier) => tier === AgeTier.ADULT,
      createReel: (tier) => tier !== AgeTier.BLOCKED,
      comment: (tier) => tier !== AgeTier.BLOCKED,
      follow: (tier) => tier !== AgeTier.BLOCKED,
      realMoney: (tier) => tier === AgeTier.ADULT,
      shareLocation: (tier) => tier === AgeTier.ADULT,
      publicProfile: (tier) => tier === AgeTier.ADULT,
    };

    return restrictions[feature]?.(user.ageTier!) ?? true;
  } catch (error) {
    logger.error('Can user access feature error:', error);
    return false;
  }
}
