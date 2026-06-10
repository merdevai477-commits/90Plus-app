/**
 * Session-aware metric recording (shown once per user per question).
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import type { QuizLanguage, StoredQuizQuestion, SessionProgress } from '../types/quiz.types';
import {
  recordQuestionShown,
  recordCorrectAnswer,
  recordWrongAnswer,
  recordQuestionSkip,
  recordQuestionHint,
  type QuestionMetricKey,
} from './quiz-question-metrics.service';

function metricKeyFromQuestion(
  question: StoredQuizQuestion,
  packDate: Date,
  language: QuizLanguage,
): QuestionMetricKey {
  return {
    questionId: question.id,
    packDate,
    language,
    questionType: question.type,
    difficulty: question.difficulty,
  };
}

async function markMetricsShownInSession(
  sessionId: string,
  questionId: string,
  progress: SessionProgress,
): Promise<void> {
  const entry = progress.byQuestionId[questionId] ?? { status: 'pending' as const };
  if (entry.metricsShown) return;

  entry.metricsShown = true;
  progress.byQuestionId[questionId] = entry;

  await prisma.userDailyQuizSession.update({
    where: { id: sessionId },
    data: { progress: progress as unknown as Prisma.InputJsonValue },
  });
}

export async function trackQuestionShownForSession(
  sessionId: string | undefined,
  question: StoredQuizQuestion,
  packDate: Date,
  language: QuizLanguage,
  progress: SessionProgress,
): Promise<void> {
  const entry = progress.byQuestionId[question.id];
  if (entry?.metricsShown) return;

  await recordQuestionShown(metricKeyFromQuestion(question, packDate, language));

  if (sessionId) {
    await markMetricsShownInSession(sessionId, question.id, progress);
  }
}

export async function trackQuizAnswerMetric(
  question: StoredQuizQuestion,
  packDate: Date,
  language: QuizLanguage,
  isCorrect: boolean,
  timeTakenSec: number,
  sessionId: string | undefined,
  progress: SessionProgress,
): Promise<void> {
  await trackQuestionShownForSession(sessionId, question, packDate, language, progress);
  const key = metricKeyFromQuestion(question, packDate, language);
  if (isCorrect) {
    await recordCorrectAnswer(key, timeTakenSec);
  } else {
    await recordWrongAnswer(key, timeTakenSec);
  }
}

export async function trackQuizSkipMetric(
  question: StoredQuizQuestion,
  packDate: Date,
  language: QuizLanguage,
  sessionId: string | undefined,
  progress: SessionProgress,
): Promise<void> {
  await trackQuestionShownForSession(sessionId, question, packDate, language, progress);
  await recordQuestionSkip(metricKeyFromQuestion(question, packDate, language));
}

export async function trackQuizHintMetric(
  question: StoredQuizQuestion,
  packDate: Date,
  language: QuizLanguage,
  sessionId: string | undefined,
  progress: SessionProgress,
): Promise<void> {
  await trackQuestionShownForSession(sessionId, question, packDate, language, progress);
  await recordQuestionHint(metricKeyFromQuestion(question, packDate, language));
}

export async function trackQuizTimeoutMetric(
  question: StoredQuizQuestion,
  packDate: Date,
  language: QuizLanguage,
  timeTakenSec: number,
  sessionId: string | undefined,
  progress: SessionProgress,
): Promise<void> {
  await trackQuestionShownForSession(sessionId, question, packDate, language, progress);
  await recordWrongAnswer(metricKeyFromQuestion(question, packDate, language), timeTakenSec);
}
