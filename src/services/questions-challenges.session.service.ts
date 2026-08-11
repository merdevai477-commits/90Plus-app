/**
 * Questions-mode game session — server-authoritative sequential flow.
 *
 * Persists progress on UserQuestionChallenge.answeredPayload:
 *   sessionStatus, currentQuestionIndex, questionStartedAt, questionExpiresAt,
 *   byQuestionId (per-question answered/expired records), finalResult.
 *
 * Mirrors the daily-quiz session pattern (quiz-daily.service.ts) but enforces
 * exactly QUIZ_QUESTION_COUNT questions with QUIZ_QUESTION_TIME_LIMIT_SEC timers.
 */

import { Prisma } from '@prisma/client';
import {
  QUIZ_QUESTION_COUNT,
  QUIZ_QUESTION_TIME_LIMIT_SEC,
} from '../constants/quiz.constants';
import type {
  QuestionChallengeAnswer,
  QuestionChallengeMode,
  QuestionChallengeQuestion,
  QuestionChallengeSessionDto,
  QuestionChallengeSubmitResult,
} from '../types/questions-challenges.types';

export type QuestionsGameSessionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type QuestionRecordStatus = 'answered' | 'expired';

export interface QuestionAnswerRecord {
  status: QuestionRecordStatus;
  selectedIds: string[];
  isCorrect: boolean;
  completionPercentage: number;
  pointsEarned: number;
  timeExpired: boolean;
  answeredAt: string;
  attempts: number;
}

export interface QuestionsSessionFinalResult {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  expiredQuestions: number;
  totalScore: number;
}

export interface QuestionsSessionProgress {
  sessionStatus: QuestionsGameSessionStatus;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  questionExpiresAt: string | null;
  byQuestionId: Record<string, QuestionAnswerRecord>;
  finalResult?: QuestionsSessionFinalResult;
}

export class QuestionsSessionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'QuestionsSessionError';
  }
}

const TIMER_MS = QUIZ_QUESTION_TIME_LIMIT_SEC * 1000;

const CLIENT_SCORE_KEYS = ['score', 'totalScore', 'correctAnswers', 'finalScore'] as const;

/** Strip client-provided score fields — the server never trusts them. */
export function rejectClientScoreFields(body: Record<string, unknown>): void {
  for (const key of CLIENT_SCORE_KEYS) {
    if (key in body && body[key] !== undefined && body[key] !== null) {
      throw new QuestionsSessionError(
        `Client must not send ${key}`,
        'QUESTIONS_SESSION_CLIENT_SCORE_REJECTED',
      );
    }
  }
}

export function emptySessionProgress(): QuestionsSessionProgress {
  return {
    sessionStatus: 'NOT_STARTED',
    currentQuestionIndex: 0,
    questionStartedAt: null,
    questionExpiresAt: null,
    byQuestionId: {},
  };
}

function isAnswerRecord(value: unknown): value is QuestionAnswerRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.status === 'answered' || record.status === 'expired';
}

/** Parse answeredPayload, preserving legacy flat selectedIds when present. */
export function parseSessionProgress(raw: unknown): QuestionsSessionProgress {
  if (!raw || typeof raw !== 'object') return emptySessionProgress();
  const payload = raw as Record<string, unknown>;

  const byQuestionId: Record<string, QuestionAnswerRecord> = {};
  const rawByQuestion = payload.byQuestionId;
  if (rawByQuestion && typeof rawByQuestion === 'object') {
    for (const [questionId, value] of Object.entries(rawByQuestion as Record<string, unknown>)) {
      if (isAnswerRecord(value)) {
        byQuestionId[questionId] = value;
        continue;
      }
      // Legacy shape from pre-session builds.
      if (value && typeof value === 'object') {
        const legacy = value as Record<string, unknown>;
        if (Array.isArray(legacy.selectedIds)) {
          byQuestionId[questionId] = {
            status: 'answered',
            selectedIds: legacy.selectedIds.map(String),
            isCorrect: Boolean(legacy.isCorrect),
            completionPercentage: Number(legacy.completionPercentage) || 0,
            pointsEarned: legacy.isCorrect ? 1 : 0,
            timeExpired: false,
            answeredAt: new Date().toISOString(),
            attempts: Number(legacy.attempts) || 1,
          };
        }
      }
    }
  }

  const sessionStatus =
    payload.sessionStatus === 'IN_PROGRESS' ||
    payload.sessionStatus === 'COMPLETED' ||
    payload.sessionStatus === 'NOT_STARTED'
      ? payload.sessionStatus
      : Object.keys(byQuestionId).length > 0
        ? 'IN_PROGRESS'
        : 'NOT_STARTED';

  const currentQuestionIndex =
    typeof payload.currentQuestionIndex === 'number' && payload.currentQuestionIndex >= 0
      ? payload.currentQuestionIndex
      : 0;

  return {
    sessionStatus,
    currentQuestionIndex,
    questionStartedAt:
      typeof payload.questionStartedAt === 'string' ? payload.questionStartedAt : null,
    questionExpiresAt:
      typeof payload.questionExpiresAt === 'string' ? payload.questionExpiresAt : null,
    byQuestionId,
    finalResult:
      payload.finalResult && typeof payload.finalResult === 'object'
        ? (payload.finalResult as QuestionsSessionFinalResult)
        : undefined,
  };
}

export function sessionProgressToJson(progress: QuestionsSessionProgress): Prisma.InputJsonValue {
  return progress as unknown as Prisma.InputJsonValue;
}

function questionAtIndex(
  questions: QuestionChallengeQuestion[],
  index: number,
): QuestionChallengeQuestion | null {
  return questions[index] ?? null;
}

function isQuestionClosed(record: QuestionAnswerRecord | undefined): boolean {
  return record?.status === 'answered' || record?.status === 'expired';
}

function nextUnansweredQuestionIndex(
  progress: QuestionsSessionProgress,
  questions: QuestionChallengeQuestion[],
): number {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question) continue;
    if (!isQuestionClosed(progress.byQuestionId[question.id])) {
      return index;
    }
  }
  return questions.length;
}

function isSessionCompleted(progress: QuestionsSessionProgress): boolean {
  return progress.sessionStatus === 'COMPLETED';
}

/** Remove grading secrets before sending a question to the client. */
export function sanitizeQuestionForClient(
  question: QuestionChallengeQuestion,
): Omit<QuestionChallengeQuestion, 'answer'> {
  const { answer: _answer, ...rest } = question;
  return rest;
}

export function computeFinalResult(
  progress: QuestionsSessionProgress,
  questions: QuestionChallengeQuestion[],
  evaluatePoints: (questionId: string, record: QuestionAnswerRecord) => number,
): QuestionsSessionFinalResult {
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let expiredQuestions = 0;
  let totalScore = 0;

  for (const question of questions) {
    const record = progress.byQuestionId[question.id];
    if (!record) continue;
    if (record.status === 'expired') {
      expiredQuestions += 1;
      continue;
    }
    if (record.isCorrect) {
      correctAnswers += 1;
    } else {
      wrongAnswers += 1;
    }
    totalScore += evaluatePoints(question.id, record);
  }

  return {
    totalQuestions: questions.length,
    correctAnswers,
    wrongAnswers,
    expiredQuestions,
    totalScore,
  };
}

function startTimerForIndex(progress: QuestionsSessionProgress, now: Date): void {
  progress.questionStartedAt = now.toISOString();
  progress.questionExpiresAt = new Date(now.getTime() + TIMER_MS).toISOString();
}

function markQuestionExpired(
  progress: QuestionsSessionProgress,
  questionId: string,
  now: Date,
): void {
  const existing = progress.byQuestionId[questionId];
  if (existing && isQuestionClosed(existing)) return;

  progress.byQuestionId[questionId] = {
    status: 'expired',
    selectedIds: [],
    isCorrect: false,
    completionPercentage: 0,
    pointsEarned: 0,
    timeExpired: true,
    answeredAt: now.toISOString(),
    attempts: existing?.attempts ?? 0,
  };
}

/**
 * Auto-advance every expired current question. Called on session GET and before
 * grading so reconnect after 20s lands on the next question with a fresh timer.
 */
export function advanceExpiredQuestions(
  progress: QuestionsSessionProgress,
  questions: QuestionChallengeQuestion[],
  now: Date,
  evaluatePoints?: (questionId: string, record: QuestionAnswerRecord) => number,
): boolean {
  if (progress.sessionStatus === 'COMPLETED') return false;
  if (!questions.length) return false;

  let changed = false;

  while (progress.currentQuestionIndex < questions.length) {
    const current = questionAtIndex(questions, progress.currentQuestionIndex);
    if (!current) break;

    const record = progress.byQuestionId[current.id];
    if (isQuestionClosed(record)) {
      if (progress.currentQuestionIndex >= questions.length - 1) {
        progress.sessionStatus = 'COMPLETED';
        progress.questionStartedAt = null;
        progress.questionExpiresAt = null;
        if (evaluatePoints) {
          progress.finalResult = computeFinalResult(progress, questions, evaluatePoints);
        }
        changed = true;
        break;
      }
      progress.currentQuestionIndex += 1;
      changed = true;
      continue;
    }

    if (!progress.questionExpiresAt) {
      progress.sessionStatus = 'IN_PROGRESS';
      startTimerForIndex(progress, now);
      changed = true;
      break;
    }

    const expiresMs = Date.parse(progress.questionExpiresAt);
    if (Number.isNaN(expiresMs) || now.getTime() < expiresMs) {
      break;
    }

    markQuestionExpired(progress, current.id, now);

    if (progress.currentQuestionIndex >= questions.length - 1) {
      progress.sessionStatus = 'COMPLETED';
      progress.currentQuestionIndex = questions.length;
      progress.questionStartedAt = null;
      progress.questionExpiresAt = null;
      if (evaluatePoints) {
        progress.finalResult = computeFinalResult(progress, questions, evaluatePoints);
      }
      changed = true;
      break;
    }

    progress.currentQuestionIndex += 1;
    startTimerForIndex(progress, now);
    changed = true;
  }

  return changed;
}

/** Begin or resume an in-progress session, starting the timer when needed. */
export function ensureSessionStarted(
  progress: QuestionsSessionProgress,
  questions: QuestionChallengeQuestion[],
  now: Date,
): void {
  if (isSessionCompleted(progress)) return;
  if (!questions.length) return;

  if (progress.sessionStatus === 'NOT_STARTED') {
    progress.sessionStatus = 'IN_PROGRESS';
  }

  advanceExpiredQuestions(progress, questions, now);

  if (isSessionCompleted(progress)) return;

  const nextIndex = nextUnansweredQuestionIndex(progress, questions);
  const currentIndex = nextIndex < questions.length ? nextIndex : progress.currentQuestionIndex;
  if (progress.currentQuestionIndex !== currentIndex) {
    progress.currentQuestionIndex = currentIndex;
  }

  const current = questionAtIndex(questions, progress.currentQuestionIndex);
  if (!current) return;

  const record = progress.byQuestionId[current.id];
  if (isQuestionClosed(record)) {
    advanceExpiredQuestions(progress, questions, now);
    return;
  }

  if (!progress.questionStartedAt || !progress.questionExpiresAt) {
    startTimerForIndex(progress, now);
  }
}

export function getCurrentQuestionId(
  progress: QuestionsSessionProgress,
  questions: QuestionChallengeQuestion[],
): string | null {
  if (isSessionCompleted(progress)) return null;
  const current = questionAtIndex(questions, progress.currentQuestionIndex);
  return current?.id ?? null;
}

export function currentQuestionNumber(progress: QuestionsSessionProgress): number {
  if (isSessionCompleted(progress)) {
    return QUIZ_QUESTION_COUNT;
  }
  return Math.min(progress.currentQuestionIndex + 1, QUIZ_QUESTION_COUNT);
}

export interface BuildSessionViewParams {
  mode: QuestionChallengeMode;
  challenge: {
    id: string;
    title: string;
    description: string;
    image: string;
    icon: string;
    difficulty: QuestionChallengeSessionDto['difficulty'];
    xpReward: number;
    refreshDate: string;
    refreshTime: string;
    streakContribution: boolean;
    leaderboardEligibility: boolean;
    content: QuestionChallengeSessionDto['content'];
  };
  questions: QuestionChallengeQuestion[];
  progress: QuestionsSessionProgress;
  progressMeta: {
    attempts: number;
    completed: boolean;
    score: number;
    elapsedTime: number;
    completionPercentage: number;
    unlocked: boolean;
  };
  now: Date;
}

/** Build the mobile-facing session payload (no correct answers exposed). */
export function buildSessionView(params: BuildSessionViewParams): QuestionChallengeSessionDto {
  const { challenge, questions, progress, progressMeta, now } = params;
  const currentIndex = progress.currentQuestionIndex;
  const current = questionAtIndex(questions, currentIndex);
  const sanitizedQuestions = questions.map(sanitizeQuestionForClient);

  const content = {
    ...(challenge.content as unknown as Record<string, unknown>),
    questions: sanitizedQuestions,
    timer: QUIZ_QUESTION_TIME_LIMIT_SEC,
  } as QuestionChallengeSessionDto['content'];

  return {
    challengeId: challenge.id,
    type: params.mode,
    title: challenge.title,
    description: challenge.description,
    image: challenge.image,
    icon: challenge.icon,
    difficulty: challenge.difficulty,
    xpReward: challenge.xpReward,
    refreshDate: challenge.refreshDate,
    refreshTime: challenge.refreshTime,
    completionState: progressMeta.completed
      ? 'completed'
      : progressMeta.unlocked
        ? 'available'
        : 'locked',
    completionPercentage: progressMeta.completionPercentage,
    unlockState: progressMeta.unlocked,
    streakContribution: challenge.streakContribution,
    leaderboardEligibility: challenge.leaderboardEligibility,
    content,
    attempts: progressMeta.attempts,
    completed: progressMeta.completed,
    score: progressMeta.completed ? progressMeta.score : 0,
    elapsedTime: progressMeta.elapsedTime,
    status: progress.sessionStatus,
    currentQuestion: currentQuestionNumber(progress),
    totalQuestions: questions.length,
    question: current ? sanitizeQuestionForClient(current) : undefined,
    questionStartedAt: progress.questionStartedAt ?? undefined,
    questionExpiresAt: progress.questionExpiresAt ?? undefined,
    serverNow: now.toISOString(),
    timeLimitSec: QUIZ_QUESTION_TIME_LIMIT_SEC,
    currentQuestionIndex: currentIndex,
    finalResult: progress.finalResult,
  };
}

export interface SubmitAnswerContext {
  mode: QuestionChallengeMode;
  questions: QuestionChallengeQuestion[];
  roundAnswer: QuestionChallengeAnswer;
  questionId: string;
  selectedIds: string[];
  now: Date;
  progress: QuestionsSessionProgress;
  evaluate: (
    submittedIds: string[],
    answer: QuestionChallengeAnswer,
  ) => { isCorrect: boolean; completionPercentage: number; score: number };
  resolveAnswer: (questionId: string) => QuestionChallengeAnswer | null;
  evaluatePoints: (questionId: string, record: QuestionAnswerRecord) => number;
}

export interface SubmitAnswerOutcome {
  progress: QuestionsSessionProgress;
  record: QuestionAnswerRecord;
  isCorrect: boolean;
  completionPercentage: number;
  pointsEarned: number;
  timeExpired: boolean;
  idempotent: boolean;
  completed: boolean;
  questionAttempts: number;
}

/**
 * Apply one answer inside a transaction. Enforces sequential flow, timer,
 * idempotency, and completion detection.
 */
export function applyAnswerToSession(ctx: SubmitAnswerContext): SubmitAnswerOutcome {
  const { questions, questionId, selectedIds, now, progress } = ctx;

  const existing = progress.byQuestionId[questionId];
  if (isSessionCompleted(progress) && (existing?.status === 'answered' || existing?.status === 'expired')) {
    return {
      progress,
      record: existing,
      isCorrect: existing.isCorrect,
      completionPercentage: existing.completionPercentage,
      pointsEarned: existing.pointsEarned,
      timeExpired: existing.timeExpired,
      idempotent: true,
      completed: true,
      questionAttempts: existing.attempts,
    };
  }

  if (isSessionCompleted(progress)) {
    throw new QuestionsSessionError('Session already completed', 'QUESTIONS_SESSION_COMPLETED');
  }

  ensureSessionStarted(progress, questions, now);
  advanceExpiredQuestions(progress, questions, now);

  if (isSessionCompleted(progress)) {
    throw new QuestionsSessionError('Session already completed', 'QUESTIONS_SESSION_COMPLETED');
  }

  const targetQuestion = questions.find((entry) => entry.id === questionId) ?? null;
  if (!targetQuestion) {
    throw new QuestionsSessionError(
      'Question not found in this round',
      'QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND',
    );
  }

  if (existing?.status === 'answered') {
    return {
      progress,
      record: existing,
      isCorrect: existing.isCorrect,
      completionPercentage: existing.completionPercentage,
      pointsEarned: existing.pointsEarned,
      timeExpired: existing.timeExpired,
      idempotent: true,
      completed: isSessionCompleted(progress),
      questionAttempts: existing.attempts,
    };
  }

  if (existing?.status === 'expired') {
    throw new QuestionsSessionError(
      'Question already expired',
      'QUESTIONS_SESSION_ALREADY_ANSWERED',
    );
  }

  const expiresMs = progress.questionExpiresAt ? Date.parse(progress.questionExpiresAt) : NaN;
  const timeExpired = !Number.isNaN(expiresMs) && now.getTime() >= expiresMs;

  if (timeExpired) {
    markQuestionExpired(progress, questionId, now);
    if (progress.currentQuestionIndex >= questions.length - 1) {
      progress.sessionStatus = 'COMPLETED';
      progress.currentQuestionIndex = questions.length;
      progress.questionStartedAt = null;
      progress.questionExpiresAt = null;
    } else {
      progress.currentQuestionIndex += 1;
      startTimerForIndex(progress, now);
    }
    throw new QuestionsSessionError(
      'Question time limit exceeded',
      'QUESTIONS_SESSION_TIME_EXPIRED',
    );
  }

  const answer = ctx.resolveAnswer(questionId);
  if (!answer) {
    throw new QuestionsSessionError(
      'Question not found in this round',
      'QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND',
    );
  }

  const evaluation = ctx.evaluate(selectedIds, answer);
  const pointsEarned = evaluation.score;

  const record: QuestionAnswerRecord = {
    status: 'answered',
    selectedIds: [...selectedIds],
    isCorrect: evaluation.isCorrect,
    completionPercentage: evaluation.completionPercentage,
    pointsEarned,
    timeExpired: false,
    answeredAt: now.toISOString(),
    attempts: (existing?.attempts ?? 0) + 1,
  };

  progress.byQuestionId[questionId] = record;

  const answeredCount = questions.filter((q) => isQuestionClosed(progress.byQuestionId[q.id])).length;
  const completionPercentage = Math.round((answeredCount / Math.max(questions.length, 1)) * 100);

  let completed = false;
  if (answeredCount >= questions.length) {
    progress.sessionStatus = 'COMPLETED';
    progress.currentQuestionIndex = questions.length;
    progress.questionStartedAt = null;
    progress.questionExpiresAt = null;
    completed = true;
    progress.finalResult = computeFinalResult(progress, questions, ctx.evaluatePoints);
  } else {
    progress.currentQuestionIndex = nextUnansweredQuestionIndex(progress, questions);
    startTimerForIndex(progress, now);
  }

  return {
    progress,
    record,
    isCorrect: evaluation.isCorrect,
    completionPercentage,
    pointsEarned,
    timeExpired: false,
    idempotent: false,
    completed,
    questionAttempts: record.attempts,
  };
}

export function deriveProgressFields(
  progress: QuestionsSessionProgress,
  questions: QuestionChallengeQuestion[],
  evaluatePoints: (questionId: string, record: QuestionAnswerRecord) => number,
): {
  completed: boolean;
  score: number;
  completionPercentage: number;
} {
  const answeredCount = questions.filter((q) => isQuestionClosed(progress.byQuestionId[q.id])).length;
  const completionPercentage = Math.round((answeredCount / Math.max(questions.length, 1)) * 100);
  const completed = progress.sessionStatus === 'COMPLETED';

  const finalResult =
    progress.finalResult ?? computeFinalResult(progress, questions, evaluatePoints);

  return {
    completed,
    score: finalResult.totalScore,
    completionPercentage: completed ? 100 : completionPercentage,
  };
}

export function buildSubmitResultBase(
  challengeId: string,
  questionId: string,
  outcome: SubmitAnswerOutcome,
  answer: QuestionChallengeAnswer,
  hint: string | null | undefined,
): Pick<
  QuestionChallengeSubmitResult,
  | 'challengeId'
  | 'questionId'
  | 'isCorrect'
  | 'completionPercentage'
  | 'completed'
  | 'score'
  | 'timeExpired'
  | 'pointsEarned'
  | 'answer'
  | 'hint'
> {
  const score = Object.values(outcome.progress.byQuestionId).reduce((total, record) => {
    return total + (record.status === 'answered' ? record.pointsEarned : 0);
  }, 0);

  return {
    challengeId,
    questionId,
    isCorrect: outcome.isCorrect,
    completionPercentage: outcome.completionPercentage,
    completed: outcome.completed,
    score,
    timeExpired: outcome.timeExpired,
    pointsEarned: outcome.pointsEarned,
    answer,
    hint: hint ?? null,
  };
}
