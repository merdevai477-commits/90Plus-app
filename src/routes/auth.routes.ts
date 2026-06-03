import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { AgeTier, ConsentStatus } from '@prisma/client';
import { requireAuth } from '../middleware/clerk.middleware';
import { ensureBackendUser } from '../utils/ensureBackendUser';
import { sendError, ErrorCode } from '../constants/errors';
import { logger } from '../utils/logger';
import {
  sendParentalConsentEmail,
  sendConsentConfirmationEmail,
} from '../services/email.service';

const router = Router();

const CONSENT_EXPIRY_HOURS = 48;
const MAX_CONSENT_REQUESTS_PER_DAY = 3;

function parseDateOfBirthYmd(input: unknown): Date | null {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const [y, m, d] = input.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function computeAgeYears(dob: Date, ref = new Date()): number {
  let age = ref.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function tierFromAge(age: number): AgeTier {
  if (age < 13) return AgeTier.BLOCKED;
  if (age < 18) return AgeTier.TEEN;
  return AgeTier.ADULT;
}

async function getUserForAuth(clerkUserId: string) {
  const base = await ensureBackendUser(clerkUserId);
  return prisma.user.findUniqueOrThrow({
    where: { id: base.id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      dateOfBirth: true,
      ageTier: true,
      ageVerifiedAt: true,
      parentalConsent: true,
      parentEmail: true,
    },
  });
}

async function countConsentRequestsLast24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.parentalConsentRequest.count({
    where: { userId, requestedAt: { gte: since } },
  });
}

async function createConsentRequest(
  user: { id: string; email: string; username: string; displayName: string | null },
  parentEmail: string,
  req: Request,
): Promise<{ expiresAt: Date; token: string }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + CONSENT_EXPIRY_HOURS * 60 * 60 * 1000);
  const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;
  const userAgent = req.headers['user-agent'];

  await prisma.parentalConsentRequest.create({
    data: {
      userId: user.id,
      parentEmail,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      parentEmail,
      parentalConsentRequestedAt: new Date(),
    },
  });

  await sendParentalConsentEmail({
    parentEmail,
    childUsername: user.displayName || user.username,
    childEmail: user.email,
    token,
    expiresAt,
  });

  return { expiresAt, token };
}

/**
 * POST /api/auth/verify-age
 */
router.post('/verify-age', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    if (req.body?.minAgeConfirmed === true) {
      const user = await getUserForAuth(clerkUserId);
      const now = new Date();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ageTier: AgeTier.ADULT,
          ageVerifiedAt: now,
        },
      });
      res.json({
        ageTier: 'ADULT',
        requiresParentalConsent: false,
      });
      return;
    }

    const dob = parseDateOfBirthYmd(req.body?.dateOfBirth);
    if (!dob) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid date of birth (use YYYY-MM-DD)');
      return;
    }

    const now = new Date();
    if (dob > now) {
      sendError(req, res, ErrorCode.VALIDATION, 'Date of birth cannot be in the future');
      return;
    }

    const age = computeAgeYears(dob, now);
    const ageTier = tierFromAge(age);

    const user = await getUserForAuth(clerkUserId);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        dateOfBirth: dob,
        ageTier,
        ageVerifiedAt: now,
      },
    });

    if (ageTier === AgeTier.BLOCKED) {
      res.status(403).json({
        code: 'AGE_RESTRICTED',
        message: 'You must be at least 13 years old to use 90Plus',
        ageTier: 'BLOCKED',
      });
      return;
    }

    if (ageTier === AgeTier.TEEN) {
      const requiresParentalConsent = !user.parentalConsent;
      res.json({
        ageTier: 'TEEN',
        requiresParentalConsent,
      });
      return;
    }

    res.json({
      ageTier: 'ADULT',
      requiresParentalConsent: false,
    });
  } catch (error: any) {
    logger.error('[auth/verify-age] Error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to verify age');
  }
});

/**
 * GET /api/auth/age-status
 */
router.get('/age-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const user = await getUserForAuth(clerkUserId);

    res.json({
      ageTier: user.ageTier,
      parentalConsent: user.parentalConsent === true,
      ageVerified: user.ageVerifiedAt != null,
    });
  } catch (error: any) {
    logger.error('[auth/age-status] Error:', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to get age status');
  }
});

/**
 * POST /api/auth/request-parental-consent
 */
router.post(
  '/request-parental-consent',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const parentEmail =
        typeof req.body?.parentEmail === 'string'
          ? req.body.parentEmail.trim().toLowerCase()
          : '';
      if (!parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Valid parent email is required');
        return;
      }

      const user = await getUserForAuth(clerkUserId);

      if (user.ageTier !== AgeTier.TEEN) {
        sendError(req, res, ErrorCode.VALIDATION, 'Parental consent is only required for teen accounts');
        return;
      }

      if (user.parentalConsent) {
        res.json({ status: 'SUCCESS', message: 'Consent already confirmed', parentalConsent: true });
        return;
      }

      const recentCount = await countConsentRequestsLast24h(user.id);
      if (recentCount >= MAX_CONSENT_REQUESTS_PER_DAY) {
        sendError(req, res, ErrorCode.RATE_LIMIT, 'Too many consent requests. Please try again tomorrow.');
        return;
      }

      const { expiresAt } = await createConsentRequest(user, parentEmail, req);

      res.json({
        status: 'SUCCESS',
        message: 'Consent request sent',
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: any) {
      logger.error('[auth/request-parental-consent] Error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to send consent request');
    }
  },
);

/**
 * POST /api/auth/resend-parental-consent
 */
router.post(
  '/resend-parental-consent',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const clerkUserId = req.auth?.userId;
      if (!clerkUserId) {
        sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
        return;
      }

      const user = await getUserForAuth(clerkUserId);

      if (user.parentalConsent) {
        res.json({ status: 'SUCCESS', message: 'Consent already confirmed' });
        return;
      }

      const parentEmail = user.parentEmail;
      if (!parentEmail) {
        sendError(req, res, ErrorCode.VALIDATION, 'No parent email on file. Submit a new request.');
        return;
      }

      const recentCount = await countConsentRequestsLast24h(user.id);
      if (recentCount >= MAX_CONSENT_REQUESTS_PER_DAY) {
        sendError(req, res, ErrorCode.RATE_LIMIT, 'Too many consent requests. Please try again tomorrow.');
        return;
      }

      const { expiresAt } = await createConsentRequest(user, parentEmail, req);

      res.json({
        status: 'SUCCESS',
        message: 'Consent email resent',
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: any) {
      logger.error('[auth/resend-parental-consent] Error:', error);
      sendError(req, res, ErrorCode.INTERNAL, 'Failed to resend consent email');
    }
  },
);

/**
 * GET /api/auth/confirm-parental-consent/:token
 * Public link from parent email
 */
router.get(
  '/confirm-parental-consent/:token',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tokenParam = req.params.token;
      const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
      if (!token) {
        res.status(400).send('Invalid consent link');
        return;
      }

      const request = await prisma.parentalConsentRequest.findUnique({
        where: { token: token },
        include: {
          user: { select: { id: true, email: true, username: true, displayName: true } },
        },
      });

      if (!request) {
        res.status(404).send('Consent request not found or already used');
        return;
      }

      if (request.status === ConsentStatus.CONFIRMED) {
        res.type('html').send(successHtml('Consent was already confirmed. Thank you!'));
        return;
      }

      if (request.expiresAt < new Date() || request.status === ConsentStatus.EXPIRED) {
        await prisma.parentalConsentRequest.update({
          where: { id: request.id },
          data: { status: ConsentStatus.EXPIRED },
        });
        res.status(410).send('This consent link has expired. Ask your child to send a new request.');
        return;
      }

      const now = new Date();

      await prisma.$transaction([
        prisma.parentalConsentRequest.update({
          where: { id: request.id },
          data: { status: ConsentStatus.CONFIRMED, confirmedAt: now },
        }),
        prisma.user.update({
          where: { id: request.userId },
          data: {
            parentalConsent: true,
            parentalConsentConfirmedAt: now,
            ageTier: AgeTier.TEEN,
          },
        }),
      ]);

      const child = request.user;
      sendConsentConfirmationEmail(
        child.email,
        child.displayName || child.username,
      ).catch((err) => logger.warn('[auth/confirm-parental-consent] Child notify email failed:', err));

      res.type('html').send(
        successHtml(
          'Thank you! Parental consent has been confirmed. Your child can now use 90Plus.',
        ),
      );
    } catch (error: any) {
      logger.error('[auth/confirm-parental-consent] Error:', error);
      res.status(500).send('Something went wrong. Please try again later.');
    }
  },
);

function successHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>90Plus — Parental Consent</title>
<style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.card{max-width:420px;background:#111;border:1px solid #22c55e;border-radius:16px;padding:32px}
h1{color:#22c55e;font-size:1.5rem}p{color:#9ca3af;line-height:1.6}</style></head>
<body><div class="card"><h1>90Plus</h1><p>${message}</p></div></body></html>`;
}

export default router;
