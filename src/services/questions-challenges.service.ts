import crypto from 'crypto';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { ensureBackendUser } from '../utils/ensureBackendUser';
import { awardXp } from './xp.service';
import { getOrCreateDailyPack } from './quiz-daily.service';
import { todayPackDate, packDateYmd } from './quiz-generator.service';
import { buildAiQuestionChallenges } from './questions-challenges.ai-generator.service';
import type { AiQuestionsMode } from './questions-challenges.ai-prompt';
import { ROUND_QUESTION_COUNT } from '../constants/quiz.constants';
import type { QuizDifficulty, QuizLanguage, StoredQuizQuestion } from '../types/quiz.types';
import type {
  DailyQuestionChallengeDto,
  GeneratedQuestionChallenge,
  GeneratedQuestionChallengesPayload,
  QuestionChallengeAnswer,
  QuestionChallengeLeaderboardRow,
  QuestionChallengeMode,
  QuestionChallengeQuestion,
  QuestionChallengeSessionDto,
  QuestionChallengeSubmitResult,
  QuestionCrowdStats,
  QuestionsModesSummary,
} from '../types/questions-challenges.types';

const db = prisma as any;

const QUESTIONS_CHALLENGE_CACHE_TTL = 25 * 60 * 60 * 1000;
const QUESTIONS_CHALLENGE_PROGRESS_CACHE_TTL = 2 * 60 * 1000;
const DEFAULT_REFRESH_TIME = '00:00';
const LOOKBACK_DAYS = 7;

/**
 * How many other players must have answered a question before "ask the crowd"
 * will show a split. Below this the sample is too small to mean anything, and
 * the lifeline reports itself unavailable instead of inventing a distribution.
 */
const CROWD_MIN_SAMPLE = 5;

const MODE_TO_DB_TYPE: Record<QuestionChallengeMode, string> = {
  'guess-player': 'GUESS_PLAYER',
  'football-bingo': 'FOOTBALL_BINGO',
  'football-grid': 'FOOTBALL_GRID',
  'player-connections': 'PLAYER_CONNECTIONS',
  'guess-club': 'GUESS_CLUB',
  'transfer-puzzle': 'TRANSFER_PUZZLE',
  'top10-challenge': 'TOP10_CHALLENGE',
  'football-quiz': 'FOOTBALL_QUIZ',
};

const DB_TYPE_TO_MODE = Object.entries(MODE_TO_DB_TYPE).reduce<Record<string, QuestionChallengeMode>>(
  (acc, [mode, dbType]) => {
    acc[dbType] = mode as QuestionChallengeMode;
    return acc;
  },
  {},
);

const MODE_ICON_BY_TYPE: Record<QuestionChallengeMode, string> = {
  'guess-player': 'user',
  'football-bingo': 'grid-3x3',
  'football-grid': 'table',
  'player-connections': 'git-branch',
  'guess-club': 'shield',
  'transfer-puzzle': 'shuffle',
  'top10-challenge': 'list-ordered',
  'football-quiz': 'circle-help',
};

const MODE_TITLE: Record<QuestionChallengeMode, { en: string; ar: string }> = {
  'guess-player': { en: 'Guess The Player', ar: 'خمن اللاعب' },
  'football-bingo': { en: 'Football Bingo', ar: 'بينجو كرة القدم' },
  'football-grid': { en: 'Football Grid', ar: 'شبكة كرة القدم' },
  'player-connections': { en: 'Player Connections', ar: 'اتصالات اللاعبين' },
  'guess-club': { en: 'Guess The Club', ar: 'خمن النادي' },
  'transfer-puzzle': { en: 'Transfer Puzzle', ar: 'ألغاز الانتقالات' },
  'top10-challenge': { en: 'Top 10 Challenge', ar: 'تحدي أفضل 10' },
  'football-quiz': { en: 'Football Quiz', ar: 'أسئلة كرة القدم' },
};

function normalizeLanguage(language?: string): QuizLanguage {
  return language === 'en' ? 'en' : 'ar';
}

function modeFromDbType(type: string): QuestionChallengeMode | null {
  return DB_TYPE_TO_MODE[type] ?? null;
}

function dbTypeFromMode(mode: QuestionChallengeMode): string {
  return MODE_TO_DB_TYPE[mode];
}

function challengeCacheKey(refreshDate: string, language: QuizLanguage): string {
  return `quiz:questions:challenges:${refreshDate}:${language}`;
}

function challengeGenLockKey(refreshDateYmd: string, language: QuizLanguage): string {
  return `quiz:questions:gen-lock:${refreshDateYmd}:${language}`;
}

/**
 * Serializes daily-challenge generation across concurrent requests (the first
 * user to open any mode on a given day would otherwise all trigger the same
 * ~60-120s Gemini call in parallel). Mirrors the lock pattern already used by
 * quiz-daily.service's getOrCreateDailyPack.
 */
async function withChallengeGenLock<T>(lockKey: string, ttlMs: number, task: () => Promise<T>): Promise<T> {
  let acquired = false;
  let redis = null;

  if (isRedisConnected()) {
    try {
      redis = getRedisClient();
      if (redis) {
        const result = await redis.set(lockKey, 'locked', 'PX', ttlMs, 'NX');
        if (result === 'OK') {
          acquired = true;
        }
      }
    } catch (err) {
      logger.warn(`[QuestionsChallenges] Redis lock error for ${lockKey}`, err);
    }
  }

  if (isRedisConnected() && redis && !acquired) {
    // Another request is already generating — wait for it instead of firing a
    // second concurrent Gemini call for the same day/language.
    const pollMs = 500;
    const maxIters = Math.ceil((ttlMs + 2000) / pollMs);
    for (let i = 0; i < maxIters; i++) {
      await new Promise((r) => setTimeout(r, pollMs));
      try {
        const exists = await redis.exists(lockKey);
        if (!exists) break;
      } catch {
        break;
      }
    }
  }

  try {
    return await task();
  } finally {
    if (acquired && redis) {
      await redis.del(lockKey).catch((err) => logger.warn('[QuestionsChallenges] Failed to release lock', err));
    }
  }
}

function challengeProgressCacheKey(userId: string, refreshDate: string, language: QuizLanguage): string {
  return `quiz:questions:progress:${userId}:${refreshDate}:${language}`;
}

function challengeHash(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function normalizeOptionId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizedSet(values: string[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const value of values ?? []) {
    const normalized = normalizeOptionId(value);
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

function evaluateChallengeAnswer(
  mode: QuestionChallengeMode,
  submittedIds: string[],
  answer: QuestionChallengeAnswer,
): { isCorrect: boolean; completionPercentage: number; score: number } {
  const selected = normalizedSet(submittedIds);
  const correct = normalizedSet(answer.correctIds);

  if (mode === 'top10-challenge') {
    const ordered = (answer.orderedIds ?? []).map(normalizeOptionId).filter(Boolean);
    const submitted = submittedIds.map(normalizeOptionId).filter(Boolean);
    const max = Math.max(ordered.length, 1);
    let exact = 0;
    for (let i = 0; i < Math.min(ordered.length, submitted.length); i += 1) {
      if (ordered[i] === submitted[i]) exact += 1;
    }
    const completionPercentage = Math.round((exact / max) * 100);
    return {
      isCorrect: exact === ordered.length && ordered.length > 0,
      completionPercentage,
      score: exact,
    };
  }

  if (mode === 'football-grid' || mode === 'football-bingo') {
    const matched = [...selected].filter((id) => correct.has(id)).length;
    const total = Math.max(correct.size, 1);
    const completionPercentage = Math.round((matched / total) * 100);
    return {
      isCorrect: matched === correct.size && selected.size === correct.size,
      completionPercentage,
      score: matched,
    };
  }

  const matches = [...selected].every((id) => correct.has(id));
  const sameCount = selected.size === correct.size;
  return {
    isCorrect: matches && sameCount,
    completionPercentage: matches && sameCount ? 100 : 0,
    score: matches && sameCount ? 1 : 0,
  };
}

function dailyLeaderboardStart(period: 'daily' | 'weekly' | 'monthly'): Date {
  const now = new Date();
  if (period === 'monthly') {
    now.setMonth(now.getMonth() - 1);
    return now;
  }
  if (period === 'weekly') {
    now.setDate(now.getDate() - 7);
    return now;
  }
  now.setDate(now.getDate() - 1);
  return now;
}

/** XP one Football Quiz question is worth, by the difficulty the AI graded it. */
const FOOTBALL_QUIZ_DIFFICULTY_XP: Record<QuizDifficulty, number> = { EASY: 10, MEDIUM: 15, HARD: 20 };

/**
 * The Football Quiz card. Its questions are the same AI-generated daily pack
 * the quiz tab plays (quiz-generator.service.ts → Gemini/OpenRouter over the
 * real entity dataset), so this mode has no separate content source: it takes
 * the first ROUND_QUESTION_COUNT questions of today's pack.
 */
async function buildFootballQuizChallenge(
  language: QuizLanguage,
  packDate: Date,
  timezone: string,
): Promise<GeneratedQuestionChallenge> {
  const pack = (await getOrCreateDailyPack(language, packDate, timezone)) as StoredQuizQuestion[];
  const source = pack.slice(0, ROUND_QUESTION_COUNT);
  if (source.length === 0) {
    throw new Error('QUESTIONS_CHALLENGE_QUIZ_PACK_UNAVAILABLE');
  }
  // The daily-quiz pipeline keeps a canned pack of its own as a last resort
  // (quiz-static-fallback.service.ts, ids prefixed "static-fallback-"). That is
  // the quiz tab's business; it must not be republished here as a Questions
  // round, or the hub would be serving authored football content again.
  if (source.some((question) => question.id.startsWith('static-fallback-'))) {
    throw new Error('QUESTIONS_CHALLENGE_QUIZ_PACK_NOT_REAL');
  }

  const description =
    language === 'ar'
      ? 'اختبار يومي مكون من أسئلة متعددة الخيارات.'
      : 'Daily football quiz with multiple-choice questions.';

  const questions: QuestionChallengeQuestion[] = source.map((question, index) => ({
    id: `q${index + 1}`,
    difficulty: question.difficulty,
    xpReward: FOOTBALL_QUIZ_DIFFICULTY_XP[question.difficulty],
    prompt: question.question,
    hint: question.hint ?? undefined,
    // Resolved by the pack's own image enricher against the question's entity
    // binding (365Scores / API-Football) — never authored by the model.
    imageUrl: question.imageUrl ?? undefined,
    ...(question.imageBinding
      ? {
          entity: {
            kind: question.imageBinding.kind,
            id: question.imageBinding.entityId ?? question.imageBinding.entityName,
            name: question.imageBinding.entityName,
            imageUrl: question.imageUrl ?? undefined,
          },
        }
      : {}),
    options: question.options.map((option) => ({ id: option.key, label: option.text })),
    answer: { correctIds: [question.correctKey] },
  }));

  const first = questions[0]!;
  const byQuestionId: NonNullable<QuestionChallengeAnswer['byQuestionId']> = {};
  for (const question of questions) byQuestionId[question.id] = question.answer;

  return {
    mode: 'football-quiz',
    difficulty: source.some((q) => q.difficulty === 'HARD')
      ? 'HARD'
      : source.some((q) => q.difficulty === 'MEDIUM')
        ? 'MEDIUM'
        : 'EASY',
    xpReward: questions.reduce((total, question) => total + question.xpReward, 0),
    title: MODE_TITLE['football-quiz'][language],
    description,
    // Hub cards use the app's own per-mode artwork; sending a football photo
    // here would override every card with the same picture.
    image: '',
    icon: MODE_ICON_BY_TYPE['football-quiz'],
    content: {
      title: MODE_TITLE['football-quiz'][language],
      description,
      questions,
      prompt: first.prompt,
      imageUrl: first.imageUrl,
      hint: first.hint,
      options: first.options,
      timer: 20,
    } as GeneratedQuestionChallenge['content'],
    answer: { ...first.answer, byQuestionId },
    metadata: {
      refreshTime: DEFAULT_REFRESH_TIME,
      streakContribution: true,
      leaderboardEligibility: true,
      localized: true,
      source: 'AI',
    },
  };
}

/**
 * Recent prompts per mode, so today's AI call is told what not to repeat.
 * Read off the last week of published rounds — real content, not a bank.
 */
async function recentPromptsByMode(
  language: QuizLanguage,
  refreshDate: Date,
): Promise<Partial<Record<AiQuestionsMode, string[]>>> {
  const since = new Date(refreshDate);
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const rows = await db.dailyQuestionChallenge.findMany({
    where: { language, status: 'PUBLISHED' as any, refreshDate: { gte: since, lt: refreshDate } },
    orderBy: { refreshDate: 'desc' },
    take: 8 * LOOKBACK_DAYS,
    select: { type: true, content: true },
  });

  const out: Partial<Record<AiQuestionsMode, string[]>> = {};
  for (const row of rows as Array<{ type: string; content: any }>) {
    const mode = modeFromDbType(row.type);
    if (!mode || mode === 'football-quiz') continue;
    const questions = Array.isArray(row.content?.questions) ? row.content.questions : [];
    const prompts = questions
      .map((question: any) => (typeof question?.prompt === 'string' ? question.prompt : ''))
      .filter(Boolean);
    if (!prompts.length) continue;
    out[mode as AiQuestionsMode] = [...(out[mode as AiQuestionsMode] ?? []), ...prompts].slice(0, 24);
  }
  return out;
}

async function generateDailyQuestionsModesPayload(
  language: QuizLanguage,
  refreshDate: string,
  avoidPromptsByMode: Partial<Record<AiQuestionsMode, string[]>>,
): Promise<GeneratedQuestionChallengesPayload> {
  const challenges = await buildAiQuestionChallenges(language, refreshDate, { avoidPromptsByMode });

  if (!challenges) {
    // No authored-content fallback here. The caller (ensureDailyChallenges /
    // regenerateDailyQuestionsChallenges) catches this and recycles the most
    // recent real day instead; if there is none, the modes stay unavailable and
    // the app shows its existing error/retry state.
    throw new Error('QUESTIONS_CHALLENGE_AI_UNAVAILABLE');
  }

  const payload: GeneratedQuestionChallengesPayload = {
    language,
    refreshDate,
    refreshTime: DEFAULT_REFRESH_TIME,
    challenges,
  };

  logger.info('[QuestionsChallenges] Built AI rounds', {
    language,
    refreshDate,
    modes: payload.challenges.length,
    questionsPerMode: ROUND_QUESTION_COUNT,
  });

  return payload;
}

function challengeCompletionState(unlocked: boolean, completed: boolean): 'locked' | 'available' | 'completed' {
  if (!unlocked) return 'locked';
  if (completed) return 'completed';
  return 'available';
}

async function persistChallenges(
  language: QuizLanguage,
  refreshDate: Date,
  payload: GeneratedQuestionChallengesPayload,
  footballQuizChallenge: GeneratedQuestionChallenge | null,
): Promise<void> {
  const rows = footballQuizChallenge
    ? [...payload.challenges, footballQuizChallenge]
    : [...payload.challenges];

  await db.$transaction(async (tx: any) => {
    for (const challenge of rows) {
      const dbType = dbTypeFromMode(challenge.mode);
      const contentHash = challengeHash(challenge.content);

      await tx.dailyQuestionChallenge.upsert({
        where: {
          refreshDate_type_language: {
            refreshDate,
            type: dbType as any,
            language,
          },
        },
        create: {
          refreshDate,
          language,
          type: dbType as any,
          status: 'PUBLISHED' as any,
          title: challenge.title,
          description: challenge.description,
          image: challenge.image,
          icon: challenge.icon,
          difficulty: challenge.difficulty,
          xpReward: challenge.xpReward,
          refreshTime: challenge.metadata.refreshTime || DEFAULT_REFRESH_TIME,
          streakContribution: challenge.metadata.streakContribution,
          leaderboardEligibility: challenge.metadata.leaderboardEligibility,
          content: challenge.content as unknown as Prisma.InputJsonValue,
          answer: challenge.answer as unknown as Prisma.InputJsonValue,
          metadata: challenge.metadata as unknown as Prisma.InputJsonValue,
          contentHash,
          source: challenge.metadata.source,
          publishedAt: new Date(),
        },
        update: {
          status: 'PUBLISHED' as any,
          title: challenge.title,
          description: challenge.description,
          image: challenge.image,
          icon: challenge.icon,
          difficulty: challenge.difficulty,
          xpReward: challenge.xpReward,
          refreshTime: challenge.metadata.refreshTime || DEFAULT_REFRESH_TIME,
          streakContribution: challenge.metadata.streakContribution,
          leaderboardEligibility: challenge.metadata.leaderboardEligibility,
          content: challenge.content as unknown as Prisma.InputJsonValue,
          answer: challenge.answer as unknown as Prisma.InputJsonValue,
          metadata: challenge.metadata as unknown as Prisma.InputJsonValue,
          contentHash,
          source: challenge.metadata.source,
          publishedAt: new Date(),
        },
      });
    }
  });
}

async function generateAndPersistDailyChallenges(
  language: QuizLanguage,
  refreshDate: Date,
  timezone: string,
): Promise<void> {
  const refreshDateYmd = packDateYmd(refreshDate, timezone);
  const avoidPromptsByMode = await recentPromptsByMode(language, refreshDate);

  // The Football Quiz card rides on the daily quiz pack, which is generated by
  // a different pipeline. If that pipeline is having a bad day it must not take
  // the other seven modes down with it — the card is simply not published.
  let footballQuizChallenge: GeneratedQuestionChallenge | null = null;
  try {
    footballQuizChallenge = await buildFootballQuizChallenge(language, refreshDate, timezone);
  } catch (err) {
    logger.warn('[QuestionsChallenges] Football Quiz card unavailable today', {
      language,
      refreshDate: refreshDateYmd,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const payload = await generateDailyQuestionsModesPayload(language, refreshDateYmd, avoidPromptsByMode);

  await persistChallenges(language, refreshDate, payload, footballQuizChallenge);
  await redisCacheService.del(challengeCacheKey(refreshDateYmd, language));
  logger.info('[QuestionsChallenges] daily challenges generated', {
    language,
    refreshDate: refreshDateYmd,
    count: payload.challenges.length + (footballQuizChallenge ? 1 : 0),
  });
}

/**
 * Recycle the most recent previously-published day's challenges onto today's
 * refreshDate. Used only when fresh AI generation fails, so a Gemini outage
 * or a single invalid field in the 7-challenge batch never leaves every mode
 * stuck with no session to load (mirrors quiz-daily.service's pack fallback).
 */
async function recycleMostRecentChallenges(
  language: QuizLanguage,
  refreshDate: Date,
  timezone: string,
): Promise<boolean> {
  const since = new Date(refreshDate);
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const previous = await db.dailyQuestionChallenge.findMany({
    where: {
      language,
      status: 'PUBLISHED' as any,
      refreshDate: { gte: since, lt: refreshDate },
    },
    orderBy: { refreshDate: 'desc' },
    take: 8,
    select: {
      type: true,
      title: true,
      description: true,
      image: true,
      icon: true,
      difficulty: true,
      xpReward: true,
      refreshTime: true,
      streakContribution: true,
      leaderboardEligibility: true,
      content: true,
      answer: true,
      source: true,
    },
  });

  if (!previous.length) return false;

  await db.$transaction(async (tx: any) => {
    for (const row of previous as Array<any>) {
      const contentHash = challengeHash(row.content);
      await tx.dailyQuestionChallenge.upsert({
        where: {
          refreshDate_type_language: {
            refreshDate,
            type: row.type,
            language,
          },
        },
        create: {
          refreshDate,
          language,
          type: row.type,
          status: 'PUBLISHED' as any,
          title: row.title,
          description: row.description,
          image: row.image,
          icon: row.icon,
          difficulty: row.difficulty,
          xpReward: row.xpReward,
          refreshTime: row.refreshTime || DEFAULT_REFRESH_TIME,
          streakContribution: row.streakContribution,
          leaderboardEligibility: row.leaderboardEligibility,
          content: row.content as unknown as Prisma.InputJsonValue,
          answer: row.answer as unknown as Prisma.InputJsonValue,
          metadata: { source: row.source ?? 'AI', isFallback: true } as unknown as Prisma.InputJsonValue,
          contentHash,
          source: row.source ?? 'AI',
          publishedAt: new Date(),
        },
        update: {
          status: 'PUBLISHED' as any,
        },
      });
    }
  });

  logger.warn('[QuestionsChallenges] Recycled previous day challenges as fallback', {
    language,
    refreshDate: packDateYmd(refreshDate, timezone),
    count: previous.length,
  });

  return true;
}

async function ensureDailyChallenges(
  language: QuizLanguage,
  refreshDate: Date,
  timezone: string,
): Promise<void> {
  const refreshDateYmd = packDateYmd(refreshDate, timezone);
  const cacheKey = challengeCacheKey(refreshDateYmd, language);
  const cachedReady = await redisCacheService.get<boolean>(cacheKey);
  if (cachedReady) return;

  const existing = await db.dailyQuestionChallenge.count({
    where: {
      refreshDate,
      language,
      status: 'PUBLISHED' as any,
    },
  });

  if (existing >= 8) {
    await redisCacheService.set(cacheKey, true, QUESTIONS_CHALLENGE_CACHE_TTL);
    return;
  }

  // Serialize generation so the first N users opening any mode today don't
  // all fire the same ~60-120s Gemini call concurrently.
  const lockKey = challengeGenLockKey(refreshDateYmd, language);
  await withChallengeGenLock(lockKey, 180_000, async () => {
    // Re-check inside the lock — another request may have finished generating
    // while we were waiting.
    const doubleCheck = await db.dailyQuestionChallenge.count({
      where: { refreshDate, language, status: 'PUBLISHED' as any },
    });
    if (doubleCheck >= 8) {
      await redisCacheService.set(cacheKey, true, QUESTIONS_CHALLENGE_CACHE_TTL);
      return;
    }

    try {
      await generateAndPersistDailyChallenges(language, refreshDate, timezone);
    } catch (err) {
      // Never leave every mode's session request stuck on a hard failure —
      // recycle the most recent valid day's challenges instead.
      logger.error('[QuestionsChallenges] Daily generation failed, attempting recycled fallback', {
        language,
        refreshDate: refreshDateYmd,
        error: err instanceof Error ? err.message : String(err),
      });

      const recycled = await recycleMostRecentChallenges(language, refreshDate, timezone);
      if (!recycled) {
        // No AI and no real day to recycle. The modes stay unpublished and the
        // app shows its existing error/retry state — inventing placeholder
        // players, clubs and answers to fill the grid is worse than that.
        logger.error('[QuestionsChallenges] No AI round and no history to recycle — modes unavailable today', {
          language,
          refreshDate: refreshDateYmd,
        });
        return;
      }
    }

    await redisCacheService.set(cacheKey, true, QUESTIONS_CHALLENGE_CACHE_TTL);
  });
}

function toDailyDto(
  row: {
    id: string;
    type: string;
    title: string;
    description: string;
    image: string;
    icon: string;
    difficulty: QuizDifficulty;
    xpReward: number;
    refreshTime: string;
    streakContribution: boolean;
    leaderboardEligibility: boolean;
  },
  progress: {
    completionPercentage: number;
    completed: boolean;
    unlocked: boolean;
  } | null,
): DailyQuestionChallengeDto {
  const mode = modeFromDbType(row.type);
  if (!mode) {
    throw new Error(`Unknown challenge mode type: ${row.type}`);
  }

  const completionPercentage = progress?.completionPercentage ?? 0;
  const completed = progress?.completed ?? false;
  const unlocked = progress?.unlocked ?? true;

  return {
    id: row.id,
    type: mode,
    title: row.title,
    description: row.description,
    image: row.image,
    icon: row.icon,
    difficulty: row.difficulty,
    xpReward: row.xpReward,
    refreshTime: row.refreshTime,
    completionState: challengeCompletionState(unlocked, completed),
    completionPercentage,
    unlockState: unlocked,
    streakContribution: row.streakContribution,
    leaderboardEligibility: row.leaderboardEligibility,
  };
}

async function loadProgressMap(userId: string, challengeIds: string[]): Promise<Map<string, {
  completionPercentage: number;
  completed: boolean;
  unlocked: boolean;
}>> {
  if (!challengeIds.length) return new Map();

  const rows = await db.userQuestionChallenge.findMany({
    where: {
      userId,
      challengeId: {
        in: challengeIds,
      },
    },
    select: {
      challengeId: true,
      completionPercentage: true,
      completed: true,
      unlocked: true,
    },
  });

  const map = new Map<string, { completionPercentage: number; completed: boolean; unlocked: boolean }>();
  for (const row of rows) {
    map.set(row.challengeId, {
      completionPercentage: row.completionPercentage,
      completed: row.completed,
      unlocked: row.unlocked,
    });
  }
  return map;
}

async function resolveStreak(userId: string): Promise<{ current: number; longest: number }> {
  const streak = await db.loginStreak.findUnique({
    where: {
      userId,
    },
    select: {
      current: true,
      longest: true,
    },
  });

  return {
    current: streak?.current ?? 0,
    longest: streak?.longest ?? 0,
  };
}

async function computeDailyCompletionBonus(
  userId: string,
  refreshDate: Date,
  timezone: string,
): Promise<number> {
  const challenges = await db.dailyQuestionChallenge.findMany({
    where: {
      refreshDate,
      streakContribution: true,
    },
    select: {
      id: true,
    },
  });

  if (!challenges.length) return 0;

  const completedCount = await db.userQuestionChallenge.count({
    where: {
      userId,
      challengeId: {
        in: (challenges as Array<{ id: string }>).map((challenge: { id: string }) => challenge.id),
      },
      completed: true,
    },
  });

  if (completedCount < challenges.length) return 0;

  const dateKey = packDateYmd(refreshDate, timezone);
  const idempotencyKey = `questions.daily-complete.${dateKey}`;
  const bonus = await awardXp({
    userId,
    action: 'QUIZ_COMPLETED_HIGH',
    amount: 25,
    idempotencyKey,
    timezone,
  });

  return bonus.awarded;
}

/**
 * Real counters for the Questions hub stats strip. Both come from the user's
 * own answer rows / today's published challenges — the hub must never derive
 * these from a bundled question bank or a hardcoded XP table.
 */
async function buildQuestionsSummary(
  userId: string,
  challenges: Array<{ id: string; xpReward: number }>,
): Promise<QuestionsModesSummary> {
  const [answeredCount, earned] = await Promise.all([
    db.userQuestionChallenge.count({
      where: { userId, attempts: { gt: 0 } },
    }),
    db.userQuestionChallenge.aggregate({
      where: { userId },
      _sum: { xpEarned: true },
    }),
  ]);

  return {
    answeredCount,
    xpEarnedTotal: earned?._sum?.xpEarned ?? 0,
    xpAvailableToday: challenges.reduce((total, challenge) => total + (challenge.xpReward ?? 0), 0),
  };
}

export async function getQuestionsModesForUser(
  clerkUserId: string,
  languageInput: string | undefined,
  timezone: string,
): Promise<{ refreshDate: string; modes: DailyQuestionChallengeDto[]; summary: QuestionsModesSummary }> {
  const user = await ensureBackendUser(clerkUserId);
  const language = normalizeLanguage(languageInput);
  const refreshDate = todayPackDate(timezone);
  const refreshDateYmd = packDateYmd(refreshDate, timezone);

  await ensureDailyChallenges(language, refreshDate, timezone);

  const cacheKey = challengeProgressCacheKey(user.id, refreshDateYmd, language);
  const cached = await redisCacheService.get<{
    refreshDate: string;
    modes: DailyQuestionChallengeDto[];
    summary: QuestionsModesSummary;
  }>(cacheKey);
  if (cached?.summary) return cached;

  const challenges = await db.dailyQuestionChallenge.findMany({
    where: {
      refreshDate,
      language,
      status: 'PUBLISHED' as any,
    },
    orderBy: [{ type: 'asc' }],
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      image: true,
      icon: true,
      difficulty: true,
      xpReward: true,
      refreshTime: true,
      streakContribution: true,
      leaderboardEligibility: true,
    },
  });

  const progressMap = await loadProgressMap(
    user.id,
    (challenges as Array<{ id: string }>).map((challenge: { id: string }) => challenge.id),
  );
  const modes = (challenges as Array<any>)
    .map((challenge: any) => toDailyDto(challenge, progressMap.get(challenge.id) ?? null))
    .sort((a: DailyQuestionChallengeDto, b: DailyQuestionChallengeDto) => a.type.localeCompare(b.type));

  const summary = await buildQuestionsSummary(
    user.id,
    (challenges as Array<{ id: string; xpReward: number }>).map((challenge) => ({
      id: challenge.id,
      xpReward: challenge.xpReward,
    })),
  );

  const result = { refreshDate: refreshDateYmd, modes, summary };
  await redisCacheService.set(cacheKey, result, QUESTIONS_CHALLENGE_PROGRESS_CACHE_TTL);
  return result;
}

export async function getQuestionsChallengeSession(
  clerkUserId: string,
  mode: QuestionChallengeMode,
  languageInput: string | undefined,
  timezone: string,
): Promise<QuestionChallengeSessionDto> {
  const user = await ensureBackendUser(clerkUserId);
  const language = normalizeLanguage(languageInput);
  const refreshDate = todayPackDate(timezone);

  await ensureDailyChallenges(language, refreshDate, timezone);

  const challenge = await db.dailyQuestionChallenge.findFirst({
    where: {
      refreshDate,
      language,
      type: dbTypeFromMode(mode) as any,
      status: 'PUBLISHED' as any,
    },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      image: true,
      icon: true,
      difficulty: true,
      xpReward: true,
      refreshDate: true,
      refreshTime: true,
      streakContribution: true,
      leaderboardEligibility: true,
      content: true,
      answer: true,
    },
  });

  if (!challenge) {
    throw new Error('QUESTIONS_CHALLENGE_NOT_FOUND');
  }

  const progress = await db.userQuestionChallenge.findUnique({
    where: {
      userId_challengeId: {
        userId: user.id,
        challengeId: challenge.id,
      },
    },
    select: {
      attempts: true,
      completed: true,
      score: true,
      elapsedTime: true,
      completionPercentage: true,
      unlocked: true,
    },
  });

  return {
    challengeId: challenge.id,
    type: mode,
    title: challenge.title,
    description: challenge.description,
    image: challenge.image,
    icon: challenge.icon,
    difficulty: challenge.difficulty,
    xpReward: challenge.xpReward,
    refreshDate: packDateYmd(challenge.refreshDate, timezone),
    refreshTime: challenge.refreshTime,
    completionState: challengeCompletionState(progress?.unlocked ?? true, progress?.completed ?? false),
    completionPercentage: progress?.completionPercentage ?? 0,
    unlockState: progress?.unlocked ?? true,
    streakContribution: challenge.streakContribution,
    leaderboardEligibility: challenge.leaderboardEligibility,
    content: challenge.content as unknown as QuestionChallengeSessionDto['content'],
    answer: challenge.answer as unknown as QuestionChallengeAnswer,
    attempts: progress?.attempts ?? 0,
    completed: progress?.completed ?? false,
    score: progress?.score ?? 0,
    elapsedTime: progress?.elapsedTime ?? 0,
  };
}

/** The round's questions as stored on a challenge row. */
function challengeQuestions(content: unknown): QuestionChallengeQuestion[] {
  const questions = (content as { questions?: unknown } | null)?.questions;
  return Array.isArray(questions) ? (questions as QuestionChallengeQuestion[]) : [];
}

/** What a user has answered so far this round, keyed by question id. */
interface AnsweredQuestionRecord {
  selectedIds: string[];
  isCorrect: boolean;
  completionPercentage: number;
  attempts: number;
}

function readAnsweredRecords(payload: unknown): Record<string, AnsweredQuestionRecord> {
  const raw = (payload as { byQuestionId?: unknown } | null)?.byQuestionId;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, AnsweredQuestionRecord> = {};
  for (const [questionId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;
    out[questionId] = {
      selectedIds: Array.isArray(record.selectedIds) ? record.selectedIds.map(String) : [],
      isCorrect: Boolean(record.isCorrect),
      completionPercentage: Number(record.completionPercentage) || 0,
      attempts: Number(record.attempts) || 0,
    };
  }
  return out;
}

/**
 * The answer for ONE question of a round. Prefers the question's own answer,
 * then the round's `byQuestionId` map, and finally the flat legacy answer —
 * which is what a row written before rounds existed carries.
 */
function resolveQuestionAnswer(
  questions: QuestionChallengeQuestion[],
  roundAnswer: QuestionChallengeAnswer,
  questionId: string,
): QuestionChallengeAnswer | null {
  const question = questions.find((entry) => entry.id === questionId);
  if (question?.answer) return question.answer;
  const mapped = roundAnswer.byQuestionId?.[questionId];
  if (mapped) return mapped;
  if (questions.length === 0) return roundAnswer;
  return null;
}

export async function submitQuestionsChallengeAnswer(
  clerkUserId: string,
  mode: QuestionChallengeMode,
  payload: {
    challengeId: string;
    /** Which question of the round. Defaults to the first for legacy clients. */
    questionId?: string;
    selectedIds: string[];
    elapsedTime: number;
    language?: string;
  },
  timezone: string,
): Promise<QuestionChallengeSubmitResult> {
  const user = await ensureBackendUser(clerkUserId);
  const language = normalizeLanguage(payload.language);
  const refreshDate = todayPackDate(timezone);

  await ensureDailyChallenges(language, refreshDate, timezone);

  const challenge = await db.dailyQuestionChallenge.findFirst({
    where: {
      id: payload.challengeId,
      type: dbTypeFromMode(mode) as any,
      language,
      refreshDate,
      status: 'PUBLISHED' as any,
    },
    select: {
      id: true,
      answer: true,
      content: true,
      xpReward: true,
      streakContribution: true,
    },
  });

  if (!challenge) {
    throw new Error('QUESTIONS_CHALLENGE_NOT_FOUND');
  }

  const roundAnswer = challenge.answer as unknown as QuestionChallengeAnswer;
  const questions = challengeQuestions(challenge.content);
  const totalQuestions = Math.max(questions.length, 1);

  const questionId = payload.questionId?.trim() || questions[0]?.id || 'q1';
  const question = questions.find((entry) => entry.id === questionId) ?? null;
  const answer = resolveQuestionAnswer(questions, roundAnswer, questionId);
  if (!answer) {
    throw new Error('QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND');
  }

  const evaluation = evaluateChallengeAnswer(mode, payload.selectedIds, answer);
  // A question is worth what its own difficulty earns; the round's xpReward is
  // the sum of those, so it can never drift from what is actually awarded.
  const questionXp = question?.xpReward ?? Math.round(challenge.xpReward / totalQuestions);

  const txResult = await db.$transaction(async (tx: any) => {
    const existing = await tx.userQuestionChallenge.findUnique({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId: challenge.id,
        },
      },
      select: {
        attempts: true,
        completed: true,
        completionPercentage: true,
        xpEarned: true,
        answeredPayload: true,
      },
    });

    const records = readAnsweredRecords(existing?.answeredPayload);
    const previous = records[questionId];
    records[questionId] = {
      selectedIds: payload.selectedIds,
      // Re-answering never downgrades a question that was already right.
      isCorrect: previous?.isCorrect || evaluation.isCorrect,
      completionPercentage: Math.max(previous?.completionPercentage ?? 0, evaluation.completionPercentage),
      attempts: (previous?.attempts ?? 0) + 1,
    };

    const answeredIds = Object.keys(records);
    const correctCount = answeredIds.filter((id) => records[id]!.isCorrect).length;
    const answeredCount = Math.min(answeredIds.length, totalQuestions);
    const completed = answeredCount >= totalQuestions;
    const completionPercentage = Math.round((answeredCount / totalQuestions) * 100);
    const attempts = (existing?.attempts ?? 0) + 1;

    const answeredPayload = {
      byQuestionId: records,
      // Flat mirror of the latest submission, kept for the legacy shape.
      selectedIds: payload.selectedIds,
    } as unknown as Prisma.InputJsonValue;

    const updated = await tx.userQuestionChallenge.upsert({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId: challenge.id,
        },
      },
      create: {
        userId: user.id,
        challengeId: challenge.id,
        completed,
        score: correctCount,
        elapsedTime: Math.max(payload.elapsedTime, 0),
        xpEarned: 0,
        attempts,
        completionPercentage,
        unlocked: true,
        answeredPayload,
        completedAt: completed ? new Date() : null,
      },
      update: {
        completed,
        score: correctCount,
        elapsedTime: Math.max(payload.elapsedTime, 0),
        attempts,
        completionPercentage,
        answeredPayload,
        completedAt: completed ? new Date() : null,
      },
      select: {
        attempts: true,
        completed: true,
        score: true,
        elapsedTime: true,
        completionPercentage: true,
        xpEarned: true,
      },
    });

    return {
      wasCompletedBefore: existing?.completed ?? false,
      alreadyCreditedQuestion: previous?.isCorrect ?? false,
      questionAttempts: records[questionId]!.attempts,
      updated,
    };
  });

  // Partial-credit modes (bingo, top 10) pay out proportionally; a single-answer
  // mode is 100 or 0. A question already answered correctly pays nothing again.
  const baseXp = txResult.alreadyCreditedQuestion
    ? 0
    : Math.round((questionXp * evaluation.completionPercentage) / 100);
  const streak = await resolveStreak(user.id);
  const streakBonus =
    challenge.streakContribution && baseXp > 0 ? Math.round(baseXp * Math.min(streak.current, 7) * 0.05) : 0;

  const completionBonus = !txResult.wasCompletedBefore && txResult.updated.completed ? 10 : 0;
  const dailyBonus =
    !txResult.wasCompletedBefore && txResult.updated.completed
      ? await computeDailyCompletionBonus(user.id, refreshDate, timezone)
      : 0;
  const totalXpAwarded = Math.max(baseXp + streakBonus + completionBonus, 0);

  let xpEarned = 0;
  if (totalXpAwarded > 0) {
    const xpResult = await awardXp({
      userId: user.id,
      action: 'QUIZ_ANSWER_CORRECT',
      amount: totalXpAwarded,
      // Per question, per attempt — replaying one question can't re-award the
      // whole round, and two questions in the same round don't collide.
      idempotencyKey: `questions.${challenge.id}.${questionId}.${txResult.questionAttempts}`,
      timezone,
    });
    xpEarned = xpResult.awarded;

    await db.userQuestionChallenge.update({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId: challenge.id,
        },
      },
      data: {
        xpEarned: {
          increment: xpEarned,
        },
      },
    });
  }

  if (dailyBonus > 0) {
    await db.userQuestionChallenge.update({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId: challenge.id,
        },
      },
      data: {
        xpEarned: {
          increment: dailyBonus,
        },
      },
    });
  }

  await redisCacheService.del(challengeProgressCacheKey(user.id, packDateYmd(refreshDate, timezone), language));

  return {
    challengeId: challenge.id,
    questionId,
    isCorrect: evaluation.isCorrect,
    completionPercentage: txResult.updated.completionPercentage,
    completed: txResult.updated.completed,
    score: txResult.updated.score,
    attempts: txResult.updated.attempts,
    elapsedTime: txResult.updated.elapsedTime,
    xpEarned: xpEarned + dailyBonus,
    bonusXp: completionBonus,
    streakBonus,
    totalXpAwarded: xpEarned + dailyBonus,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    answer,
    hint: question?.hint ?? (challenge.content as any)?.hint ?? null,
  };
}

/**
 * ASK THE CROWD — the real distribution of what other players picked on one
 * question of a round.
 *
 * Counted from UserQuestionChallenge.answeredPayload.byQuestionId[questionId]
 * .selectedIds — actual submissions, nothing modelled or smoothed. Below
 * CROWD_MIN_SAMPLE the lifeline reports `available: false` and the app keeps
 * showing its not-enough-data state rather than a made-up split.
 *
 * The asking user's own answer is excluded, and the correct option is never
 * given any weight of its own: a percentage here is only ever a count.
 */
export async function getQuestionCrowdStats(
  clerkUserId: string,
  mode: QuestionChallengeMode,
  params: { challengeId: string; questionId?: string; language?: string },
  timezone: string,
): Promise<QuestionCrowdStats> {
  const user = await ensureBackendUser(clerkUserId);
  const language = normalizeLanguage(params.language);
  const refreshDate = todayPackDate(timezone);

  const challenge = await db.dailyQuestionChallenge.findFirst({
    where: {
      id: params.challengeId,
      type: dbTypeFromMode(mode) as any,
      language,
      refreshDate,
      status: 'PUBLISHED' as any,
    },
    select: { id: true, content: true },
  });

  if (!challenge) {
    throw new Error('QUESTIONS_CHALLENGE_NOT_FOUND');
  }

  const questions = challengeQuestions(challenge.content);
  const questionId = params.questionId?.trim() || questions[0]?.id || 'q1';

  const rows = await db.userQuestionChallenge.findMany({
    where: { challengeId: challenge.id, userId: { not: user.id } },
    select: { answeredPayload: true },
  });

  const counts = new Map<string, number>();
  let sampleSize = 0;

  for (const row of rows as Array<{ answeredPayload: unknown }>) {
    const records = readAnsweredRecords(row.answeredPayload);
    const record = records[questionId];
    const selected = record?.selectedIds ?? [];
    if (!selected.length) continue;
    sampleSize += 1;
    for (const optionId of selected) {
      const key = normalizeOptionId(optionId);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  if (sampleSize < CROWD_MIN_SAMPLE) {
    return { challengeId: challenge.id, questionId, available: false, sampleSize, percentages: {} };
  }

  const percentages: Record<string, number> = {};
  for (const [optionId, count] of counts) {
    percentages[optionId] = Math.round((count / sampleSize) * 100);
  }

  return { challengeId: challenge.id, questionId, available: true, sampleSize, percentages };
}

export async function useQuestionsChallengeHint(
  clerkUserId: string,
  mode: QuestionChallengeMode,
  payload: { challengeId: string; language?: string },
  timezone: string,
): Promise<{ hint: string | null }> {
  const user = await ensureBackendUser(clerkUserId);
  const language = normalizeLanguage(payload.language);
  const refreshDate = todayPackDate(timezone);

  const challenge = await db.dailyQuestionChallenge.findFirst({
    where: {
      id: payload.challengeId,
      type: dbTypeFromMode(mode) as any,
      language,
      refreshDate,
      status: 'PUBLISHED' as any,
    },
    select: {
      id: true,
      content: true,
    },
  });

  if (!challenge) {
    throw new Error('QUESTIONS_CHALLENGE_NOT_FOUND');
  }

  await db.userQuestionChallenge.upsert({
    where: {
      userId_challengeId: {
        userId: user.id,
        challengeId: challenge.id,
      },
    },
    create: {
      userId: user.id,
      challengeId: challenge.id,
      completed: false,
      score: 0,
      elapsedTime: 0,
      xpEarned: 0,
      attempts: 0,
      completionPercentage: 0,
      unlocked: true,
      hintUsed: true,
      answeredPayload: {} as Prisma.InputJsonValue,
    },
    update: {
      hintUsed: true,
    },
  });

  await redisCacheService.del(challengeProgressCacheKey(user.id, packDateYmd(refreshDate, timezone), language));

  return {
    hint: ((challenge.content as any)?.hint as string | undefined) ?? null,
  };
}

export async function getQuestionsChallengeLeaderboard(
  period: 'daily' | 'weekly' | 'monthly',
  metric: 'xp' | 'completed' | 'accuracy',
  limit = 50,
): Promise<QuestionChallengeLeaderboardRow[]> {
  const since = dailyLeaderboardStart(period);

  const rows = await db.userQuestionChallenge.groupBy({
    by: ['userId'],
    where: {
      updatedAt: {
        gte: since,
      },
    },
    _sum: {
      xpEarned: true,
      score: true,
    },
    _count: {
      _all: true,
    },
  });

  if (!rows.length) return [];

  const userIds = (rows as Array<{ userId: string }>).map((row: { userId: string }) => row.userId);
  const users = await db.user.findMany({
    where: {
      id: {
        in: userIds,
      },
      isDeleted: false,
      isBanned: false,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
    },
  });

  const typedUsers = users as Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  }>;
  const userMap = new Map<string, (typeof typedUsers)[number]>(
    typedUsers.map((user) => [user.id, user]),
  );

  const leaderboard = rows
    .map((row: any) => {
      const user = userMap.get(row.userId);
      if (!user) return null;

      const completedChallenges = row._count._all;
      const accuracy = completedChallenges > 0
        ? Math.round(((row._sum.score ?? 0) / completedChallenges) * 1000) / 1000
        : 0;

      return {
        userId: row.userId,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        xp: row._sum.xpEarned ?? 0,
        completedChallenges,
        accuracy,
      };
    })
    .filter((row: any) => Boolean(row));

  leaderboard.sort((a: any, b: any) => {
    if (metric === 'completed') {
      if (b.completedChallenges !== a.completedChallenges) {
        return b.completedChallenges - a.completedChallenges;
      }
      return b.xp - a.xp;
    }
    if (metric === 'accuracy') {
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      return b.xp - a.xp;
    }
    if (b.xp !== a.xp) {
      return b.xp - a.xp;
    }
    return b.completedChallenges - a.completedChallenges;
  });

  return leaderboard.slice(0, Math.min(limit, 100)).map((row: any, index: number) => ({
    rank: index + 1,
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    xp: row.xp,
    completedChallenges: row.completedChallenges,
    accuracy: row.accuracy,
  }));
}

export async function getQuestionsChallengeHistory(
  clerkUserId: string,
  languageInput: string | undefined,
  limit = 30,
): Promise<Array<{
  challengeId: string;
  mode: QuestionChallengeMode;
  title: string;
  completed: boolean;
  score: number;
  attempts: number;
  completionPercentage: number;
  xpEarned: number;
  completedAt: string | null;
  updatedAt: string;
}>> {
  const user = await ensureBackendUser(clerkUserId);
  const language = normalizeLanguage(languageInput);

  const rows = await db.userQuestionChallenge.findMany({
    where: {
      userId: user.id,
      challenge: {
        language,
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: Math.min(limit, 100),
    select: {
      challengeId: true,
      completed: true,
      score: true,
      attempts: true,
      completionPercentage: true,
      xpEarned: true,
      completedAt: true,
      updatedAt: true,
      challenge: {
        select: {
          type: true,
          title: true,
        },
      },
    },
  });

  return rows
    .map((row: any) => {
      const mode = modeFromDbType(row.challenge.type);
      if (!mode) return null;
      return {
        challengeId: row.challengeId,
        mode,
        title: row.challenge.title,
        completed: row.completed,
        score: row.score,
        attempts: row.attempts,
        completionPercentage: row.completionPercentage,
        xpEarned: row.xpEarned,
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        updatedAt: row.updatedAt.toISOString(),
      };
    })
    .filter((row: any) => Boolean(row));
}

export async function regenerateDailyQuestionsChallenges(options?: {
  language?: QuizLanguage;
  timezone?: string;
  refreshDate?: Date;
}): Promise<void> {
  const timezone = options?.timezone ?? 'UTC';
  const refreshDate = options?.refreshDate ?? todayPackDate(timezone);
  const languages = options?.language ? [options.language] : (['ar', 'en'] as QuizLanguage[]);

  for (const language of languages) {
    try {
      await generateAndPersistDailyChallenges(language, refreshDate, timezone);
    } catch (err) {
      // Same resilience as ensureDailyChallenges: never let a Gemini outage
      // leave this language with zero playable challenges after warmup/cron.
      logger.error('[QuestionsChallenges] regenerate: fresh generation failed, attempting recycled fallback', {
        language,
        refreshDate: packDateYmd(refreshDate, timezone),
        error: err instanceof Error ? err.message : String(err),
      });
      const recycled = await recycleMostRecentChallenges(language, refreshDate, timezone);
      if (!recycled) {
        logger.error('[QuestionsChallenges] regenerate: no AI round and no history to recycle', {
          language,
          refreshDate: packDateYmd(refreshDate, timezone),
        });
      }
    }
    await redisCacheService.del(challengeCacheKey(packDateYmd(refreshDate, timezone), language));
  }
}
