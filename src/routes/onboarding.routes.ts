import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { ErrorCode, sendError } from '../constants/errors';
import { OnboardingService, parseOnboardingTeamsBody } from '../services/onboarding.service';
import { invalidateUserCache } from './clerk-user.routes';
import { resolveAppLanguage } from '../utils/app-language.util';
import { logger } from '../utils/logger';

const router = Router();

router.get('/clubs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const language = resolveAppLanguage(req);
    const data = await OnboardingService.getSuggestedClubs({
      clerkUserId,
      req,
      language,
    });

    res.json({ status: 'SUCCESS', data });
  } catch (error) {
    logger.error('[onboarding/clubs]', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load onboarding clubs');
  }
});

router.post('/teams', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const parsed = parseOnboardingTeamsBody(req.body);
    if (parsed.error) {
      sendError(req, res, ErrorCode.VALIDATION, parsed.error);
      return;
    }

    const result = await OnboardingService.complete({
      clerkUserId,
      skipped: parsed.skipped,
      teams: parsed.teams,
      language: resolveAppLanguage(req),
      timezone: (req.headers['x-user-timezone'] as string) || 'UTC',
    });

    invalidateUserCache(clerkUserId);

    res.json({
      status: 'SUCCESS',
      data: result,
    });
  } catch (error: any) {
    if (error?.code === 'NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    logger.error('[onboarding/teams]', error);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to complete onboarding');
  }
});

export default router;
