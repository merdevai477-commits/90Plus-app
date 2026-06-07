/**
 * Daily quiz packs: cache, sessions, answers, coins, XP.
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { awardXp, levelTitle } from './xp.service';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { redisCacheService } from './redis-cache.service';
import { generateDailyQuizPack, todayPackDate, packExpiresAt, packDateYmd } from './quiz-generator.service';
import type {
  PublicQuizQuestion,
  QuestionProgress,
  QuizImageLayout,
  QuizLanguage,
  QuizOptionKey,
  QuizQuestionStatus,
  QuizSessionStats,
  QuizTimeoutResult,
  SessionProgress,
  StoredQuizQuestion,
} from '../types/quiz.types';
import { QUIZ_PACK_SIZE } from '../constants/quiz.constants';
import { ensureBackendUser } from '../utils/ensureBackendUser';

export { QUIZ_PACK_SIZE } from '../constants/quiz.constants';
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
  return {
    byQuestionId: p.byQuestionId ?? {},
    completionBonusXp: typeof p.completionBonusXp === 'number' ? p.completionBonusXp : 0,
  };
}

function isTerminalStatus(status?: QuizQuestionStatus): boolean {
  return status === 'answered' || status === 'skipped' || status === 'timed_out';
}

function sanitizePublicImage(q: StoredQuizQuestion): {
  imageUrl: string | null;
  imageLayout: QuizImageLayout;
} {
  if (q.type === 'normal') {
    return { imageUrl: null, imageLayout: 'square' };
  }
  const url = q.imageUrl?.trim();
  return {
    imageUrl: url || null,
    imageLayout: q.imageLayout ?? 'square',
  };
}

function resolvePublicCorrectKey(
  p: QuestionProgress | undefined,
): QuizOptionKey | undefined {
  if (!p) return undefined;
  if (p.status === 'answered' || p.status === 'timed_out') {
    return p.correctKey;
  }
  return undefined;
}

function resolvePublicImageUrl(
  q: StoredQuizQuestion,
  status: string,
  sanitizedUrl: string | null,
): string | null {
  if (status !== 'pending') {
    return sanitizedUrl;
  }
  // Hide spoiler media until the question is answered.
  if (q.type === 'guess_player') {
    return null;
  }
  if (q.type === 'logo' || q.type === 'stadium') {
    return null;
  }
  if (q.imageType === 'team' || q.imageType === 'player') {
    return null;
  }
  return sanitizedUrl;
}

function toPublicQuestions(
  stored: StoredQuizQuestion[],
  progress: SessionProgress,
): PublicQuizQuestion[] {
  return stored.map((q, index) => {
    const p = progress.byQuestionId[q.id];
    const status = p?.status ?? 'pending';
    const { imageUrl: rawUrl, imageLayout } = sanitizePublicImage(q);
    const imageUrl = resolvePublicImageUrl(q, status, rawUrl);
    return {
      id: q.id,
      question: q.question,
      type: q.type,
      options: q.options,
      difficulty: q.difficulty,
      imageUrl,
      imageLayout,
      index: index + 1,
      status,
      selectedKey: p?.selectedKey,
      isCorrect: p?.isCorrect,
      correctKey: resolvePublicCorrectKey(p),
      penaltyApplied: status === 'timed_out' ? p?.penaltyApplied : undefined,
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

const RECENT_PACK_LOOKBACK = 7;

async function loadRecentPackQuestions(
  beforePackDate: Date,
  language: QuizLanguage,
  limit = RECENT_PACK_LOOKBACK,
): Promise<StoredQuizQuestion[]> {
  const rows = await prisma.dailyQuizPack.findMany({
    where: {
      language,
      packDate: { lt: beforePackDate },
    },
    orderBy: { packDate: 'desc' },
    take: limit,
    select: { questions: true },
  });

  const merged: StoredQuizQuestion[] = [];
  for (const row of rows) {
    const qs = row.questions as unknown as StoredQuizQuestion[];
    if (Array.isArray(qs)) merged.push(...qs);
  }
  return merged;
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

function dailyPackLockKey(dateStr: string, language: QuizLanguage): string {
  return `quiz:daily:lock:${dateStr}:${language}`;
}

function isCompletePack(questions: unknown): questions is StoredQuizQuestion[] {
  return Array.isArray(questions) && questions.length === QUIZ_PACK_SIZE;
}

const PACK_READY_POLL_MS = 1_500;
/** Short wait on GET /daily so warmup/background gen can finish before 503. */
const PACK_READY_MAX_WAIT_MS = 20_000;

async function waitForReadyDailyPack(
  language: QuizLanguage,
  packDate: Date,
  timezone: string,
  maxWaitMs = PACK_READY_MAX_WAIT_MS,
): Promise<StoredQuizQuestion[] | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const pack = await loadReadyDailyPack(language, packDate, timezone);
    if (pack) return pack;
    await new Promise((r) => setTimeout(r, PACK_READY_POLL_MS));
  }
  return null;
}

/** Read a complete pack from Redis/DB only — never triggers AI generation. */
async function loadReadyDailyPack(
  language: QuizLanguage,
  packDate = todayPackDate(),
  timezone?: string,
): Promise<StoredQuizQuestion[] | null> {
  const dateStr = packDateYmd(packDate, timezone);
  const cacheKey = `quiz:daily:${dateStr}:${language}`;

  const cached = await redisCacheService.get<StoredQuizQuestion[]>(cacheKey);
  if (isCompletePack(cached)) return cached;

  const existing = await loadPackFromDb(packDate, language);
  if (existing) {
    const questions = existing.questions as unknown as StoredQuizQuestion[];
    if (isCompletePack(questions)) {
      await redisCacheService.set(cacheKey, questions, PACK_CACHE_TTL);
      return questions;
    }
    logger.warn(
      `[QuizDaily] Ignoring incomplete pack ${dateStr}/${language}: ${questions?.length ?? 0}/${QUIZ_PACK_SIZE}`,
    );
  }

  return null;
}

async function isPackGenerationInProgress(
  dateStr: string,
  language: QuizLanguage,
): Promise<boolean> {
  if (!isRedisConnected()) return false;
  try {
    const redis = getRedisClient();
    if (!redis) return false;
    const exists = await redis.exists(dailyPackLockKey(dateStr, language));
    return exists === 1;
  } catch {
    return false;
  }
}

const backgroundPackGenKeys = new Set<string>();

/** Fire-and-forget pack build for cron/warmup or when a user hits GET /daily before packs exist. */
export function scheduleDailyPackGeneration(
  language: QuizLanguage,
  packDate = todayPackDate(),
  timezone?: string,
): void {
  const dateStr = packDateYmd(packDate, timezone);
  const dedupeKey = `${dateStr}:${language}`;
  if (backgroundPackGenKeys.has(dedupeKey)) return;
  backgroundPackGenKeys.add(dedupeKey);

  void getOrCreateDailyPack(language, packDate, timezone)
    .then(() => {
      logger.info(`[QuizDaily] Background pack ready: ${dedupeKey}`);
    })
    .catch((err) => {
      logger.error(`[QuizDaily] Background pack failed (${dedupeKey})`, err);
    })
    .finally(() => {
      backgroundPackGenKeys.delete(dedupeKey);
    });
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
    // We failed to acquire — another worker is generating. Wait long enough to
    // outlast the lock TTL so we don't fall through and regenerate while the
    // holder is still working (the previous 10s cap was shorter than the 30s
    // generation, causing duplicate generation). The caller re-checks cache/DB.
    const pollMs = 500;
    const maxIters = Math.ceil((ttlMs + 2000) / pollMs);
    for (let i = 0; i < maxIters; i++) {
      await new Promise((r) => setTimeout(r, pollMs));
      try {
        const exists = await redis.exists(lockKey);
        if (!exists) break; // Lock released or expired — holder finished.
      } catch {
        break; // Redis hiccup — stop waiting and let the caller re-check.
      }
    }
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
  timezone?: string,
): Promise<StoredQuizQuestion[]> {
  const dateStr = packDateYmd(packDate, timezone);
  const cacheKey = `quiz:daily:${dateStr}:${language}`;
  const lockKey = dailyPackLockKey(dateStr, language);

  const ready = await loadReadyDailyPack(language, packDate, timezone);
  if (ready) return ready;

  // AI + image enrichment can exceed 30s — hold the lock long enough to prevent duplicate builds.
  return withRedisLock(lockKey, 180_000, async () => {
    // Double-check cache and DB inside lock
    const doubleCached = await redisCacheService.get<StoredQuizQuestion[]>(cacheKey);
    if (isCompletePack(doubleCached)) return doubleCached;

    const again = await loadPackFromDb(packDate, language);
    if (again) {
      const q = again.questions as unknown as StoredQuizQuestion[];
      if (isCompletePack(q)) {
        await redisCacheService.set(cacheKey, q, PACK_CACHE_TTL);
        return q;
      }
    }

    const avoidFromHistory = await loadRecentPackQuestions(packDate, language);
    const generated = await generateDailyQuizPack(language, packDate, avoidFromHistory, timezone);
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

function countStats(progress: SessionProgress, pack: StoredQuizQuestion[]): QuizSessionStats {
  let correct = 0;
  let answered = 0;
  let skipped = 0;
  let timedOut = 0;
  // Seed with the persisted session-level completion bonus so it's included in
  // xpEarned after a reload (per-question xp is added below).
  let xp = progress.completionBonusXp ?? 0;
  for (const q of pack) {
    const p = progress.byQuestionId[q.id];
    if (!p) continue;
    if (p.status === 'answered') {
      answered++;
      if (p.isCorrect) correct++;
      xp += p.xpAwarded ?? 0;
    } else if (p.status === 'skipped') {
      skipped++;
    } else if (p.status === 'timed_out') {
      timedOut++;
    }
  }
  return {
    correct,
    answered,
    skipped,
    timedOut,
    closed: answered + skipped + timedOut,
    xp,
  };
}

function computeCurrentIndex(progress: SessionProgress, pack: StoredQuizQuestion[]) {
  let firstPendingIndex = 0;
  for (let i = 0; i < pack.length; i++) {
    const st = progress.byQuestionId[pack[i].id]?.status;
    if (!isTerminalStatus(st)) {
      firstPendingIndex = i;
      break;
    }
    if (i === pack.length - 1) firstPendingIndex = pack.length;
  }
  return firstPendingIndex;
}

function isQuizComplete(progress: SessionProgress, pack: StoredQuizQuestion[]): boolean {
  return pack.every((q) => isTerminalStatus(progress.byQuestionId[q.id]?.status));
}

export async function getDailyQuizForUser(
  clerkUserId: string,
  languageInput: string | undefined,
  timezone: string,
) {
  const user = await ensureBackendUser(clerkUserId);

  const settings = (user.settings ?? {}) as Record<string, unknown>;
  const settingsLang =
    typeof settings.language === 'string' ? settings.language : undefined;
  const language = normalizeLang(languageInput ?? settingsLang ?? 'ar');

  const packDate = todayPackDate(timezone);
  const dateStr = packDateYmd(packDate, timezone);
  let pack = await loadReadyDailyPack(language, packDate, timezone);

  if (!pack) {
    const generating = await isPackGenerationInProgress(dateStr, language);
    if (!generating) {
      scheduleDailyPackGeneration(language, packDate, timezone);
    }
    pack = await waitForReadyDailyPack(language, packDate, timezone);
    if (!pack) {
      throw new Error('PACK_GENERATING');
    }
  }

  const session = await getOrCreateSession(user.id, packDate, language);
  const progress = parseProgress(session.progress);

  const questions = toPublicQuestions(pack, progress);
  const pendingIndex = questions.findIndex((q) => q.status === 'pending');
  const stats = countStats(progress, pack);
  const allDone = isQuizComplete(progress, pack);

  if (allDone && !session.completedAt) {
    await prisma.userDailyQuizSession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
    });
  }

  return {
    language,
    packDate: packDateYmd(packDate, timezone),
    expiresAt: packExpiresAt(packDate, timezone).toISOString(),
    timeLimitSec: QUIZ_TIME_LIMIT_SEC,
    totalQuestions: QUIZ_PACK_SIZE,
    coinCost: QUIZ_COIN_COST,
    currentIndex: pendingIndex >= 0 ? pendingIndex : questions.length,
    questions,
    coins: user.coins,
    xp: user.xp,
    level: user.level,
    stats: {
      correct: stats.correct,
      answered: stats.answered,
      skipped: stats.skipped,
      timedOut: stats.timedOut,
      closed: stats.closed,
      xpEarned: stats.xp,
      completed: allDone || Boolean(session.completedAt),
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
  const packDate = todayPackDate(timezone);
  const pack = await loadReadyDailyPack(language, packDate, timezone);
  if (!pack?.length) throw new Error('QUESTION_NOT_FOUND');
  const question = findQuestion(pack, questionId);
  if (!question) throw new Error('QUESTION_NOT_FOUND');

  if (timeTaken > QUIZ_TIME_LIMIT_SEC) {
    throw new Error('TIME_LIMIT_EXCEEDED');
  }

  // Verify selectedKey is valid A/B/C/D
  if (!['A', 'B', 'C', 'D'].includes(selectedKey)) {
    throw new Error('INVALID_SELECTED_KEY');
  }

  // Find user inside transaction to ensure atomic read-modify-write
  const result = await prisma.$transaction(async (tx) => {
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
    if (
      existing?.status === 'answered' ||
      existing?.status === 'skipped' ||
      existing?.status === 'timed_out'
    ) {
      const stats = countStats(progress, pack);
      return {
        alreadyDone: true,
        isCorrect: existing.isCorrect ?? false,
        correctKey: question.correctKey,
        imageUrl:
          question.type === 'guess_player' && question.imageUrl
            ? question.imageUrl
            : undefined,
        xpAwarded: existing.xpAwarded ?? 0,
        coins: user.coins,
        xp: user.xp,
        level: user.level,
        stats,
        completed: isQuizComplete(progress, pack),
        currentIndex: computeCurrentIndex(progress, pack),
        progress: progress.byQuestionId,
      };
    }

    const isCorrect = question.correctKey === selectedKey;
    const hintOrSkip = existing?.hintUsed === true;

    progress.byQuestionId[questionId] = {
      status: 'answered',
      selectedKey,
      isCorrect,
      correctKey: question.correctKey,
      hintUsed: existing?.hintUsed,
      timeTaken,
      xpAwarded: 0,
      answeredAt: new Date().toISOString(),
    };

    const stats = countStats(progress, pack);
    const allDone = isQuizComplete(progress, pack);

    let coinsAfter = user.coins;
    let coinsDeducted = 0;
    if (!isCorrect) {
      coinsDeducted = Math.min(user.coins, QUIZ_COIN_COST);
      if (coinsDeducted > 0) {
        coinsAfter = user.coins - coinsDeducted;
        await tx.user.update({
          where: { id: user.id },
          data: { coins: coinsAfter },
        });
        await tx.coinTransaction.create({
          data: {
            userId: user.id,
            amount: -coinsDeducted,
            type: 'SPEND',
            description: `quiz_wrong:${questionId}`,
          },
        });
      }
    }

    await tx.userDailyQuizSession.update({
      where: { id: activeSession.id },
      data: {
        progress: progress as unknown as Prisma.InputJsonValue,
        correctCount: stats.correct,
        answeredCount: stats.answered,
        skippedCount: stats.skipped,
        xpEarned: stats.xp,
        completedAt: allDone ? new Date() : null,
      },
    });

    return {
      alreadyDone: false,
      isCorrect,
      hintOrSkip,
      userId: user.id,
      sessionId: activeSession.id,
      coins: coinsAfter,
      coinsDeducted,
      xp: user.xp,
      level: user.level,
      stats,
      completed: allDone,
      currentIndex: computeCurrentIndex(progress, pack),
      progress: progress.byQuestionId,
      packSize: pack.length,
    };
  });

  if ('alreadyDone' in result && result.alreadyDone) {
    return {
      isCorrect: result.isCorrect ?? false,
      correctKey: question.correctKey,
      imageUrl:
        question.type === 'guess_player' && question.imageUrl
          ? question.imageUrl
          : undefined,
      xpAwarded: result.xpAwarded ?? 0,
      coins: result.coins,
      xp: result.xp,
      level: result.level,
      stats: result.stats,
      completed: result.completed,
      currentIndex: result.currentIndex,
      progress: result.progress,
    };
  }

  const txResult = result as {
    isCorrect: boolean;
    hintOrSkip: boolean;
    userId: string;
    sessionId: string;
    coins: number;
    coinsDeducted: number;
    xp: number;
    level: number;
    stats: QuizSessionStats;
    completed: boolean;
    currentIndex: number;
    progress: Record<string, QuestionProgress>;
    packSize: number;
  };

  let xpAwarded = 0;
  let newXp = txResult.xp;
  let newLevel = txResult.level;
  const xpEvents: Array<{
    action: string;
    amount: number;
    leveledUp: boolean;
    newLevel: number;
    newTitle?: string;
  }> = [];

  if (txResult.isCorrect && !txResult.hintOrSkip) {
    const xpResult = await awardXp({
      userId: txResult.userId,
      action: 'QUIZ_ANSWER_CORRECT',
      idempotencyKey: `quiz.${packDate}.${questionId}`,
      dailyCap: 50,
      timezone,
    });
    xpAwarded = xpResult.awarded;
    newXp = xpResult.newXp;
    newLevel = xpResult.newLevel;

    if (xpAwarded > 0) {
      xpEvents.push({
        action: 'QUIZ_ANSWER_CORRECT',
        amount: xpAwarded,
        leveledUp: xpResult.leveledUp,
        newLevel: xpResult.newLevel,
        newTitle: xpResult.leveledUp ? levelTitle(xpResult.newLevel) : undefined,
      });

      await prisma.$transaction(async (tx) => {
        const session = await tx.userDailyQuizSession.findUnique({
          where: { id: txResult.sessionId },
        });
        if (!session) return;
        const progress = parseProgress(session.progress);
        const entry = progress.byQuestionId[questionId];
        if (entry) {
          entry.xpAwarded = xpAwarded;
        }
        const stats = countStats(progress, pack);
        await tx.userDailyQuizSession.update({
          where: { id: txResult.sessionId },
          data: {
            progress: progress as unknown as Prisma.InputJsonValue,
            xpEarned: stats.xp,
          },
        });
      });
    }
  }

  let completionBonusXp = 0;
  if (txResult.completed && txResult.packSize > 0) {
    const accuracy = txResult.stats.correct / txResult.packSize;
    if (accuracy >= 0.8) {
      const bonusResult = await awardXp({
        userId: txResult.userId,
        action: 'QUIZ_COMPLETED_HIGH',
        idempotencyKey: `quiz.complete.${packDate}.${language}`,
        timezone,
      });
      completionBonusXp = bonusResult.awarded;
      newXp = bonusResult.newXp;
      newLevel = bonusResult.newLevel;
      if (completionBonusXp > 0) {
        xpEvents.push({
          action: 'QUIZ_COMPLETED_HIGH',
          amount: completionBonusXp,
          leveledUp: bonusResult.leveledUp,
          newLevel: bonusResult.newLevel,
          newTitle: bonusResult.leveledUp ? levelTitle(bonusResult.newLevel) : undefined,
        });

        // Persist the bonus into the session so stats.xpEarned reflects it after
        // a reload (it isn't attached to any single question's xpAwarded).
        await prisma.$transaction(async (tx) => {
          const session = await tx.userDailyQuizSession.findUnique({
            where: { id: txResult.sessionId },
          });
          if (!session) return;
          const progress = parseProgress(session.progress);
          progress.completionBonusXp = (progress.completionBonusXp ?? 0) + completionBonusXp;
          const stats = countStats(progress, pack);
          await tx.userDailyQuizSession.update({
            where: { id: txResult.sessionId },
            data: {
              progress: progress as unknown as Prisma.InputJsonValue,
              xpEarned: stats.xp,
            },
          });
        });
      }
    }
  }

  const sessionAfter = await prisma.userDailyQuizSession.findUnique({
    where: { id: txResult.sessionId },
    select: { progress: true },
  });
  const finalStats = countStats(parseProgress(sessionAfter!.progress), pack);

  const revealImage =
    question.imageUrl &&
    (question.type === 'guess_player' ||
      question.type === 'logo' ||
      question.type === 'stadium' ||
      question.imageType === 'team' ||
      question.imageType === 'player');

  return {
    isCorrect: txResult.isCorrect,
    correctKey: question.correctKey,
    imageUrl: revealImage ? question.imageUrl : undefined,
    coinsDeducted: !txResult.isCorrect ? txResult.coinsDeducted : 0,
    xpAwarded,
    xpEvents,
    coins: txResult.coins,
    xp: newXp,
    level: newLevel,
    stats: {
      ...finalStats,
      xpEarned: finalStats.xp + completionBonusXp,
    },
    completed: txResult.completed,
    currentIndex: txResult.currentIndex,
    progress: txResult.progress,
  };
}

export async function skipQuizQuestion(
  clerkUserId: string,
  questionId: string,
  timezone: string,
  languageInput?: string,
) {
  const language = normalizeLang(languageInput);
  const packDate = todayPackDate(timezone);
  const pack = await loadReadyDailyPack(language, packDate, timezone);
  if (!pack?.length || !findQuestion(pack, questionId)) throw new Error('QUESTION_NOT_FOUND');

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
    if (existing?.status === 'answered' || existing?.status === 'timed_out') {
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
    const allDone = isQuizComplete(progress, pack);

    await tx.userDailyQuizSession.update({
      where: { id: activeSession.id },
      data: {
        progress: progress as unknown as Prisma.InputJsonValue,
        correctCount: stats.correct,
        answeredCount: stats.answered,
        skippedCount: stats.skipped,
        xpEarned: stats.xp,
        completedAt: allDone ? new Date() : null,
      },
    });

    return {
      coins: newCoins,
      skipped: true,
      stats,
      completed: allDone,
      currentIndex: computeCurrentIndex(progress, pack),
      progress: progress.byQuestionId,
    };
  });
}

export async function useQuizHint(
  clerkUserId: string,
  questionId: string,
  timezone: string,
  languageInput?: string,
) {
  const language = normalizeLang(languageInput);
  const packDate = todayPackDate(timezone);
  const pack = await loadReadyDailyPack(language, packDate, timezone);
  if (!pack?.length) throw new Error('QUESTION_NOT_FOUND');
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
    if (
      existing.status === 'answered' ||
      existing.status === 'skipped' ||
      existing.status === 'timed_out'
    ) {
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
      progress: progress.byQuestionId,
    };
  });
}

export async function timeoutQuizQuestion(
  clerkUserId: string,
  questionId: string,
  timezone: string,
  languageInput?: string,
): Promise<QuizTimeoutResult> {
  const language = normalizeLang(languageInput);
  const packDate = todayPackDate(timezone);
  const pack = await loadReadyDailyPack(language, packDate, timezone);
  if (!pack?.length) throw new Error('QUESTION_NOT_FOUND');
  const question = findQuestion(pack, questionId);
  if (!question) throw new Error('QUESTION_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { clerkUserId },
      select: { id: true, coins: true },
    });
    if (!user) throw new Error('USER_NOT_FOUND');

    const session = await tx.userDailyQuizSession.findUnique({
      where: { userId_packDate_language: { userId: user.id, packDate, language } },
    });

    const activeSession =
      session ??
      (await tx.userDailyQuizSession.create({
        data: {
          userId: user.id,
          packDate,
          language,
          progress: emptyProgress() as unknown as Prisma.InputJsonValue,
        },
      }));

    const progress = parseProgress(activeSession.progress);
    const existing = progress.byQuestionId[questionId];

    if (isTerminalStatus(existing?.status)) {
      const stats = countStats(progress, pack);
      const result: QuizTimeoutResult = {
        penaltyApplied: existing?.penaltyApplied ?? false,
        alreadyDone: true,
        coins: user.coins,
        stats,
        completed: isQuizComplete(progress, pack),
        currentIndex: computeCurrentIndex(progress, pack),
        progress: progress.byQuestionId,
      };
      if (existing?.status === 'answered' || existing?.status === 'timed_out') {
        result.correctKey = existing?.correctKey ?? question.correctKey;
        if (question.type === 'guess_player' && question.imageUrl) {
          result.imageUrl = question.imageUrl;
        }
      }
      return result;
    }

    const penaltyApplied = false;
    const newCoins = user.coins;

    progress.byQuestionId[questionId] = {
      status: 'timed_out',
      isCorrect: false,
      correctKey: question.correctKey,
      xpAwarded: 0,
      penaltyApplied,
      timedOutAt: new Date().toISOString(),
    };

    const stats = countStats(progress, pack);
    const allDone = isQuizComplete(progress, pack);

    await tx.userDailyQuizSession.update({
      where: { id: activeSession.id },
      data: {
        progress: progress as unknown as Prisma.InputJsonValue,
        correctCount: stats.correct,
        answeredCount: stats.answered,
        skippedCount: stats.skipped,
        xpEarned: stats.xp,
        completedAt: allDone ? new Date() : null,
      },
    });

    const result: QuizTimeoutResult = {
      correctKey: question.correctKey,
      imageUrl:
        question.type === 'guess_player' && question.imageUrl
          ? question.imageUrl
          : undefined,
      penaltyApplied,
      coins: newCoins,
      stats,
      completed: allDone,
      currentIndex: computeCurrentIndex(progress, pack),
      progress: progress.byQuestionId,
    };

    return result;
  });
}
