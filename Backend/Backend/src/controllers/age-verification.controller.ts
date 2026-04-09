// @ts-nocheck
/**
 * Age Verification Controller
 * 
 * Handles age verification and parental consent for COPPA compliance
 * 
 * Features:
 * - ✅ Age verification (DOB validation)
 * - ✅ Age tier calculation (BLOCKED, TEEN, ADULT)
 * - ✅ Parental consent request
 * - ✅ Parental consent confirmation
 * - ✅ Age status check
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { Request, Response } from 'express';
import { getPrisma } from '../lib/prisma-lazy';
import { logger } from '../utils/logger';
import { sendParentalConsentEmail } from '../services/email.service';
import crypto from 'crypto';

const prisma = getPrisma();

// ============================================================================
// TYPES
// ============================================================================

enum AgeTier {
  BLOCKED = 'BLOCKED', // Under 13
  TEEN = 'TEEN',       // 13-17
  ADULT = 'ADULT',     // 18+
}

enum ConsentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

// ============================================================================
// HELPER: Calculate Age
// ============================================================================

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  
  return age;
}

// ============================================================================
// HELPER: Determine Age Tier
// ============================================================================

function determineAgeTier(age: number): AgeTier {
  if (age < 13) return AgeTier.BLOCKED;
  if (age >= 13 && age < 18) return AgeTier.TEEN;
  return AgeTier.ADULT;
}

// ============================================================================
// POST /api/auth/verify-age
// ============================================================================

export const verifyAge = async (req: Request, res: Response) => {
  try {
    const { dateOfBirth } = req.body;
    const userId = req.userId; // From auth middleware

    // Validation
    if (!dateOfBirth) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E001',
        message: 'Date of birth is required',
      });
    }

    // Parse date
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E001',
        message: 'Invalid date format',
      });
    }

    // Check if date is in the future
    if (dob > new Date()) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E001',
        message: 'Date of birth cannot be in the future',
      });
    }

    // Check if user already verified
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { ageVerifiedAt: true },
    });

    if (existingUser?.ageVerifiedAt) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E005',
        message: 'Age already verified. Cannot change date of birth.',
      });
    }

    // Calculate age and tier
    const age = calculateAge(dob);
    const ageTier = determineAgeTier(age);

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        dateOfBirth: dob,
        ageVerifiedAt: new Date(),
        ageTier,
        age, // Update FIFA card age field
      },
    });

    logger.info(`Age verified for user ${userId}: ${age} years old (${ageTier})`);

    // Response based on tier
    if (ageTier === AgeTier.BLOCKED) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'AGE_RESTRICTED',
        ageTier,
        message: 'You must be at least 13 years old to use this app',
        requiresParentalConsent: false,
      });
    }

    if (ageTier === AgeTier.TEEN) {
      return res.status(200).json({
        status: 'SUCCESS',
        ageTier,
        age,
        requiresParentalConsent: true,
        message: 'Parental consent required for users aged 13-17',
      });
    }

    // ADULT tier
    return res.status(200).json({
      status: 'SUCCESS',
      ageTier,
      age,
      requiresParentalConsent: false,
      message: 'Age verified successfully',
    });

  } catch (error: any) {
    logger.error('Age verification error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to verify age',
      error: error.message,
    });
  }
};

// ============================================================================
// POST /api/auth/request-parental-consent
// ============================================================================

export const requestParentalConsent = async (req: Request, res: Response) => {
  try {
    const { parentEmail } = req.body;
    const userId = req.userId;

    // Validation
    if (!parentEmail || !parentEmail.includes('@')) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E001',
        message: 'Valid parent email is required',
      });
    }

    // Check user tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageTier: true,
        parentalConsent: true,
        username: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'User not found',
      });
    }

    if (user.ageTier !== AgeTier.TEEN) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E001',
        message: 'Parental consent only required for users aged 13-17',
      });
    }

    if (user.parentalConsent) {
      return res.status(400).json({
        status: 'ERROR',
        code: 'E005',
        message: 'Parental consent already obtained',
      });
    }

    // Check rate limit (max 3 requests per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const requestCount = await prisma.parentalConsentRequest.count({
      where: {
        userId,
        requestedAt: {
          gte: today,
        },
      },
    });

    if (requestCount >= 3) {
      return res.status(429).json({
        status: 'ERROR',
        code: 'E006',
        message: 'Too many consent requests. Please try again tomorrow.',
      });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration (48 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Create consent request
    const consentRequest = await prisma.parentalConsentRequest.create({
      data: {
        userId,
        parentEmail,
        token,
        status: ConsentStatus.PENDING,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        parentEmail,
        parentalConsentRequestedAt: new Date(),
      },
    });

    // Send email to parent
    await sendParentalConsentEmail({
      parentEmail,
      childUsername: user.username,
      childEmail: user.email,
      token,
      expiresAt,
    });

    logger.info(`Parental consent requested for user ${userId}, sent to ${parentEmail}`);

    return res.status(200).json({
      status: 'SUCCESS',
      requestId: consentRequest.id,
      parentEmail,
      expiresAt,
      message: 'Consent request sent to parent email',
    });

  } catch (error: any) {
    logger.error('Parental consent request error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to request parental consent',
      error: error.message,
    });
  }
};

// ============================================================================
// GET /api/auth/confirm-parental-consent/:token
// ============================================================================

export const confirmParentalConsent = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find consent request
    const consentRequest = await prisma.parentalConsentRequest.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!consentRequest) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Link</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1>❌ Invalid Link</h1>
          <p>This consent link is invalid or has expired.</p>
        </body>
        </html>
      `);
    }

    // Check if already confirmed
    if (consentRequest.status === ConsentStatus.CONFIRMED) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Already Confirmed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #27ae60; }
          </style>
        </head>
        <body>
          <h1>✅ Already Confirmed</h1>
          <p>Parental consent has already been confirmed for ${consentRequest.user.username}.</p>
        </body>
        </html>
      `);
    }

    // Check if expired
    if (new Date() > consentRequest.expiresAt) {
      await prisma.parentalConsentRequest.update({
        where: { id: consentRequest.id },
        data: { status: ConsentStatus.EXPIRED },
      });

      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Expired</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #e67e22; }
          </style>
        </head>
        <body>
          <h1>⏰ Link Expired</h1>
          <p>This consent link has expired. Please request a new one.</p>
        </body>
        </html>
      `);
    }

    // Confirm consent
    await prisma.$transaction([
      // Update consent request
      prisma.parentalConsentRequest.update({
        where: { id: consentRequest.id },
        data: {
          status: ConsentStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      }),
      // Update user
      prisma.user.update({
        where: { id: consentRequest.userId },
        data: {
          parentalConsent: true,
          parentalConsentConfirmedAt: new Date(),
        },
      }),
    ]);

    logger.info(`Parental consent confirmed for user ${consentRequest.userId}`);

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Consent Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #27ae60; }
          .info { background: #ecf0f1; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
        </style>
      </head>
      <body>
        <h1>✅ Consent Confirmed</h1>
        <div class="info">
          <p><strong>Child's Username:</strong> ${consentRequest.user.username}</p>
          <p><strong>Child's Email:</strong> ${consentRequest.user.email}</p>
        </div>
        <p>Your child can now use 90Plus with parental supervision.</p>
        <p>Thank you for keeping your child safe online!</p>
      </body>
      </html>
    `);

  } catch (error: any) {
    logger.error('Parental consent confirmation error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>❌ Error</h1>
        <p>An error occurred while confirming consent. Please try again later.</p>
      </body>
      </html>
    `);
  }
};

// ============================================================================
// GET /api/auth/age-status
// ============================================================================

export const getAgeStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageVerifiedAt: true,
        ageTier: true,
        parentalConsent: true,
        dateOfBirth: true,
        parentEmail: true,
        parentalConsentRequestedAt: true,
        parentalConsentConfirmedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'User not found',
      });
    }

    // Calculate restrictions based on age tier
    const restrictions = {
      canChat: user.ageTier === AgeTier.ADULT,
      canCreateReels: user.ageTier !== AgeTier.BLOCKED,
      canComment: user.ageTier !== AgeTier.BLOCKED,
      canFollow: user.ageTier !== AgeTier.BLOCKED,
      canUseRealMoney: user.ageTier === AgeTier.ADULT,
      profilePublicByDefault: user.ageTier === AgeTier.ADULT,
      canShareLocation: user.ageTier === AgeTier.ADULT,
    };

    return res.status(200).json({
      status: 'SUCCESS',
      ageVerified: !!user.ageVerifiedAt,
      ageTier: user.ageTier,
      parentalConsent: user.parentalConsent,
      parentalConsentPending: user.ageTier === AgeTier.TEEN && !user.parentalConsent && !!user.parentalConsentRequestedAt,
      restrictions,
    });

  } catch (error: any) {
    logger.error('Get age status error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to get age status',
      error: error.message,
    });
  }
};

// ============================================================================
// POST /api/auth/resend-parental-consent
// ============================================================================

export const resendParentalConsent = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    // Get latest pending request
    const latestRequest = await prisma.parentalConsentRequest.findFirst({
      where: {
        userId,
        status: ConsentStatus.PENDING,
      },
      orderBy: {
        requestedAt: 'desc',
      },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!latestRequest) {
      return res.status(404).json({
        status: 'ERROR',
        code: 'E004',
        message: 'No pending consent request found',
      });
    }

    // Check if expired
    if (new Date() > latestRequest.expiresAt) {
      return res.status(410).json({
        status: 'ERROR',
        code: 'CONSENT_EXPIRED',
        message: 'Consent request expired. Please create a new request.',
      });
    }

    // Resend email
    await sendParentalConsentEmail({
      parentEmail: latestRequest.parentEmail,
      childUsername: latestRequest.user.username,
      childEmail: latestRequest.user.email,
      token: latestRequest.token,
      expiresAt: latestRequest.expiresAt,
    });

    logger.info(`Parental consent email resent for user ${userId}`);

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Consent email resent successfully',
      parentEmail: latestRequest.parentEmail,
      expiresAt: latestRequest.expiresAt,
    });

  } catch (error: any) {
    logger.error('Resend parental consent error:', error);
    return res.status(500).json({
      status: 'ERROR',
      code: 'E010',
      message: 'Failed to resend consent email',
      error: error.message,
    });
  }
};
