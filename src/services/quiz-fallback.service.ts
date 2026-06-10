/**
 * Production fallback when AI pack generation fails.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import type { QuizLanguage, StoredQuizQuestion } from '../types/quiz.types';
import type { QuizPackGenerationMeta } from '../constants/quiz-generation.constants';
import { QUIZ_PACK_SIZE } from '../constants/quiz.constants';

export function isCompletePack(questions: unknown): questions is StoredQuizQuestion[] {
  return Array.isArray(questions) && questions.length === QUIZ_PACK_SIZE;
}

/** Re-id questions for a new pack date while preserving content. */
export function remapPackQuestionsForDate(
  questions: StoredQuizQuestion[],
  packDateYmd: string,
  language: QuizLanguage,
): StoredQuizQuestion[] {
  return questions.slice(0, QUIZ_PACK_SIZE).map((q, i) => ({
    ...q,
    id: `daily-${packDateYmd}-${language}-${i + 1}`,
  }));
}

export async function loadMostRecentValidPack(
  language: QuizLanguage,
  beforePackDate: Date,
): Promise<{
  packDate: Date;
  questions: StoredQuizQuestion[];
  meta: QuizPackGenerationMeta;
} | null> {
  const rows = await prisma.dailyQuizPack.findMany({
    where: {
      language,
      packDate: { lt: beforePackDate },
    },
    orderBy: { packDate: 'desc' },
    take: 10,
    select: {
      packDate: true,
      questions: true,
      isFallback: true,
      generatorModel: true,
      generatorVersion: true,
      promptVersion: true,
      datasetVersion: true,
    },
  });

  for (const row of rows) {
    const questions = row.questions as unknown as StoredQuizQuestion[];
    if (!isCompletePack(questions)) continue;

    return {
      packDate: row.packDate,
      questions,
      meta: {
        generatorModel: row.generatorModel ?? 'unknown',
        generatorVersion: row.generatorVersion ?? 'unknown',
        promptVersion: row.promptVersion ?? 'unknown',
        datasetVersion: row.datasetVersion ?? 'unknown',
        isFallback: true,
      },
    };
  }

  return null;
}

export function logFallbackUsage(
  language: QuizLanguage,
  targetDateYmd: string,
  sourcePackDate: Date,
): void {
  logger.warn('[QuizFallback] Serving recycled pack', {
    language,
    targetDateYmd,
    sourcePackDate: sourcePackDate.toISOString().slice(0, 10),
  });
}
