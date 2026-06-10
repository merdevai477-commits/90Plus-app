/**
 * Atomic cross-user metrics for daily quiz questions.
 */

import prisma from '../lib/prisma';
import type { QuizLanguage, QuizDifficulty, QuizQuestionType } from '../types/quiz.types';
import { logger } from '../utils/logger';

export interface QuestionMetricKey {
  questionId: string;
  packDate: Date;
  language: QuizLanguage;
  questionType?: QuizQuestionType;
  difficulty?: QuizDifficulty;
}

type MetricIncrement = Partial<{
  shownCount: number;
  correctCount: number;
  wrongCount: number;
  skipCount: number;
  hintCount: number;
  totalAnswerTimeMs: number;
}>;

async function atomicIncrement(
  key: QuestionMetricKey,
  increment: MetricIncrement,
): Promise<void> {
  if (Object.values(increment).every((v) => !v)) return;

  const createData = {
    questionId: key.questionId,
    packDate: key.packDate,
    language: key.language,
    questionType: key.questionType ?? null,
    difficulty: key.difficulty ?? null,
    shownCount: increment.shownCount ?? 0,
    correctCount: increment.correctCount ?? 0,
    wrongCount: increment.wrongCount ?? 0,
    skipCount: increment.skipCount ?? 0,
    hintCount: increment.hintCount ?? 0,
    totalAnswerTimeMs: BigInt(increment.totalAnswerTimeMs ?? 0),
  };

  const updateData: Record<string, unknown> = {};
  if (increment.shownCount) updateData.shownCount = { increment: increment.shownCount };
  if (increment.correctCount) updateData.correctCount = { increment: increment.correctCount };
  if (increment.wrongCount) updateData.wrongCount = { increment: increment.wrongCount };
  if (increment.skipCount) updateData.skipCount = { increment: increment.skipCount };
  if (increment.hintCount) updateData.hintCount = { increment: increment.hintCount };
  if (increment.totalAnswerTimeMs) {
    updateData.totalAnswerTimeMs = { increment: BigInt(increment.totalAnswerTimeMs) };
  }

  try {
    await prisma.quizQuestionMetric.upsert({
      where: {
        questionId_packDate_language: {
          questionId: key.questionId,
          packDate: key.packDate,
          language: key.language,
        },
      },
      create: createData,
      update: updateData,
    });
  } catch (err) {
    logger.warn('[QuizMetrics] Failed to record metric', { key, increment, err });
  }
}

export async function recordQuestionShown(key: QuestionMetricKey): Promise<void> {
  await atomicIncrement(key, { shownCount: 1 });
}

export async function recordCorrectAnswer(
  key: QuestionMetricKey,
  timeTakenSec: number,
): Promise<void> {
  const ms = Math.max(0, Math.round(timeTakenSec * 1000));
  await atomicIncrement(key, { correctCount: 1, totalAnswerTimeMs: ms });
}

export async function recordWrongAnswer(
  key: QuestionMetricKey,
  timeTakenSec: number,
): Promise<void> {
  const ms = Math.max(0, Math.round(timeTakenSec * 1000));
  await atomicIncrement(key, { wrongCount: 1, totalAnswerTimeMs: ms });
}

export async function recordQuestionSkip(key: QuestionMetricKey): Promise<void> {
  await atomicIncrement(key, { skipCount: 1 });
}

export async function recordQuestionHint(key: QuestionMetricKey): Promise<void> {
  await atomicIncrement(key, { hintCount: 1 });
}

export async function getQuestionMetric(
  questionId: string,
  packDate: Date,
  language: QuizLanguage,
) {
  return prisma.quizQuestionMetric.findUnique({
    where: {
      questionId_packDate_language: { questionId, packDate, language },
    },
  });
}
