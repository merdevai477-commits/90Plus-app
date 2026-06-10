/**
 * Admin-facing quiz analytics aggregations.
 */

import prisma from '../lib/prisma';
import type { QuizLanguage } from '../types/quiz.types';
import {
  calculateQuestionQuality,
  type QuestionQualityBreakdown,
} from './quiz-question-quality.service';

export interface RankedQuestionMetric {
  questionId: string;
  packDate: string;
  language: string;
  questionType: string | null;
  difficulty: string | null;
  shownCount: number;
  correctCount: number;
  wrongCount: number;
  skipCount: number;
  hintCount: number;
  quality: QuestionQualityBreakdown;
}

export interface TypePerformanceRow {
  questionType: string;
  totalShown: number;
  totalCorrect: number;
  totalWrong: number;
  avgQualityScore: number;
  questionCount: number;
}

export interface DifficultyTimingRow {
  difficulty: string;
  avgAnswerTimeMs: number;
  answeredCount: number;
  correctRate: number;
}

function mapMetricRow(row: {
  questionId: string;
  packDate: Date;
  language: string;
  questionType: string | null;
  difficulty: string | null;
  shownCount: number;
  correctCount: number;
  wrongCount: number;
  skipCount: number;
  hintCount: number;
  totalAnswerTimeMs: bigint;
}): RankedQuestionMetric {
  const quality = calculateQuestionQuality({
    shownCount: row.shownCount,
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    skipCount: row.skipCount,
    hintCount: row.hintCount,
    totalAnswerTimeMs: row.totalAnswerTimeMs,
  });

  return {
    questionId: row.questionId,
    packDate: row.packDate.toISOString().slice(0, 10),
    language: row.language,
    questionType: row.questionType,
    difficulty: row.difficulty,
    shownCount: row.shownCount,
    correctCount: row.correctCount,
    wrongCount: row.wrongCount,
    skipCount: row.skipCount,
    hintCount: row.hintCount,
    quality,
  };
}

export interface QuizAnalyticsFilters {
  language?: QuizLanguage;
  packDateFrom?: Date;
  packDateTo?: Date;
  minShown?: number;
  limit?: number;
}

function buildWhere(filters: QuizAnalyticsFilters) {
  const where: {
    language?: string;
    packDate?: { gte?: Date; lte?: Date };
    shownCount?: { gte: number };
  } = {};

  if (filters.language) where.language = filters.language;
  if (filters.packDateFrom || filters.packDateTo) {
    where.packDate = {};
    if (filters.packDateFrom) where.packDate.gte = filters.packDateFrom;
    if (filters.packDateTo) where.packDate.lte = filters.packDateTo;
  }
  if (filters.minShown != null) where.shownCount = { gte: filters.minShown };

  return where;
}

export async function getHardestQuestions(
  filters: QuizAnalyticsFilters = {},
): Promise<RankedQuestionMetric[]> {
  const limit = filters.limit ?? 20;
  const rows = await prisma.quizQuestionMetric.findMany({
    where: buildWhere({ ...filters, minShown: filters.minShown ?? 5 }),
    orderBy: [{ correctCount: 'asc' }, { wrongCount: 'desc' }],
    take: limit,
  });
  return rows.map(mapMetricRow);
}

export async function getEasiestQuestions(
  filters: QuizAnalyticsFilters = {},
): Promise<RankedQuestionMetric[]> {
  const limit = filters.limit ?? 20;
  const rows = await prisma.quizQuestionMetric.findMany({
    where: buildWhere({ ...filters, minShown: filters.minShown ?? 5 }),
    orderBy: [{ correctCount: 'desc' }, { wrongCount: 'asc' }],
    take: limit,
  });
  return rows.map(mapMetricRow);
}

export async function getMostSkippedQuestions(
  filters: QuizAnalyticsFilters = {},
): Promise<RankedQuestionMetric[]> {
  const limit = filters.limit ?? 20;
  const rows = await prisma.quizQuestionMetric.findMany({
    where: buildWhere(filters),
    orderBy: { skipCount: 'desc' },
    take: limit,
  });
  return rows.map(mapMetricRow);
}

export async function getMostHintedQuestions(
  filters: QuizAnalyticsFilters = {},
): Promise<RankedQuestionMetric[]> {
  const limit = filters.limit ?? 20;
  const rows = await prisma.quizQuestionMetric.findMany({
    where: buildWhere(filters),
    orderBy: { hintCount: 'desc' },
    take: limit,
  });
  return rows.map(mapMetricRow);
}

export async function getTypePerformance(
  filters: QuizAnalyticsFilters = {},
): Promise<TypePerformanceRow[]> {
  const rows = await prisma.quizQuestionMetric.groupBy({
    by: ['questionType'],
    where: {
      ...buildWhere(filters),
      questionType: { not: null },
    },
    _sum: {
      shownCount: true,
      correctCount: true,
      wrongCount: true,
    },
    _count: { _all: true },
  });

  const detailed = await prisma.quizQuestionMetric.findMany({
    where: {
      ...buildWhere(filters),
      questionType: { not: null },
    },
    select: {
      questionType: true,
      shownCount: true,
      correctCount: true,
      wrongCount: true,
      skipCount: true,
      hintCount: true,
      totalAnswerTimeMs: true,
    },
  });

  const qualityByType = new Map<string, number[]>();
  for (const row of detailed) {
    if (!row.questionType) continue;
    const q = calculateQuestionQuality(row);
    const arr = qualityByType.get(row.questionType) ?? [];
    arr.push(q.qualityScore);
    qualityByType.set(row.questionType, arr);
  }

  return rows
    .filter((r) => r.questionType)
    .map((r) => {
      const scores = qualityByType.get(r.questionType!) ?? [];
      const avgQuality =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
      return {
        questionType: r.questionType!,
        totalShown: r._sum.shownCount ?? 0,
        totalCorrect: r._sum.correctCount ?? 0,
        totalWrong: r._sum.wrongCount ?? 0,
        avgQualityScore: avgQuality,
        questionCount: r._count._all,
      };
    })
    .sort((a, b) => b.avgQualityScore - a.avgQualityScore);
}

export async function getAvgAnswerTimeByDifficulty(
  filters: QuizAnalyticsFilters = {},
): Promise<DifficultyTimingRow[]> {
  const rows = await prisma.quizQuestionMetric.groupBy({
    by: ['difficulty'],
    where: {
      ...buildWhere(filters),
      difficulty: { not: null },
    },
    _sum: {
      totalAnswerTimeMs: true,
      correctCount: true,
      wrongCount: true,
    },
  });

  return rows
    .filter((r) => r.difficulty)
    .map((r) => {
      const answered = (r._sum.correctCount ?? 0) + (r._sum.wrongCount ?? 0);
      const totalMs = Number(r._sum.totalAnswerTimeMs ?? 0n);
      return {
        difficulty: r.difficulty!,
        avgAnswerTimeMs: answered > 0 ? Math.round(totalMs / answered) : 0,
        answeredCount: answered,
        correctRate:
          answered > 0
            ? Math.round(((r._sum.correctCount ?? 0) / answered) * 1000) / 1000
            : 0,
      };
    })
    .sort((a, b) => a.difficulty.localeCompare(b.difficulty));
}
