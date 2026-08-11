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
  getQuestionFiftyFifty,
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
    if (err.message === 'QUIZ_DAILY_GENERATION_UNAVAILABLE') {
      sendError(
        req,
        res,
        ErrorCode.EXTERNAL_SERVICE,
        'Quiz question generation is temporarily unavailable',
        { reason: 'QUESTION_GENERATION_UNAVAILABLE' },
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
 * Every /questions/* route below is per-user, per-day session/round data.
 * Express auto-generates an ETag for every res.json() call; once the mobile
 * client's native HTTP layer (OkHttp / NSURLSession) caches one 200 response
 * with that ETag, it silently attaches `If-None-Match` on the next identical
 * request, and Express honors it with a bodyless `304 Not Modified` — the
 * request still "succeeds" but the round's `content.questions` never reaches
 * the client. `no-store` stops the response from being cached for
 * conditional revalidation in the first place, so this can never happen here.
 */
router.use('/questions', (_req: Request, res: Response, next) => {
  res.set('Cache-Control', 'no-store');
  next();
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
      sendError(req, res, ErrorCode.NOT_FOUND, 'Challenge not found', {
        reason: 'QUESTIONS_CHALLENGE_NOT_FOUND',
        mode: req.params.mode,
      });
      return;
    }
    /*
     * Today's round exists but holds no questions, so there is nothing to play.
     * Reported as an explicit upstream-content failure (502) with a stable
     * `reason`, so the app can say "today's round isn't ready, retry" instead
     * of collapsing it into a generic SESSION_LOAD_FAILED. Deliberately NOT a
     * 200 with an empty round, and deliberately not backfilled with canned
     * questions.
     */
    if (err?.message === 'QUESTIONS_CHALLENGE_EMPTY') {
      logger.error('[Quiz] session round empty', {
        mode: req.params.mode,
        language: req.query.language,
      });
      sendError(
        req,
        res,
        ErrorCode.EXTERNAL_SERVICE,
        'Today\'s questions round is not ready yet',
        { reason: 'QUESTIONS_CHALLENGE_EMPTY', mode: req.params.mode },
      );
      return;
    }
    /*
     * The round is being written right now. This is a "come back in a moment"
     * state, not a failure, so it gets its own reason and a Retry-After rather
     * than being flattened into QUESTION_GENERATION_UNAVAILABLE — the app can
     * show "preparing today's round" and poll instead of a dead end.
     */
    if (err?.message === 'QUESTION_GENERATION_IN_PROGRESS') {
      const retryAfterSeconds = Number(err?.details?.retryAfterSeconds) || 5;
      res.setHeader('Retry-After', String(retryAfterSeconds));
      sendError(
        req,
        res,
        ErrorCode.EXTERNAL_SERVICE,
        'Today\'s questions round is being prepared',
        {
          reason: 'GENERATION_IN_PROGRESS',
          mode: req.params.mode,
          retryAfterSeconds,
          ...(typeof err?.details === 'object' && err.details ? { generation: err.details } : {}),
        },
        503,
      );
      return;
    }
    if (err?.message === 'QUESTION_GENERATION_UNAVAILABLE') {
      sendError(
        req,
        res,
        ErrorCode.EXTERNAL_SERVICE,
        'Question generation is temporarily unavailable',
        {
          reason: 'QUESTION_GENERATION_UNAVAILABLE',
          mode: req.params.mode,
          ...(typeof err?.details === 'object' && err.details ? { generation: err.details } : {}),
        },
        503,
      );
      return;
    }
    logger.error('[Quiz] GET /questions/modes/:mode/session error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to load questions challenge session', {
      reason: 'QUESTIONS_SESSION_INTERNAL',
      mode: req.params.mode,
    });
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
    // Expected session-state races (double submit, stale/retried request,
    // resuming after the timer elapsed) — not server faults. Reported as a
    // stable reason code so the client can recover instead of getting a 500.
    if (typeof err?.message === 'string' && err.message.startsWith('QUESTIONS_SESSION_')) {
      sendError(
        req,
        res,
        ErrorCode.CONFLICT,
        'Answer could not be applied to the current session state',
        { reason: err.message },
        409,
      );
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
 * GET /api/quiz/questions/modes/:mode/fifty-fifty?challengeId=&questionId=&language=
 *
 * "50:50" — which two option ids should stay visible (the real correct option
 * plus one real wrong option), resolved server-side from the round's stored
 * answer. The full answer key is never sent to the client.
 */
router.get('/questions/modes/:mode/fifty-fifty', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

    const data = await getQuestionFiftyFifty(
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
    if (err?.message === 'QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND') {
      sendError(req, res, ErrorCode.NOT_FOUND, 'Question not found in this round');
      return;
    }
    if (err?.message === 'QUESTIONS_CHALLENGE_FIFTY_FIFTY_UNAVAILABLE') {
      sendError(req, res, ErrorCode.VALIDATION, '50:50 is not available for this question');
      return;
    }
    logger.error('[Quiz] GET /questions/modes/:mode/fifty-fifty error', err);
    sendError(req, res, ErrorCode.INTERNAL, 'Failed to resolve 50:50');
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
