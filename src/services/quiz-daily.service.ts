/**
 * Daily quiz packs: cache, sessions, answers, coins, XP.
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { getRedisClient, isRedisConnected } from '../lib/redis';
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
      type: q.type,
      options: q.options,
      difficulty: q.difficulty,
      imageUrl: q.imageUrl ?? null,
      imageLayout: q.imageLayout ?? 'square',
      index: index + 1,
      status: p?.status ?? 'pending',
      selectedKey: p?.selectedKey,
      isCorrect: p?.isCorrect,
      hintUsed: p?.hintUsed,
      hint: p?.hintUsed ? (q.hint ?? null) : null,
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
  const cacheKey = `quiz:daily:${packDateYmd(packDate)}:${language}`;
  await redisCacheService.set(cacheKey, questions, PACK_CACHE_TTL);
  return row;
}

async function withRedisLock<T>(
  lockKey: string,
  ttlMs: number,
  task: () => Promise<T>
): Promise<T> {
  let acquired = false;
  let redis = null;
  
  if (isRedisConnected()) {
    try {
      redis = getRedisClient();
      if (redis) {
        // SETNX with EX to acquire a distributed lock
        const result = await redis.set(lockKey, 'locked', 'PX', ttlMs, 'NX');
        if (result === 'OK') {
          acquired = true;
        }
      }
    } catch (err) {
      logger.warn(`Redis lock error for ${lockKey}`, err);
    }
  }

  if (isRedisConnected() && redis && !acquired) {
    // If we failed to acquire, wait for it to be released or expire, polling gently
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const exists = await redis.exists(lockKey);
      if (!exists) {
        break; // Lock released or expired, we can try proceeding
      }
    }
    // We don't re-acquire here, we assume the initial lock holder finished and cached the result.
    // The caller function will check the cache again.
  }

  try {
    return await task();
  } finally {
    if (acquired && redis) {
      await redis.del(lockKey).catch(err => logger.warn('Failed to release lock', err));
    }
  }
}

export async function getOrCreateDailyPack(
  language: QuizLanguage,
  packDate = todayPackDate(),
): Promise<StoredQuizQuestion[]> {
  const dateStr = packDateYmd(packDate);
  const cacheKey = `quiz:daily:${dateStr}:${language}`;
  const lockKey = `quiz:daily:lock:${dateStr}:${language}`;
  
  const cached = await redisCacheService.get<StoredQuizQuestion[]>(cacheKey);
  if (cached?.length === QUIZ_PACK_SIZE) return cached;

  const existing = await loadPackFromDb(packDate, language);
  if (existing) {
    const questions = existing.questions as unknown as StoredQuizQuestion[];
    await redisCacheService.set(cacheKey, questions, PACK_CACHE_TTL);
    return questions;
  }

  return withRedisLock(lockKey, 30000, async () => {
    // Double-check cache and DB inside lock
    const doubleCached = await redisCacheService.get<StoredQuizQuestion[]>(cacheKey);
    if (doubleCached?.length === QUIZ_PACK_SIZE) return doubleCached;
    
    const again = await loadPackFromDb(packDate, language);
    if (again) {
      const q = again.questions as unknown as StoredQuizQuestion[];
      await redisCacheService.set(cacheKey, q, PACK_CACHE_TTL);
      return q;
    }
    
    const generated = await generateDailyQuizPack(language, packDate);
    await savePack(packDate, language, generated.questions, generated.expiresAt);
    return generated.questions;
  });
}

export async function warmupDailyQuizzes(): Promise<void> {
  const packDate = todayPackDate();
  for (const language of ['ar', 'en'] as QuizLanguage[]) {
    try {
      await getOrCreateDailyPack(language, packDate);
      logger.info(`[QuizDaily] Warmup successful: ${packDateYmd(packDate)} ${language}`);
    } catch (err) {
      logger.error(`[QuizDaily] Warmup failed (${language})`, err);
    }
  }
}

export async function ensureDailyPacksForToday(): Promise<void> {
  await warmupDailyQuizzes();
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

function computeCurrentIndex(progress: SessionProgress, pack: StoredQuizQuestion[]) {
  let firstPendingIndex = 0;
  for (let i = 0; i < pack.length; i++) {
    const st = progress.byQuestionId[pack[i].id]?.status;
    if (st !== 'answered' && st !== 'skipped') {
      firstPendingIndex = i;
      break;
    }
    if (i === pack.length - 1) firstPendingIndex = pack.length;
  }
  return firstPendingIndex;
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
  const language = normalizeLang(languageInput);
  const packDate = todayPackDate();
  const pack = await getOrCreateDailyPack(language, packDate);
  const question = findQuestion(pack, questionId);
  if (!question) throw new Error('QUESTION_NOT_FOUND');

  // Verify selectedKey is valid A/B/C/D
  if (!['A', 'B', 'C', 'D'].includes(selectedKey)) {
    throw new Error('INVALID_SELECTED_KEY');
  }

  // Find user inside transaction to ensure atomic read-modify-write
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { clerkUserId },
      select: { id: true, coins: true, xp: true, level: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const session = await tx.userDailyQuizSession.findUnique({
      where: { userId_packDate_language: { userId: user.id, packDate, language } }
    });
    
    // If no session, create one inline
    const activeSession = session ?? await tx.userDailyQuizSession.create({
      data: { userId: user.id, packDate, language, progress: emptyProgress() as unknown as Prisma.InputJsonValue }
    });

    const progress = parseProgress(activeSession.progress);
    const existing = progress.byQuestionId[questionId];

    // Idempotency check
    if (existing?.status === 'answered' || existing?.status === 'skipped') {
      return { 
        alreadyDone: true, 
        isCorrect: existing.isCorrect, 
        correctKey: question.correctKey, 
        xpAwarded: existing.xpAwarded ?? 0, 
        coins: user.coins, 
        xp: user.xp, 
        level: user.level,
        completed: false,
        currentIndex: computeCurrentIndex(progress, pack),
        progress: progress.byQuestionId
      };
    }

    const isCorrect = question.correctKey === selectedKey;
    const hintOrSkip = existing?.hintUsed === true;
    
    // Inline XP granting logic for QUIZ_ANSWER_CORRECT to make it atomic
    let xpAwarded = 0;
    let newXp = user.xp;
    if (isCorrect && !hintOrSkip) {
      // Very simple inline XP award logic for answer correctness
      xpAwarded = 2; // Fixed 2 XP per correct answer
      newXp += xpAwarded;
      
      await tx.user.update({
        where: { id: user.id },
        data: { xp: newXp }
      });
      // Optionally create XP event log if needed, simplified here
    }

    progress.byQuestionId[questionId] = {
      status: 'answered',
      selectedKey,
      isCorrect,
      correctKey: question.correctKey,
      hintUsed: existing?.hintUsed,
      timeTaken,
      xpAwarded,
      answeredAt: new Date().toISOString(),
    };

    const stats = countStats(progress, pack);
    const allDone = pack.every((q) => {
      const st = progress.byQuestionId[q.id]?.status;
      return st === 'answered' || st === 'skipped';
    });

    await tx.userDailyQuizSession.update({
      where: { id: activeSession.id },
      data: {
        progress: progress as unknown as Prisma.InputJsonValue,
        correctCount: stats.correct,
        answeredCount: stats.answered,
        skippedCount: stats.skipped,
        xpEarned: stats.xp,
        completedAt: allDone ? new Date() : null,
      }
    });

    return {
      isCorrect,
      correctKey: question.correctKey,
      xpAwarded,
      coins: user.coins,
      xp: newXp,
      level: user.level,
      stats,
      completed: allDone,
      currentIndex: computeCurrentIndex(progress, pack),
      progress: progress.byQuestionId
    };
  });
}

export async function skipQuizQuestion(
  clerkUserId: string,
  questionId: string,
  timezone: string,
  languageInput?: string,
) {
  const language = normalizeLang(languageInput);
  const packDate = todayPackDate();
  const pack = await getOrCreateDailyPack(language, packDate);
  if (!findQuestion(pack, questionId)) throw new Error('QUESTION_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { clerkUserId },
      select: { id: true, coins: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const session = await tx.userDailyQuizSession.findUnique({
      where: { userId_packDate_language: { userId: user.id, packDate, language } }
    });
    
    const activeSession = session ?? await tx.userDailyQuizSession.create({
      data: { userId: user.id, packDate, language, progress: emptyProgress() as unknown as Prisma.InputJsonValue }
    });

    const progress = parseProgress(activeSession.progress);
    const existing = progress.byQuestionId[questionId];
    
    if (existing?.status === 'skipped') {
      return { 
        alreadyDone: true, 
        coins: user.coins, 
        skipped: true,
        currentIndex: computeCurrentIndex(progress, pack),
        progress: progress.byQuestionId
      };
    }
    if (existing?.status === 'answered') {
      throw new Error('QUESTION_ALREADY_ANSWERED');
    }

    if (user.coins < QUIZ_COIN_COST) {
      throw new Error('INSUFFICIENT_COINS');
    }

    // Deduct coins atomically
    const newCoins = user.coins - QUIZ_COIN_COST;
    await tx.user.update({
      where: { id: user.id },
      data: { coins: newCoins }
    });
    await tx.coinTransaction.create({
      data: { userId: user.id, amount: -QUIZ_COIN_COST, type: 'SPEND', description: `quiz_skip:${questionId}` }
    });

    progress.byQuestionId[questionId] = {
      status: 'skipped',
      xpAwarded: 0,
      skipped: true,
      skippedAt: new Date().toISOString(),
    };

    const stats = countStats(progress, pack);
    const allDone = pack.every((q) => {
      const st = progress.byQuestionId[q.id]?.status;
      return st === 'answered' || st === 'skipped';
    });

    await tx.userDailyQuizSession.update({
      where: { id: activeSession.id },
      data: {
        progress: progress as unknown as Prisma.InputJsonValue,
        correctCount: stats.correct,
        answeredCount: stats.answered,
        skippedCount: stats.skipped,
        xpEarned: stats.xp,
        completedAt: allDone ? new Date() : null,
      }
    });

    return {
      coins: newCoins,
      skipped: true,
      stats,
      completed: allDone,
      currentIndex: computeCurrentIndex(progress, pack),
      progress: progress.byQuestionId
    };
  });
}

export async function useQuizHint(
  clerkUserId: string,
  questionId: string,
  languageInput?: string,
) {
  const language = normalizeLang(languageInput);
  const packDate = todayPackDate();
  const pack = await getOrCreateDailyPack(language, packDate);
  const question = findQuestion(pack, questionId);
  if (!question) throw new Error('QUESTION_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { clerkUserId },
      select: { id: true, coins: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const session = await tx.userDailyQuizSession.findUnique({
      where: { userId_packDate_language: { userId: user.id, packDate, language } }
    });
    
    const activeSession = session ?? await tx.userDailyQuizSession.create({
      data: { userId: user.id, packDate, language, progress: emptyProgress() as unknown as Prisma.InputJsonValue }
    });

    const progress = parseProgress(activeSession.progress);
    const existing = progress.byQuestionId[questionId] ?? { status: 'pending' as const };

    if (existing.hintUsed) {
      return { 
        hint: question.hint ?? '', 
        coins: user.coins, 
        alreadyUsed: true,
        currentIndex: computeCurrentIndex(progress, pack),
        progress: progress.byQuestionId
      };
    }
    if (existing.status === 'answered' || existing.status === 'skipped') {
      throw new Error('QUESTION_CLOSED');
    }

    if (user.coins < QUIZ_COIN_COST) {
      throw new Error('INSUFFICIENT_COINS');
    }

    const newCoins = user.coins - QUIZ_COIN_COST;
    await tx.user.update({
      where: { id: user.id },
      data: { coins: newCoins }
    });
    await tx.coinTransaction.create({
      data: { userId: user.id, amount: -QUIZ_COIN_COST, type: 'SPEND', description: `quiz_hint:${questionId}` }
    });

    progress.byQuestionId[questionId] = {
      status: 'pending',
      hintUsed: true,
      xpAwarded: 0,
    };

    await tx.userDailyQuizSession.update({
      where: { id: activeSession.id },
      data: {
        progress: progress as unknown as Prisma.InputJsonValue,
      }
    });

    return {
      hint: question.hint ?? '',
      coins: newCoins,
      hintUsed: true,
      currentIndex: computeCurrentIndex(progress, pack),
      progress: progress.byQuestionId
    };
  });
}
