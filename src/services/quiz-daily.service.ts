/**
 * Daily quiz packs: cache, sessions, answers, coins, XP.
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { getOrSetWithLock } from '../lib/cache-mutex';
import { redisCacheService } from './redis-cache.service';
import { generateDailyQuizPack, todayPackDate, packExpiresAt, packDateYmd } from './quiz-generator.service';
import { awardXp } from './xp.service';
import type {
  PublicQuizQuestion,
  QuestionProgress,
  QuizLanguage,
  QuizOptionKey,
  SessionProgress,
  StoredQuizQuestion,
} from '../types/quiz.types';

export const QUIZ_PACK_SIZE = 20;
export const QUIZ_COIN_COST = 10;
export const QUIZ_TIME_LIMIT_SEC = 20;
const PACK_CACHE_TTL = 25 * 60 * 60 * 1000;

function normalizeLang(raw?: string): QuizLanguage {
  return raw === 'en' ? 'en' : 'ar';
}

function emptyProgress(): SessionProgress {
  return { byQuestionId: {} };
}

function parseProgress(raw: unknown): SessionProgress {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  const p = raw as SessionProgress;
  return { byQuestionId: p.byQuestionId ?? {} };
}

function toPublicQuestions(
  stored: StoredQuizQuestion[],
  progress: SessionProgress,
): PublicQuizQuestion[] {
  return stored.map((q, index) => {
    const p = progress.byQuestionId[q.id];
    return {
      id: q.id,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
      imageUrl: q.imageUrl ?? null,
      imageLayout: q.imageLayout ?? 'square',
      index: index + 1,
      status: p?.status ?? 'pending',
      selectedKey: p?.selectedKey,
      isCorrect: p?.isCorrect,
      hintUsed: p?.hintUsed,
    };
  });
}

async function loadPackFromDb(packDate: Date, language: QuizLanguage) {
  return prisma.dailyQuizPack.findUnique({
    where: {
      packDate_language: { packDate, language },
    },
  });
}

async function savePack(
  packDate: Date,
  language: QuizLanguage,
  questions: StoredQuizQuestion[],
  expiresAt: Date,
) {
  const row = await prisma.dailyQuizPack.upsert({
    where: { packDate_language: { packDate, language } },
    create: {
      packDate,
      language,
      questions: questions as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      questions: questions as unknown as Prisma.InputJsonValue,
      expiresAt,
    },
  });
  const cacheKey = `quiz:pack:${packDateYmd(packDate)}:${language}`;
  await redisCacheService.set(cacheKey, questions, PACK_CACHE_TTL);
  return row;
}

export async function getOrCreateDailyPack(
  language: QuizLanguage,
  packDate = todayPackDate(),
): Promise<StoredQuizQuestion[]> {
  const cacheKey = `quiz:pack:${packDateYmd(packDate)}:${language}`;
  const cached = await redisCacheService.get<StoredQuizQuestion[]>(cacheKey);
  if (cached?.length === QUIZ_PACK_SIZE) return cached;

  const existing = await loadPackFromDb(packDate, language);
  if (existing) {
    const questions = existing.questions as unknown as StoredQuizQuestion[];
    await redisCacheService.set(cacheKey, questions, PACK_CACHE_TTL);
    return questions;
  }

  return getOrSetWithLock(cacheKey, async () => {
    const again = await loadPackFromDb(packDate, language);
    if (again) {
      return again.questions as unknown as StoredQuizQuestion[];
    }
    const generated = await generateDailyQuizPack(language, packDate);
    await savePack(packDate, language, generated.questions, generated.expiresAt);
    return generated.questions;
  }, PACK_CACHE_TTL);
}

export async function ensureDailyPacksForToday(): Promise<void> {
  const packDate = todayPackDate();
  for (const language of ['ar', 'en'] as QuizLanguage[]) {
    try {
      await getOrCreateDailyPack(language, packDate);
      logger.info(`[QuizDaily] Pack ready: ${packDateYmd(packDate)} ${language}`);
    } catch (err) {
      logger.error(`[QuizDaily] Pack generation failed (${language})`, err);
    }
  }
}

async function getOrCreateSession(userId: string, packDate: Date, language: QuizLanguage) {
  return prisma.userDailyQuizSession.upsert({
    where: {
      userId_packDate_language: { userId, packDate, language },
    },
    create: {
      userId,
      packDate,
      language,
      progress: emptyProgress() as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });
}

async function updateSession(
  sessionId: string,
  data: {
    progress: SessionProgress;
    correctCount: number;
    answeredCount: number;
    skippedCount: number;
    xpEarned: number;
    completedAt?: Date | null;
  },
) {
  return prisma.userDailyQuizSession.update({
    where: { id: sessionId },
    data: {
      progress: data.progress as unknown as Prisma.InputJsonValue,
      correctCount: data.correctCount,
      answeredCount: data.answeredCount,
      skippedCount: data.skippedCount,
      xpEarned: data.xpEarned,
      completedAt: data.completedAt,
    },
  });
}

function findQuestion(pack: StoredQuizQuestion[], questionId: string) {
  return pack.find((q) => q.id === questionId);
}

function countStats(progress: SessionProgress, pack: StoredQuizQuestion[]) {
  let correct = 0;
  let answered = 0;
  let skipped = 0;
  let xp = 0;
  for (const q of pack) {
    const p = progress.byQuestionId[q.id];
    if (!p) continue;
    if (p.status === 'answered') {
      answered++;
      if (p.isCorrect) correct++;
      xp += p.xpAwarded ?? 0;
    } else if (p.status === 'skipped') skipped++;
  }
  return { correct, answered, skipped, xp };
}

async function deductCoins(
  userId: string,
  amount: number,
  description: string,
): Promise<{ ok: boolean; coins: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });
  if (!user || user.coins < amount) {
    return { ok: false, coins: user?.coins ?? 0 };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { coins: { decrement: amount } },
      select: { coins: true },
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: 'SPEND',
        description,
      },
    });
    return u;
  });

  return { ok: true, coins: updated.coins };
}

export async function getDailyQuizForUser(
  clerkUserId: string,
  languageInput: string | undefined,
  timezone: string,
) {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, coins: true, xp: true, level: true, settings: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  const settings = (user.settings ?? {}) as Record<string, unknown>;
  const settingsLang =
    typeof settings.language === 'string' ? settings.language : undefined;
  const language = normalizeLang(languageInput ?? settingsLang ?? 'ar');

  const packDate = todayPackDate();
  const pack = await getOrCreateDailyPack(language, packDate);
  const session = await getOrCreateSession(user.id, packDate, language);
  const progress = parseProgress(session.progress);

  const questions = toPublicQuestions(pack, progress);
  const pendingIndex = questions.findIndex((q) => q.status === 'pending');

  return {
    language,
    packDate: packDateYmd(packDate),
    expiresAt: packExpiresAt(packDate).toISOString(),
    timeLimitSec: QUIZ_TIME_LIMIT_SEC,
    totalQuestions: QUIZ_PACK_SIZE,
    coinCost: QUIZ_COIN_COST,
    currentIndex: pendingIndex >= 0 ? pendingIndex : questions.length,
    questions,
    coins: user.coins,
    xp: user.xp,
    level: user.level,
    stats: {
      correct: session.correctCount,
      answered: session.answeredCount,
      skipped: session.skippedCount,
      xpEarned: session.xpEarned,
      completed: Boolean(session.completedAt),
    },
    timezone,
  };
}

export async function submitQuizAnswer(
  clerkUserId: string,
  questionId: string,
  selectedKey: QuizOptionKey,
  timeTaken: number,
  timezone: string,
  languageInput?: string,
) {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, coins: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  const language = normalizeLang(languageInput);
  const packDate = todayPackDate();
  const pack = await getOrCreateDailyPack(language, packDate);
  const question = findQuestion(pack, questionId);
  if (!question) throw new Error('QUESTION_NOT_FOUND');

  const session = await getOrCreateSession(user.id, packDate, language);
  const progress = parseProgress(session.progress);
  const existing = progress.byQuestionId[questionId];
  if (existing?.status === 'answered' || existing?.status === 'skipped') {
    return { alreadyDone: true, ...existing };
  }

  const isCorrect = question.correctKey === selectedKey;
  let xpAwarded = 0;
  const xpEvents: Array<{ action: string; amount: number; leveledUp: boolean; newLevel: number }> = [];

  const hintOrSkip = existing?.hintUsed === true;
  if (isCorrect && !hintOrSkip) {
    const xpResult = await awardXp({
      userId: user.id,
      action: 'QUIZ_ANSWER_CORRECT',
      idempotencyKey: `quiz:answer:${packDateYmd(packDate)}:${language}:${questionId}`,
      dailyCap: 50,
      timezone,
      metadata: { questionId, language },
    });
    xpAwarded = xpResult.awarded;
    if (xpAwarded > 0) {
      xpEvents.push({
        action: 'QUIZ_ANSWER_CORRECT',
        amount: xpAwarded,
        leveledUp: xpResult.leveledUp,
        newLevel: xpResult.newLevel,
      });
    }
  }

  progress.byQuestionId[questionId] = {
    status: 'answered',
    selectedKey,
    isCorrect,
    hintUsed: existing?.hintUsed,
    timeTaken,
    xpAwarded,
  };

  const stats = countStats(progress, pack);
  const allDone = pack.every((q) => {
    const st = progress.byQuestionId[q.id]?.status;
    return st === 'answered' || st === 'skipped';
  });

  let completionXp = 0;
  if (allDone) {
    const pct = stats.correct / pack.length;
    if (pct >= 0.8) {
      const bonus = await awardXp({
        userId: user.id,
        action: 'QUIZ_COMPLETED_HIGH',
        idempotencyKey: `quiz:complete80:${packDateYmd(packDate)}:${language}`,
        timezone,
      });
      completionXp = bonus.awarded;
      if (completionXp > 0) {
        xpEvents.push({
          action: 'QUIZ_COMPLETED_HIGH',
          amount: completionXp,
          leveledUp: bonus.leveledUp,
          newLevel: bonus.newLevel,
        });
      }
    }
    stats.xp += completionXp;
  }

  await updateSession(session.id, {
    progress,
    correctCount: stats.correct,
    answeredCount: stats.answered,
    skippedCount: stats.skipped,
    xpEarned: stats.xp,
    completedAt: allDone ? new Date() : null,
  });

  const freshUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { coins: true, xp: true, level: true },
  });

  return {
    isCorrect,
    correctKey: question.correctKey,
    xpAwarded,
    xpEvents,
    coins: freshUser?.coins ?? user.coins,
    xp: freshUser?.xp ?? 0,
    level: freshUser?.level ?? 1,
    stats,
    completed: allDone,
  };
}

export async function skipQuizQuestion(
  clerkUserId: string,
  questionId: string,
  timezone: string,
  languageInput?: string,
) {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, coins: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  const language = normalizeLang(languageInput);
  const packDate = todayPackDate();
  const pack = await getOrCreateDailyPack(language, packDate);
  if (!findQuestion(pack, questionId)) throw new Error('QUESTION_NOT_FOUND');

  const session = await getOrCreateSession(user.id, packDate, language);
  const progress = parseProgress(session.progress);
  const existing = progress.byQuestionId[questionId];
  if (existing?.status === 'answered' || existing?.status === 'skipped') {
    return { alreadyDone: true, coins: user.coins };
  }

  const coinResult = await deductCoins(
    user.id,
    QUIZ_COIN_COST,
    `quiz_skip:${questionId}`,
  );
  if (!coinResult.ok) throw new Error('INSUFFICIENT_COINS');

  progress.byQuestionId[questionId] = {
    status: 'skipped',
    xpAwarded: 0,
  };

  const stats = countStats(progress, pack);
  const allDone = pack.every((q) => {
    const st = progress.byQuestionId[q.id]?.status;
    return st === 'answered' || st === 'skipped';
  });

  await updateSession(session.id, {
    progress,
    correctCount: stats.correct,
    answeredCount: stats.answered,
    skippedCount: stats.skipped,
    xpEarned: stats.xp,
    completedAt: allDone ? new Date() : null,
  });

  return {
    coins: coinResult.coins,
    skipped: true,
    stats,
    completed: allDone,
  };
}

export async function useQuizHint(
  clerkUserId: string,
  questionId: string,
  languageInput?: string,
) {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, coins: true },
  });
  if (!user) throw new Error('USER_NOT_FOUND');

  const language = normalizeLang(languageInput);
  const packDate = todayPackDate();
  const pack = await getOrCreateDailyPack(language, packDate);
  const question = findQuestion(pack, questionId);
  if (!question) throw new Error('QUESTION_NOT_FOUND');

  const session = await getOrCreateSession(user.id, packDate, language);
  const progress = parseProgress(session.progress);
  const existing = progress.byQuestionId[questionId] ?? { status: 'pending' as const };

  if (existing.hintUsed) {
    return { hint: question.hint ?? '', coins: user.coins, alreadyUsed: true };
  }
  if (existing.status === 'answered' || existing.status === 'skipped') {
    throw new Error('QUESTION_CLOSED');
  }

  const coinResult = await deductCoins(
    user.id,
    QUIZ_COIN_COST,
    `quiz_hint:${questionId}`,
  );
  if (!coinResult.ok) throw new Error('INSUFFICIENT_COINS');

  progress.byQuestionId[questionId] = {
    status: 'pending',
    hintUsed: true,
    xpAwarded: 0,
  };

  await updateSession(session.id, {
    progress,
    correctCount: session.correctCount,
    answeredCount: session.answeredCount,
    skippedCount: session.skippedCount,
    xpEarned: session.xpEarned,
    completedAt: session.completedAt,
  });

  return {
    hint: question.hint ?? '',
    coins: coinResult.coins,
    hintUsed: true,
  };
}
