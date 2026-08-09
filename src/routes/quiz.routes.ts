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
import {
  getQuestionsChallengeHistory,
  getQuestionsChallengeLeaderboard,
  getQuestionsChallengeSession,
  getQuestionCrowdStats,
  getQuestionsModesForUser,
  submitQuestionsChallengeAnswer,
  useQuestionsChallengeHint,
} from '../services/questions-challenges.service';
import type { QuestionChallengeMode } from '../types/questions-challenges.types';

const router = Router();

function getTimezone(req: Request): string {
  return (req.headers['x-user-timezone'] as string) || 'UTC';
}

function parseQuestionChallengeMode(
  raw: string | string[] | undefined
): QuestionChallengeMode | null {
  if (!raw) return null;

  const value = Array.isArray(raw) ? raw[0] : raw;

  if (
    value === 'guess-player' ||
    value === 'football-bingo' ||
    value === 'football-grid' ||
    value === 'player-connections' ||
    value === 'guess-club' ||
    value === 'transfer-puzzle' ||
    value === 'top10-challenge' ||
    value === 'football-quiz'
  ) {
    return value;
  }

  return null;
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
    if (err.message === 'PACK_GENERATING') {
      sendError(
        req,
        res,
        ErrorCode.EXTERNAL_SERVICE,
        'Daily quiz pack is being prepared',
        { code: 'PACK_GENERATING' },
        503,
      );
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
    // Answer arrived after the per-question time limit. Don't 500 — treat it as
    // a timeout (mark the question timed out) and return a coherent result so
    // the client can advance the quiz gracefully.
    if (err.message === 'TIME_LIMIT_EXCEEDED') {
      const clerkUserId = req.auth?.userId;
      const { questionId, language } = req.body ?? {};
      if (clerkUserId && questionId) {
        try {
          const timeoutData = await timeoutQuizQuestion(
            clerkUserId,
            String(questionId),
            getTimezone(req),
            language,
          );
          res.json({ status: 'SUCCESS', data: { ...timeoutData, timedOut: true } });
          return;
        } catch (timeoutErr) {
          logger.error('[Quiz] timeout-after-answer fallback failed', timeoutErr);
        }
      }
      sendError(req, res, ErrorCode.VALIDATION, 'Time limit exceeded');
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

    const data = await useQuizHint(
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

/**
 * GET /api/quiz/questions/modes?language=ar|en
 */
router.get('/questions/modes', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const language = typeof req.query.language === 'string' ? req.query.language : undefined;
    const data = await getQuestionsModesForUser(clerkUserId, language, getTimezone(req));
    res.json({ status: 'SUCCESS', data });
  } catch (err: unknown) {
    logger.error('[Quiz] GET /questions/modes error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load questions challenge modes');
  }
});

/**
 * GET /api/quiz/questions/modes/:mode/session?language=ar|en
 */
router.get('/questions/modes/:mode/session', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const mode = parseQuestionChallengeMode(req.params.mode);
    if (!mode) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid mode');
      return;
    }

    const language = typeof req.query.language === 'string' ? req.query.language : undefined;
    const data = await getQuestionsChallengeSession(clerkUserId, mode, language, getTimezone(req));
    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err?.message === 'QUESTIONS_CHALLENGE_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Challenge not found');
      return;
    }
    logger.error('[Quiz] GET /questions/modes/:mode/session error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load questions challenge session');
  }
});

/**
 * POST /api/quiz/questions/modes/:mode/answer
 * Body: { challengeId, selectedIds, elapsedTime, language? }
 */
router.post('/questions/modes/:mode/answer', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const mode = parseQuestionChallengeMode(req.params.mode);
    if (!mode) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid mode');
      return;
    }

    const { challengeId, questionId, selectedIds, elapsedTime, language } = req.body ?? {};
    if (!challengeId || !Array.isArray(selectedIds)) {
      sendError(req, res, ErrorCode.VALIDATION, 'challengeId and selectedIds are required');
      return;
    }

    const data = await submitQuestionsChallengeAnswer(
      clerkUserId,
      mode,
      {
        challengeId: String(challengeId),
        // Optional: a client that predates multi-question rounds submits
        // without one and is graded against the round's first question.
        questionId: typeof questionId === 'string' ? questionId : undefined,
        selectedIds: selectedIds.map((id) => String(id)),
        elapsedTime: Number(elapsedTime) || 0,
        language: typeof language === 'string' ? language : undefined,
      },
      getTimezone(req),
    );

    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err?.message === 'QUESTIONS_CHALLENGE_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Challenge not found');
      return;
    }
    if (err?.message === 'QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Question not found in this round');
      return;
    }
    logger.error('[Quiz] POST /questions/modes/:mode/answer error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to submit challenge answer');
  }
});

/**
 * GET /api/quiz/questions/modes/:mode/crowd?challengeId=&questionId=&language=
 *
 * "Ask the crowd" — the real split of what other players picked on this
 * question. Returns available:false when too few people have answered.
 */
router.get('/questions/modes/:mode/crowd', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const mode = parseQuestionChallengeMode(req.params.mode);
    if (!mode) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid mode');
      return;
    }

    const challengeId = typeof req.query.challengeId === 'string' ? req.query.challengeId : '';
    if (!challengeId) {
      sendError(req, res, ErrorCode.VALIDATION, 'challengeId is required');
      return;
    }

    const data = await getQuestionCrowdStats(
      clerkUserId,
      mode,
      {
        challengeId,
        questionId: typeof req.query.questionId === 'string' ? req.query.questionId : undefined,
        language: typeof req.query.language === 'string' ? req.query.language : undefined,
      },
      getTimezone(req),
    );

    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err?.message === 'QUESTIONS_CHALLENGE_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Challenge not found');
      return;
    }
    logger.error('[Quiz] GET /questions/modes/:mode/crowd error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load crowd stats');
  }
});

/**
 * POST /api/quiz/questions/modes/:mode/hint
 * Body: { challengeId, language? }
 */
router.post('/questions/modes/:mode/hint', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const mode = parseQuestionChallengeMode(req.params.mode);
    if (!mode) {
      sendError(req, res, ErrorCode.VALIDATION, 'Invalid mode');
      return;
    }

    const { challengeId, language } = req.body ?? {};
    if (!challengeId) {
      sendError(req, res, ErrorCode.VALIDATION, 'challengeId required');
      return;
    }

    const data = await useQuestionsChallengeHint(
      clerkUserId,
      mode,
      {
        challengeId: String(challengeId),
        language: typeof language === 'string' ? language : undefined,
      },
      getTimezone(req),
    );

    res.json({ status: 'SUCCESS', data });
  } catch (err: any) {
    if (err?.message === 'QUESTIONS_CHALLENGE_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Challenge not found');
      return;
    }
    logger.error('[Quiz] POST /questions/modes/:mode/hint error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to use challenge hint');
  }
});

/**
 * GET /api/quiz/questions/leaderboard?period=daily|weekly|monthly&metric=xp|completed|accuracy&limit=50
 */
router.get('/questions/leaderboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const periodRaw = typeof req.query.period === 'string' ? req.query.period : 'daily';
    const metricRaw = typeof req.query.metric === 'string' ? req.query.metric : 'xp';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);

    const period =
      periodRaw === 'weekly' || periodRaw === 'monthly' || periodRaw === 'daily'
        ? periodRaw
        : 'daily';
    const metric =
      metricRaw === 'completed' || metricRaw === 'accuracy' || metricRaw === 'xp'
        ? metricRaw
        : 'xp';

    const data = await getQuestionsChallengeLeaderboard(period, metric, limit);
    res.json({ status: 'SUCCESS', data: { period, metric, rows: data } });
  } catch (err: unknown) {
    logger.error('[Quiz] GET /questions/leaderboard error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load questions leaderboard');
  }
});

/**
 * GET /api/quiz/questions/history?language=ar|en&limit=30
 */
router.get('/questions/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) {
      sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
      return;
    }

    const language = typeof req.query.language === 'string' ? req.query.language : undefined;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '30'), 10) || 30, 1), 100);
    const data = await getQuestionsChallengeHistory(clerkUserId, language, limit);

    res.json({ status: 'SUCCESS', data: { rows: data } });
  } catch (err: unknown) {
    logger.error('[Quiz] GET /questions/history error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load questions challenge history');
  }
});

export default router;
