/**
 * Daily Quiz API — AI packs, answers, skip, hint, XP & coins.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { logger } from '../utils/logger';
import { ErrorCode, sendError } from '../constants/errors';
import {
  getDailyQuizForUser,
  submitQuizAnswer,
  skipQuizQuestion,
  useQuizHint,
  timeoutQuizQuestion,
} from '../services/quiz-daily.service';
import type { QuizOptionKey } from '../types/quiz.types';

const router = Router();

function getTimezone(req: Request): string {
  return (req.headers['x-user-timezone'] as string) || 'UTC';
}

/**
 * GET /api/quiz/daily?language=ar|en
 */
router.get('/daily', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const language = typeof req.query.language === 'string' ? req.query.language : undefined;
    const data = await getDailyQuizForUser(clerkUserId, language, getTimezone(req));

    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    logger.error('[Quiz] GET /daily error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load daily quiz');
  }
});

/**
 * POST /api/quiz/answer
 * Body: { questionId, selectedKey, timeTaken?, language? }
 */
router.post('/answer', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const { questionId, selectedKey, timeTaken, language } = req.body ?? {};
    if (!questionId || !selectedKey) {
      sendError(req, res, ErrorCode.VALIDATION, 'questionId and selectedKey required');
      return;
    }

    const key = String(selectedKey).toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(key)) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid selectedKey');
      return;
    }

    const data = await submitQuizAnswer(
      clerkUserId,
      String(questionId),
      key as QuizOptionKey,
      Number(timeTaken) || 0,
      getTimezone(req),
      language,
    );

    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err.message === 'USER_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    if (err.message === 'QUESTION_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Question not found');
      return;
    }
    logger.error('[Quiz] POST /answer error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to submit answer');
  }
});

/**
 * POST /api/quiz/skip
 */
router.post('/skip', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const { questionId, language } = req.body ?? {};
    if (!questionId) {
      sendError(req, res, ErrorCode.VALIDATION, 'questionId required');
      return;
    }

    const data = await skipQuizQuestion(
      clerkUserId,
      String(questionId),
      getTimezone(req),
      language,
    );

    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_COINS') {
      sendError(req, res, ErrorCode.VALIDATION, 'Not enough coins');
      return;
    }
    if (err.message === 'QUESTION_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Question not found');
      return;
    }
    logger.error('[Quiz] POST /skip error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to skip question');
  }
});

/**
 * POST /api/quiz/hint
 */
router.post('/hint', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const { questionId, language } = req.body ?? {};
    if (!questionId) {
      sendError(req, res, ErrorCode.VALIDATION, 'questionId required');
      return;
    }

    const data = await useQuizHint(clerkUserId, String(questionId), language);
    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_COINS') {
      sendError(req, res, ErrorCode.VALIDATION, 'Not enough coins');
      return;
    }
    if (err.message === 'QUESTION_CLOSED') {
      sendError(req, res, ErrorCode.VALIDATION, 'Question already finished');
      return;
    }
    logger.error('[Quiz] POST /hint error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to use hint');
  }
});

/**
 * POST /api/quiz/timeout
 * Body: { questionId, language? }
 */
router.post('/timeout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const { questionId, language } = req.body ?? {};
    if (!questionId) {
      sendError(req, res, ErrorCode.VALIDATION, 'questionId required');
      return;
    }

    const data = await timeoutQuizQuestion(
      clerkUserId,
      String(questionId),
      getTimezone(req),
      language,
    );

    res.json({ status: 'SUCCESS', data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'USER_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'User not found');
      return;
    }
    if (message === 'QUESTION_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Question not found');
      return;
    }
    logger.error('[Quiz] POST /timeout error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to process quiz timeout');
  }
});

export default router;
