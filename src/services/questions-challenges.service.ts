import crypto from 'crypto';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { redisCacheService } from './redis-cache.service';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { ensureBackendUser } from '../utils/ensureBackendUser';
import { awardXp, penalizeXp, XP_VALUES } from './xp.service';
import { getOrCreateDailyPack } from './quiz-daily.service';
import { todayPackDate, packDateYmd } from './quiz-generator.service';
import { buildAiQuestionChallenges } from './questions-challenges.ai-generator.service';
import { seededRng } from './questions-challenges.football-data';
import {
  challengeQuestions,
  summarizeErrors,
  validateRoundContract,
  validateStoredRound,
  type RoundValidation,
} from './questions-challenges.round-contract';
import type { AiQuestionsMode } from './questions-challenges.ai-prompt';
import {
  advanceExpiredQuestions,
  applyAnswerToSession,
  buildSessionView,
  buildSubmitResultBase,
  deriveProgressFields,
  ensureSessionStarted,
  getCurrentQuestionId,
  parseSessionProgress,
  QuestionsSessionError,
  rejectClientScoreFields,
  sessionProgressToJson,
  type QuestionAnswerRecord,
} from './questions-challenges.session.service';
import {
  QUIZ_COIN_COST,
  QUIZ_QUESTION_TIME_LIMIT_SEC,
  ROUND_QUESTION_COUNT,
} from '../constants/quiz.constants';
import { roundQuestionCount, top10EvaluationStrategy } from '../constants/questions-modes.config';
import { gradeTop10Entries } from './questions-challenges.top10';

/**
 * What a wrong answer costs, in coins.
 *
 * NOT a new business rule: this is the app's existing quiz economy value
 * (`QUIZ_COIN_COST`, what the Daily Football Quiz has always charged for a
 * wrong answer, a skip or a hint). Aliased here so the Questions modes are
 * visibly charging the SAME thing rather than a number of their own.
 */
const WRONG_ANSWER_COIN_PENALTY = QUIZ_COIN_COST;

/**
 * XP for ONE Questions answer. The product rule, in full:
 * a correct answer is worth 1 XP and a wrong one costs 1 XP.
 */
const QUESTION_XP_CORRECT = XP_VALUES.QUIZ_ANSWER_CORRECT;
const QUESTION_XP_WRONG = XP_VALUES.QUIZ_ANSWER_WRONG;
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
  QuestionFiftyFiftyResult,
  QuestionsModesSummary,
} from '../types/questions-challenges.types';

const db = prisma as any;

const QUESTIONS_CHALLENGE_CACHE_TTL = 25 * 60 * 60 * 1000;
const QUESTIONS_CHALLENGE_PROGRESS_CACHE_TTL = 2 * 60 * 1000;
/** How long a day that failed to generate waits before it is attempted again. */
const QUESTIONS_CHALLENGE_RETRY_COOLDOWN_MS = 10 * 60 * 1000;
const DEFAULT_REFRESH_TIME = '00:00';
const LOOKBACK_DAYS = 7;

/**
 * How many other players must have answered a question before "ask the crowd"
 * will show a split. Below this the sample is too small to mean anything, and
 * the lifeline reports itself unavailable instead of inventing a distribution.
 */
const CROWD_MIN_SAMPLE = 5;

/** Modes published per day/language — the 7 playable ones plus Football Quiz. */
const EXPECTED_MODES_PER_DAY = 8;

/**
 * THE ONE definition of a playable round, shared with the AI generator — see
 * questions-challenges.round-contract.ts.
 *
 * Everything on this file's write and read paths (counting a day as generated,
 * recycling a previous day, publishing, and serving a session) validates a row
 * with `validateStoredRound`, i.e. the exact rules a freshly generated AI round
 * had to satisfy. Before that, this file only asked "is `content.questions`
 * non-empty?", which is why a `source: 'STATIC_FALLBACK'` row carrying
 * { hint, title, prompt, options, imageUrl, description, playerFacts } and no
 * `questions` array could stay published on today's date and fail every
 * guess-player session with a 502.
 */
function roundVerdict(row: { type?: string; content: unknown; answer?: unknown; source?: unknown }): RoundValidation {
  const mode = row.type ? modeFromDbType(row.type) : null;
  if (!mode) return { ok: false, errors: [`UNKNOWN_MODE_TYPE:${String(row.type)}`], questionCount: 0 };
  return validateStoredRound({ mode, content: row.content, answer: row.answer, source: row.source });
}

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

const SUPPORTED_QUESTION_MODES = Object.keys(MODE_TO_DB_TYPE) as QuestionChallengeMode[];

type QuestionsGenerationErrorDetails = {
  mode?: QuestionChallengeMode;
  language: QuizLanguage;
  refreshDate: string;
  generationBatch: string;
  provider: string;
  reason: string;
  message: string;
  stack?: string;
};

function questionGenerationUnavailable(details: QuestionsGenerationErrorDetails): Error & { details: QuestionsGenerationErrorDetails } {
  const err = new Error('QUESTION_GENERATION_UNAVAILABLE') as Error & {
    details: QuestionsGenerationErrorDetails;
  };
  err.details = details;
  return err;
}

/**
 * "The round is being written right now" — a different fact from "this round
 * cannot be produced". Since generation moved off the request path, the first
 * caller of a starved day gets an answer while the work is still running, and
 * reporting that as UNAVAILABLE tells the app to show a dead end for something
 * that is seconds away. Carries retryAfterSeconds so the client can poll
 * instead of guessing.
 */
function questionGenerationInProgress(
  details: QuestionsGenerationErrorDetails & { retryAfterSeconds: number },
): Error & { details: QuestionsGenerationErrorDetails & { retryAfterSeconds: number } } {
  const err = new Error('QUESTION_GENERATION_IN_PROGRESS') as Error & {
    details: QuestionsGenerationErrorDetails & { retryAfterSeconds: number };
  };
  err.details = details;
  return err;
}

/** True while this process has a detached generation run open for the day. */
function isGenerationInFlight(language: QuizLanguage, refreshDateYmd: string): boolean {
  return backgroundGenerationInFlight.has(`${refreshDateYmd}:${language}`);
}

/**
 * The provider these errors should name. Was hardcoded to 'openrouter', which
 * became wrong once provider order started following QUIZ_AI_PROVIDER — a
 * Gemini-first deployment was reporting OpenRouter as the failing provider.
 */
function preferredQuizProviderName(): string {
  const provider = (process.env.QUIZ_AI_PROVIDER ?? process.env.AI_QUIZ_PROVIDER ?? 'gemini')
    .trim()
    .toLowerCase();
  return provider === 'openrouter' ? 'openrouter' : 'gemini';
}

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

function legacyChallengeGenFailureKey(refreshDateYmd: string, language: QuizLanguage): string {
  return `quiz:questions:gen-failed:${refreshDateYmd}:${language}`;
}

/**
 * Marks "today could not be generated", so a starved day is retried on a timer
 * instead of on every incoming session request.
 */
function challengeGenFailureKey(
  refreshDateYmd: string,
  language: QuizLanguage,
  mode: QuestionChallengeMode,
): string {
  return `quiz:questions:gen-failed:${refreshDateYmd}:${language}:${mode}`;
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

function buildQuestionFingerprint(mode: QuestionChallengeMode, question: QuestionChallengeQuestion): string {
  const prompt = String(question?.prompt ?? '').trim().toLowerCase();
  const options = Array.isArray(question?.options)
    ? question.options
        .map((option) => `${String(option?.id ?? '').trim().toLowerCase()}:${String(option?.label ?? '').trim().toLowerCase()}`)
        .sort()
        .join('|')
    : '';
  const answerIds = [
    ...(Array.isArray(question?.answer?.correctIds) ? question.answer.correctIds : []),
    ...(Array.isArray(question?.answer?.orderedIds) ? question.answer.orderedIds : []),
  ]
    .map((value) => String(value).trim().toLowerCase())
    .sort();
  const entityId = typeof question?.entity?.id === 'string' ? question.entity.id.trim().toLowerCase() : '';
  const transferId = typeof (question as any)?.transferId === 'string' ? (question as any).transferId.trim().toLowerCase() : '';
  const rankingId = typeof (question as any)?.rankingId === 'string' ? (question as any).rankingId.trim().toLowerCase() : '';
  const evidence = Array.isArray(question?.evidence)
    ? question.evidence
        .map((entry: any) => `${String(entry?.label ?? '').trim().toLowerCase()}:${String(entry?.value ?? '').trim().toLowerCase()}`)
        .sort()
        .join('|')
    : '';

  const raw = JSON.stringify({
    mode,
    prompt,
    options,
    answerIds,
    entityId,
    transferId,
    rankingId,
    evidence,
  });
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function existingQuestionFingerprints(language: QuizLanguage): Promise<Set<string>> {
  const rows = await db.dailyQuestionChallenge.findMany({
    where: { language, status: 'PUBLISHED' as any },
    select: { type: true, content: true },
  });

  const fingerprints = new Set<string>();
  for (const row of rows as Array<{ type: string; content: any }>) {
    const mode = modeFromDbType(row.type);
    if (!mode) continue;
    for (const question of challengeQuestions(row.content)) {
      fingerprints.add(buildQuestionFingerprint(mode, question));
    }
  }
  return fingerprints;
}

function rejectedDuplicateQuestionFingerprints(
  mode: QuestionChallengeMode,
  questions: QuestionChallengeQuestion[],
  existing: Set<string>,
  batchSeen: Set<string> = new Set<string>(),
): string[] {
  const duplicates: string[] = [];
  for (const question of questions) {
    const fingerprint = buildQuestionFingerprint(mode, question);
    if (existing.has(fingerprint) || batchSeen.has(fingerprint)) {
      duplicates.push(fingerprint);
      continue;
    }
    batchSeen.add(fingerprint);
  }
  return duplicates;
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

function pointsForRecord(
  mode: QuestionChallengeMode,
  record: QuestionAnswerRecord,
): number {
  if (record.status === 'expired') return 0;
  return record.pointsEarned;
}

function evaluatePointsForMode(
  mode: QuestionChallengeMode,
  questions: QuestionChallengeQuestion[],
): (questionId: string, record: QuestionAnswerRecord) => number {
  return (questionId, record) => {
    if (record.status === 'expired') return 0;
    const question = questions.find((entry) => entry.id === questionId);
    if (!question) return record.isCorrect ? 1 : 0;
    const evaluation = evaluateChallengeAnswer(mode, record.selectedIds, question.answer);
    return evaluation.score;
  };
}
function evaluateChallengeAnswer(
  mode: QuestionChallengeMode,
  submittedIds: string[],
  answer: QuestionChallengeAnswer,
): { isCorrect: boolean; completionPercentage: number; score: number } {
  const selected = normalizedSet(submittedIds);
  const correct = normalizedSet(answer.correctIds);

  /*
   * TOP 10 — the submission is ten TYPED NAMES, not ids, so it is graded by
   * matching each one against the real ranking's names and recorded aliases
   * (questions-challenges.top10.ts). The client never sees those names: it
   * sends what the player typed and is told how many were right.
   *
   * Whether a name has to be in the RIGHT SLOT is a product rule, read from
   * `top10EvaluationStrategy()` rather than decided here.
   */
  if (mode === 'top10-challenge') {
    const slots = answer.orderedAnswers ?? [];
    if (slots.length) {
      const grade = gradeTop10Entries(submittedIds, slots, top10EvaluationStrategy());
      return {
        isCorrect: grade.isPerfect,
        completionPercentage: Math.round((grade.correctCount / slots.length) * 100),
        score: grade.correctCount,
      };
    }

    // Legacy rows (ranked ids, drag-to-order) still grade the way they were written.
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

  /*
   * FOOTBALL GRID is one player per cell now — a single-answer question, graded
   * by the same all-or-nothing rule as every other single-answer mode below.
   * It used to be graded here, alongside bingo's three cells, because its
   * answer was a CELL id; it no longer is.
   */
  if (mode === 'football-bingo') {
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
  // A round is ROUND_QUESTION_COUNT questions in every mode. A short pack is not
  // a short round — it is no round, and the card is simply not published today.
  if (source.length < ROUND_QUESTION_COUNT) {
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
      timer: QUIZ_QUESTION_TIME_LIMIT_SEC,
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

/**
 * THE PUBLISH GATE.
 *
 * Nothing reaches `status: PUBLISHED` without passing the canonical round
 * contract first — the same rules the AI generator accepted it under and the
 * same rules the session endpoint will re-check when it serves it. A round that
 * fails is logged with its reasons and dropped; it is never written as a
 * published row that the app will then fail to play.
 *
 * Returns the modes that were actually published.
 */
async function persistChallenges(
  language: QuizLanguage,
  refreshDate: Date,
  payload: GeneratedQuestionChallengesPayload,
  footballQuizChallenge: GeneratedQuestionChallenge | null,
): Promise<QuestionChallengeMode[]> {
  const candidates = footballQuizChallenge
    ? [...payload.challenges, footballQuizChallenge]
    : [...payload.challenges];

  const rows: GeneratedQuestionChallenge[] = [];
  const existingFingerprints = await existingQuestionFingerprints(language);
  const batchSeenFingerprints = new Set<string>();

  for (const challenge of candidates) {
    const questions = challengeQuestions(challenge.content);
    const duplicateFingerprints = rejectedDuplicateQuestionFingerprints(
      challenge.mode,
      questions,
      existingFingerprints,
      batchSeenFingerprints,
    );

    if (duplicateFingerprints.length > 0) {
      logger.warn('[QuestionsChallenges] round rejected before publish due to duplicate questions', {
        mode: challenge.mode,
        language,
        duplicateCount: duplicateFingerprints.length,
      });
      continue;
    }

    const verdict = validateRoundContract({
      mode: challenge.mode,
      questions,
      answer: challenge.answer,
    });
    if (verdict.ok) {
      rows.push(challenge);
      for (const question of questions) {
        existingFingerprints.add(buildQuestionFingerprint(challenge.mode, question));
        batchSeenFingerprints.add(buildQuestionFingerprint(challenge.mode, question));
      }
      continue;
    }
    // `source` is 'AI' for everything generated today; anything else reaching
    // this point is a fallback tier, and a fallback that cannot produce a valid
    // session round must never be published.
    const label =
      challenge.metadata.source === 'AI'
        ? '[QuestionsChallenges] round rejected before publish'
        : '[QuestionsChallenges] fallback rejected';
    logger.error(label, {
      mode: challenge.mode,
      language,
      source: challenge.metadata.source,
      reason: 'ROUND_CONTRACT_VIOLATION',
      questionCount: verdict.questionCount,
      validationErrors: summarizeErrors(verdict.errors),
    });
  }

  if (!rows.length) return [];

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

  for (const challenge of rows) {
    logger.info('[QuestionsChallenges] published round', {
      mode: challenge.mode,
      language,
      source: challenge.metadata.source,
      questionCount: challengeQuestions(challenge.content).length,
    });
  }

  return rows.map((challenge) => challenge.mode);
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

  let payload: GeneratedQuestionChallengesPayload;
  try {
    payload = await generateDailyQuestionsModesPayload(language, refreshDateYmd, avoidPromptsByMode);
  } catch (err) {
    /*
     * The seven AI modes could not be authored today (usually a starved entity
     * pool). The isolation above was only ever one-way: a bad daily pack must
     * not sink the AI modes — but a failed AI batch was silently discarding a
     * Football Quiz round that had ALREADY been built successfully, because
     * persistChallenges below was never reached.
     *
     * A mode that was built is published. Failing one mode must not un-build
     * another. Nothing invented is published here: this is the same AI round
     * that would have been stored had the batch succeeded.
     */
    if (footballQuizChallenge) {
      await persistChallenges(
        language,
        refreshDate,
        { language, refreshDate: refreshDateYmd, refreshTime: DEFAULT_REFRESH_TIME, challenges: [] },
        footballQuizChallenge,
      );
      await redisCacheService.del(challengeCacheKey(refreshDateYmd, language));
      logger.warn('[QuestionsChallenges] AI modes failed — published Football Quiz alone', {
        language,
        refreshDate: refreshDateYmd,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    throw err;
  }

  await persistChallenges(language, refreshDate, payload, footballQuizChallenge);
  await redisCacheService.del(challengeCacheKey(refreshDateYmd, language));
  // The day generated — drop any back-off left from an earlier failed attempt.
  await clearGenerationFailureKeys(refreshDateYmd, language);
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
    // The whole window, not one day's worth: a mode missing today may have last
    // been authored several days ago, and each mode is taken from its own most
    // recent real round.
    take: EXPECTED_MODES_PER_DAY * LOOKBACK_DAYS,
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

  /*
   * Only a round that would pass the publish gate today may be recycled — the
   * fallback tier is held to the SAME contract as fresh AI content. Without
   * this the oldest canned/legacy rows got copied on to every new day forever:
   * never playable, so generation was attempted, failed, recycled them again —
   * the loop that produced SESSION_LOAD_FAILED on every mode for days on end.
   */
  /*
   * Recycling FILLS GAPS; it never overwrites a mode that is already playable
   * today. A fresh AI round must not be replaced by an older one just because
   * some other mode of the same day failed.
   */
  const alreadyPlayable = new Set(
    (await loadPublishedRows(language, refreshDate)).filter((row) => roundVerdict(row).ok).map((row) => row.type),
  );

  const recyclable: Array<any> = [];
  const seenTypes = new Set<string>();
  for (const row of previous as Array<any>) {
    if (alreadyPlayable.has(row.type)) continue;
    // `previous` spans several days, newest first — take each mode once.
    if (seenTypes.has(row.type)) continue;

    const verdict = roundVerdict(row);
    if (verdict.ok) {
      seenTypes.add(row.type);
      recyclable.push(row);
      continue;
    }
    logger.warn('[QuestionsChallenges] fallback rejected', {
      mode: modeFromDbType(row.type) ?? row.type,
      language,
      source: row.source ?? 'unknown',
      reason: 'RECYCLE_CANDIDATE_FAILS_ROUND_CONTRACT',
      validationErrors: summarizeErrors(verdict.errors),
    });
  }

  if (!recyclable.length) {
    if (alreadyPlayable.size < EXPECTED_MODES_PER_DAY) {
      logger.error('[QuestionsChallenges] nothing recyclable — previous days hold no real rounds', {
        language,
        refreshDate: packDateYmd(refreshDate, timezone),
        inspected: previous.length,
        alreadyPlayableToday: alreadyPlayable.size,
      });
    }
    return false;
  }

  await db.$transaction(async (tx: any) => {
    for (const row of recyclable as Array<any>) {
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
        /*
         * The update branch MUST overwrite the content too. It used to flip
         * `status` alone, so when today already held a row for this mode — the
         * unplayable STATIC_FALLBACK one — recycling "succeeded" while leaving
         * that broken round in place, and the session kept failing.
         */
        update: {
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
      });
    }
  });

  for (const row of recyclable) {
    logger.info('[QuestionsChallenges] published round', {
      mode: modeFromDbType(row.type) ?? row.type,
      language,
      source: `RECYCLED:${row.source ?? 'AI'}`,
      questionCount: challengeQuestions(row.content).length,
    });
  }

  logger.warn('[QuestionsChallenges] Recycled previous day challenges as fallback', {
    language,
    refreshDate: packDateYmd(refreshDate, timezone),
    count: recyclable.length,
  });

  return true;
}

async function recycleMostRecentChallengeForMode(
  mode: QuestionChallengeMode,
  language: QuizLanguage,
  refreshDate: Date,
  timezone: string,
): Promise<boolean> {
  const type = dbTypeFromMode(mode);
  const refreshDateYmd = packDateYmd(refreshDate, timezone);
  const since = new Date(refreshDate);
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const existing = await loadPublishedRows(language, refreshDate);
  const unplayable = existing.filter((row) => row.type === type && !roundVerdict(row).ok);
  if (unplayable.length > 0) {
    await archiveUnplayableRows(language, refreshDateYmd, unplayable);
  }

  const candidate = (await db.dailyQuestionChallenge.findMany({
    where: {
      language,
      type,
      status: 'PUBLISHED' as any,
      refreshDate: { gte: since, lt: refreshDate },
    },
    orderBy: { refreshDate: 'desc' },
    take: LOOKBACK_DAYS,
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
  }) as Array<any>).find((row) => roundVerdict(row).ok);

  if (!candidate) {
    logger.warn('[QuestionsChallenges] no recyclable round for missing mode', {
      mode,
      language,
      refreshDate: refreshDateYmd,
    });
    return false;
  }

  const contentHash = challengeHash(candidate.content);
  await db.dailyQuestionChallenge.upsert({
    where: {
      refreshDate_type_language: {
        refreshDate,
        type,
        language,
      },
    },
    create: {
      refreshDate,
      language,
      type,
      status: 'PUBLISHED' as any,
      title: candidate.title,
      description: candidate.description,
      image: candidate.image,
      icon: candidate.icon,
      difficulty: candidate.difficulty,
      xpReward: candidate.xpReward,
      refreshTime: candidate.refreshTime || DEFAULT_REFRESH_TIME,
      streakContribution: candidate.streakContribution,
      leaderboardEligibility: candidate.leaderboardEligibility,
      content: candidate.content as unknown as Prisma.InputJsonValue,
      answer: candidate.answer as unknown as Prisma.InputJsonValue,
      metadata: { source: candidate.source ?? 'AI', isFallback: true } as unknown as Prisma.InputJsonValue,
      contentHash,
      source: candidate.source ?? 'AI',
      publishedAt: new Date(),
    },
    update: {
      status: 'PUBLISHED' as any,
      title: candidate.title,
      description: candidate.description,
      image: candidate.image,
      icon: candidate.icon,
      difficulty: candidate.difficulty,
      xpReward: candidate.xpReward,
      refreshTime: candidate.refreshTime || DEFAULT_REFRESH_TIME,
      streakContribution: candidate.streakContribution,
      leaderboardEligibility: candidate.leaderboardEligibility,
      content: candidate.content as unknown as Prisma.InputJsonValue,
      answer: candidate.answer as unknown as Prisma.InputJsonValue,
      metadata: { source: candidate.source ?? 'AI', isFallback: true } as unknown as Prisma.InputJsonValue,
      contentHash,
      source: candidate.source ?? 'AI',
      publishedAt: new Date(),
    },
  });

  logger.warn('[QuestionsChallenges] recycled latest playable round for missing mode', {
    mode,
    language,
    refreshDate: refreshDateYmd,
    source: candidate.source ?? 'AI',
    questionCount: challengeQuestions(candidate.content).length,
  });
  return true;
}

/**
 * Un-publishes rows that cannot be served, so a broken round can neither block
 * regeneration nor be handed to the app.
 *
 * This is what finally clears the production state: the guess-player row for
 * today was `source: 'STATIC_FALLBACK'` with no `questions`, PUBLISHED, and
 * therefore found by every session query. Archiving it means the mode reports a
 * clean "not published yet" while the day regenerates, instead of a 502 on a
 * round that will never be playable.
 */
async function archiveUnplayableRows(
  language: QuizLanguage,
  refreshDateYmd: string,
  rows: Array<{ id: string; type: string; content: unknown; answer?: unknown; source: unknown }>,
): Promise<void> {
  for (const row of rows) {
    const verdict = roundVerdict(row);
    if (verdict.ok) continue;
    await db.dailyQuestionChallenge.update({
      where: { id: row.id },
      data: { status: 'ARCHIVED' as any },
    });
    logger.warn('[QuestionsChallenges] archived unplayable published round', {
      mode: modeFromDbType(row.type) ?? row.type,
      language,
      refreshDate: refreshDateYmd,
      challengeId: row.id,
      source: row.source ?? 'unknown',
      questionCount: verdict.questionCount,
      validationErrors: summarizeErrors(verdict.errors),
    });
  }
}

/** Today's published rows for a language, with everything validation needs. */
async function loadPublishedRows(
  language: QuizLanguage,
  refreshDate: Date,
): Promise<Array<{ id: string; type: string; content: unknown; answer: unknown; source: unknown }>> {
  return (await db.dailyQuestionChallenge.findMany({
    where: { refreshDate, language, status: 'PUBLISHED' as any },
    select: { id: true, type: true, content: true, answer: true, source: true },
  })) as Array<{ id: string; type: string; content: unknown; answer: unknown; source: unknown }>;
}

function playableModesFromRows(
  rows: Array<{ type: string; content: unknown; answer: unknown; source: unknown }>,
): Set<QuestionChallengeMode> {
  const out = new Set<QuestionChallengeMode>();
  for (const row of rows) {
    if (!roundVerdict(row).ok) continue;
    const mode = modeFromDbType(row.type);
    if (mode) out.add(mode);
  }
  return out;
}

async function clearGenerationFailureKeys(refreshDateYmd: string, language: QuizLanguage): Promise<void> {
  await redisCacheService.del(legacyChallengeGenFailureKey(refreshDateYmd, language));
  await Promise.all(
    SUPPORTED_QUESTION_MODES.map((mode) =>
      redisCacheService.del(challengeGenFailureKey(refreshDateYmd, language, mode)),
    ),
  );
}

async function markGenerationFailureKeys(
  refreshDateYmd: string,
  language: QuizLanguage,
  playableModes: Set<QuestionChallengeMode>,
  ttlMs: number,
): Promise<QuestionChallengeMode[]> {
  const missingModes = SUPPORTED_QUESTION_MODES.filter((mode) => !playableModes.has(mode));
  await redisCacheService.set(legacyChallengeGenFailureKey(refreshDateYmd, language), true, ttlMs);
  await Promise.all(
    SUPPORTED_QUESTION_MODES.map((mode) =>
      playableModes.has(mode)
        ? redisCacheService.del(challengeGenFailureKey(refreshDateYmd, language, mode))
        : redisCacheService.set(challengeGenFailureKey(refreshDateYmd, language, mode), true, ttlMs),
    ),
  );
  return missingModes;
}

/**
 * Days whose generation is already running in this process, so a burst of
 * session requests for the same day triggers one background run rather than
 * one per request. The Redis lock in withChallengeGenLock already serializes
 * across processes; this only avoids piling up promises inside this one.
 */
const backgroundGenerationInFlight = new Set<string>();

/**
 * Starts (at most one) generation run for a day and returns immediately.
 *
 * Generation is minutes of AI and football work. It belongs to the cron and to
 * this detached runner — never to the request the user is waiting on.
 */
function triggerBackgroundGeneration(
  language: QuizLanguage,
  refreshDate: Date,
  timezone: string,
  refreshDateYmd: string,
): void {
  const key = `${refreshDateYmd}:${language}`;
  if (backgroundGenerationInFlight.has(key)) return;
  backgroundGenerationInFlight.add(key);

  logger.info('[QuestionsChallenges] generation needed — running it in the background', {
    language,
    refreshDate: refreshDateYmd,
  });

  // Same full path the cron runs; the omitted requestedMode means "author the
  // whole day", which is what a starved day actually needs.
  void ensureDailyChallenges(language, refreshDate, timezone)
    .catch((err) =>
      logger.error('[QuestionsChallenges] background generation failed', {
        language,
        refreshDate: refreshDateYmd,
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    .finally(() => backgroundGenerationInFlight.delete(key));
}

async function ensureDailyChallenges(
  language: QuizLanguage,
  refreshDate: Date,
  timezone: string,
  requestedMode?: QuestionChallengeMode,
  options?: {
    /**
     * Set by user-facing request paths. Every cheap check below still runs
     * inline (they are DB/Redis reads and can resolve the request outright);
     * only the expensive generation is detached, so the caller gets a fast,
     * explicit "not ready" instead of holding the socket open for the whole
     * AI retry ladder.
     */
    background?: boolean;
  },
): Promise<void> {
  const refreshDateYmd = packDateYmd(refreshDate, timezone);
  const cacheKey = challengeCacheKey(refreshDateYmd, language);
  const cachedReady = await redisCacheService.get<boolean>(cacheKey);
  if (cachedReady) return;
  const generationBatch = `${refreshDateYmd}:${language}:${Date.now()}`;

  const existingRows = await loadPublishedRows(language, refreshDate);
  const playableModes = playableModesFromRows(existingRows);

  if (playableModes.size >= EXPECTED_MODES_PER_DAY) {
    await redisCacheService.set(cacheKey, true, QUESTIONS_CHALLENGE_CACHE_TTL);
    await clearGenerationFailureKeys(refreshDateYmd, language);
    return;
  }

  if (requestedMode && playableModes.has(requestedMode)) {
    return;
  }

  const legacyFailureActive = await redisCacheService.get<boolean>(
    legacyChallengeGenFailureKey(refreshDateYmd, language),
  );
  const modeFailureActive = requestedMode
    ? await redisCacheService.get<boolean>(
        challengeGenFailureKey(refreshDateYmd, language, requestedMode),
      )
    : false;

  if (legacyFailureActive || modeFailureActive) {
    if (requestedMode && !playableModes.has(requestedMode)) {
      throw questionGenerationUnavailable({
        mode: requestedMode,
        language,
        refreshDate: refreshDateYmd,
        generationBatch,
        provider: 'openrouter',
        reason: 'GENERATION_BACKOFF_ACTIVE',
        message: 'Generation backoff is active for this mode',
      });
    }
    return;
  }

  const unplayable = existingRows.filter((row) => !roundVerdict(row).ok);
  if (unplayable.length > 0) {
    logger.warn('[QuestionsChallenges] published rows are not playable rounds — regenerating', {
      language,
      refreshDate: refreshDateYmd,
      rows: existingRows.length,
      playable: playableModes.size,
      unplayable: unplayable.map(
        (row) => `${row.type}:${summarizeErrors(roundVerdict(row).errors, 1)[0] ?? 'INVALID'}`,
      ),
    });
    // Take them out of circulation before anything can serve or recycle them.
    await archiveUnplayableRows(language, refreshDateYmd, unplayable);
  }

  /*
   * Everything above is cheap (Redis + DB reads, and archiving rows that must
   * not be served). Everything below authors rounds: football lookups, the AI
   * agent, its retry ladder. A user-facing GET must not wait for that — with a
   * dead provider it held the request open for ~77s and then still answered
   * 503. Detach it and let the caller fall through to its own fast, explicit
   * "no playable round" answer; the round appears on a later request once the
   * background run finishes.
   */
  if (options?.background) {
    triggerBackgroundGeneration(language, refreshDate, timezone, refreshDateYmd);
    return;
  }

  // Serialize generation so the first N users opening any mode today don't
  // all fire the same ~60-120s Gemini call concurrently.
  const lockKey = challengeGenLockKey(refreshDateYmd, language);
  await withChallengeGenLock(lockKey, 180_000, async () => {
    // Re-check inside the lock — another request may have finished generating
    // while we were waiting.
    const doubleCheckRows = await loadPublishedRows(language, refreshDate);
    const doubleCheckModes = playableModesFromRows(doubleCheckRows);
    if (doubleCheckModes.size >= EXPECTED_MODES_PER_DAY) {
      await redisCacheService.set(cacheKey, true, QUESTIONS_CHALLENGE_CACHE_TTL);
      await clearGenerationFailureKeys(refreshDateYmd, language);
      return;
    }

    let generationError: unknown = null;
    try {
      await generateAndPersistDailyChallenges(language, refreshDate, timezone);
    } catch (err) {
      generationError = err;
      logger.error('[QuestionsChallenges] Daily generation failed, attempting recycled fallback', {
        language,
        refreshDate: refreshDateYmd,
        generationBatch,
        provider: 'openrouter',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    }

    /*
     * Fill whatever is still missing from the most recent REAL day.
     *
     * This runs after a partial success too, not only after a hard failure: the
     * generator now publishes the modes it could author instead of discarding
     * the day, so "guess-club found no honest round" leaves one gap to fill
     * rather than eight. Recycling never overwrites a mode that is already
     * playable today, and never publishes a round that fails the contract — so
     * a mode with no real history simply stays unpublished, and the app shows
     * its retry state rather than invented players, clubs and answers.
     */
    const afterGenerationRows = await loadPublishedRows(language, refreshDate);
    const afterGenerationModes = playableModesFromRows(afterGenerationRows);
    if (afterGenerationModes.size < EXPECTED_MODES_PER_DAY) {
      await recycleMostRecentChallenges(language, refreshDate, timezone);
    }

    /*
     * Whether the day is ready is decided by what is ACTUALLY playable now, not
     * by which branch above ran. A day that came out short backs off, so it
     * costs one attempt per cooldown instead of one AI batch per session
     * request — the difference between a 29s 502 and an immediate one.
     */
    const finalRows = await loadPublishedRows(language, refreshDate);
    const finalPlayableModes = playableModesFromRows(finalRows);
    if (finalPlayableModes.size >= EXPECTED_MODES_PER_DAY) {
      await redisCacheService.set(cacheKey, true, QUESTIONS_CHALLENGE_CACHE_TTL);
      await clearGenerationFailureKeys(refreshDateYmd, language);
      return;
    }

    const missingModes = await markGenerationFailureKeys(
      refreshDateYmd,
      language,
      finalPlayableModes,
      QUESTIONS_CHALLENGE_RETRY_COOLDOWN_MS,
    );
    logger.warn('[QuestionsChallenges] day is short of playable modes — backing off before the next attempt', {
      language,
      refreshDate: refreshDateYmd,
      generationBatch,
      provider: 'openrouter',
      playable: finalPlayableModes.size,
      expected: EXPECTED_MODES_PER_DAY,
      missingModes,
      generationError: generationError instanceof Error ? generationError.message : null,
      retryInMs: QUESTIONS_CHALLENGE_RETRY_COOLDOWN_MS,
    });

    if (requestedMode && !finalPlayableModes.has(requestedMode)) {
      const cause = generationError instanceof Error ? generationError : null;
      throw questionGenerationUnavailable({
        mode: requestedMode,
        language,
        refreshDate: refreshDateYmd,
        generationBatch,
        provider: 'openrouter',
        reason: 'MODE_ROUND_NOT_PLAYABLE_AFTER_GENERATION',
        message: cause?.message ?? 'Requested mode round is unavailable after generation attempt',
        stack: cause?.stack,
      });
    }
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

/*
 * The 25 XP "you finished every mode today" bonus was removed with the rest of
 * the Questions XP extras: the product prices a Questions answer at ±1 XP and
 * nothing else, so a bonus here would make a day's XP unexplainable again.
 */

/**
 * Real counters for the Questions hub stats strip. Both come from the user's
 * own answer rows / today's published challenges — the hub must never derive
 * these from a bundled question bank or a hardcoded XP table.
 */
async function buildQuestionsSummary(
  userId: string,
  challenges: Array<{ id: string; xpReward: number }>,
): Promise<QuestionsModesSummary> {
  const challengeIds = challenges.map((challenge) => challenge.id);
  if (challengeIds.length === 0) {
    return {
      answeredCount: 0,
      xpEarnedTotal: 0,
      xpAvailableToday: 0,
    };
  }

  const [answeredCount, earned] = await Promise.all([
    db.userQuestionChallenge.count({
      where: {
        userId,
        challengeId: { in: challengeIds },
        attempts: { gt: 0 },
      },
    }),
    db.userQuestionChallenge.aggregate({
      where: {
        userId,
        challengeId: { in: challengeIds },
      },
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

  // The Questions hub is the entry screen — the very first request of the
  // session. It lists whatever is playable now and must never block on
  // authoring the day.
  await ensureDailyChallenges(language, refreshDate, timezone, undefined, { background: true });

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

/** Today's published row for one mode, with everything the session needs. */
async function findPublishedChallenge(
  mode: QuestionChallengeMode,
  language: QuizLanguage,
  refreshDate: Date,
): Promise<any> {
  return db.dailyQuestionChallenge.findFirst({
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
      source: true,
      streakContribution: true,
      leaderboardEligibility: true,
      content: true,
      answer: true,
    },
  });
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

  /*
   * FAST PATH — a valid published round is served as-is.
   *
   * `ensureDailyChallenges` is a generation path: it can call the AI agent and
   * the football layer, which is minutes of work. Running it before every
   * lookup meant a mode whose round was already sitting in the database still
   * paid for the day's other broken modes on every single request. The round
   * itself is the authority: if it satisfies the contract, nothing needs
   * generating and no upstream call is made.
   */
  let challenge = await findPublishedChallenge(mode, language, refreshDate);
  let verdict = challenge
    ? validateStoredRound({ mode, content: challenge.content, answer: challenge.answer, source: challenge.source })
    : null;

  if (!challenge || !verdict?.ok) {
    if (challenge && verdict) {
      // Published but unplayable. Name the exact reasons, then take the row out
      // of circulation so it can neither be served nor recycled forward.
      logger.error('[QuestionsChallenges] published round fails the round contract', {
        mode,
        language,
        challengeId: challenge.id,
        refreshDate: packDateYmd(challenge.refreshDate, timezone),
        source: challenge.source ?? 'unknown',
        questionCount: verdict.questionCount,
        contentKeys: Object.keys((challenge.content ?? {}) as Record<string, unknown>),
        validationErrors: summarizeErrors(verdict.errors),
      });
      await archiveUnplayableRows(language, packDateYmd(refreshDate, timezone), [challenge]);
    }

    // background: this is the request the user is waiting on — it may trigger
    // generation but must never wait for it.
    await ensureDailyChallenges(language, refreshDate, timezone, mode, { background: true });

    challenge = await findPublishedChallenge(mode, language, refreshDate);
    verdict = challenge
      ? validateStoredRound({ mode, content: challenge.content, answer: challenge.answer, source: challenge.source })
      : null;

    if ((!challenge || !verdict?.ok) && (await recycleMostRecentChallengeForMode(mode, language, refreshDate, timezone))) {
      challenge = await findPublishedChallenge(mode, language, refreshDate);
      verdict = challenge
        ? validateStoredRound({ mode, content: challenge.content, answer: challenge.answer, source: challenge.source })
        : null;
    }
  }

  if (!challenge) {
    const refreshDateYmd = packDateYmd(refreshDate, timezone);
    const base = {
      mode,
      language,
      refreshDate: refreshDateYmd,
      generationBatch: `${refreshDateYmd}:${language}:session`,
      provider: preferredQuizProviderName(),
    };

    // Generation is actually running — say so, rather than reporting a dead end.
    if (isGenerationInFlight(language, refreshDateYmd)) {
      throw questionGenerationInProgress({
        ...base,
        reason: 'GENERATION_IN_PROGRESS',
        message: 'Today\'s round is being prepared',
        retryAfterSeconds: 5,
      });
    }

    throw questionGenerationUnavailable({
      ...base,
      reason: 'MODE_ROUND_MISSING',
      message: 'No playable round exists for the requested mode',
    });
  }

  /*
   * A round that cannot be played is a failure, not a session. Returning it as
   * a 200 is exactly what produced SESSION_LOAD_FAILED on the device: the app
   * received `status: SUCCESS` with `content` holding no `questions`, mapped it
   * to an empty round, and had no error to report beyond the generic one.
   *
   * Surfacing it here gives the client a real, actionable code. There is no
   * canned-content path behind this by design — the app shows its retry state
   * rather than invented players, clubs or stats.
   */
  if (!verdict?.ok) {
    logger.error('[QuestionsChallenges] published round is not playable', {
      mode,
      language,
      challengeId: challenge.id,
      refreshDate: packDateYmd(challenge.refreshDate, timezone),
      source: challenge.source ?? 'unknown',
      questionCount: verdict?.questionCount ?? 0,
      contentKeys: Object.keys((challenge.content ?? {}) as Record<string, unknown>),
      validationErrors: summarizeErrors(verdict?.errors ?? ['UNVALIDATED']),
    });
    throw new Error('QUESTIONS_CHALLENGE_EMPTY');
  }

  logger.info('[QuestionsChallenges] session served', {
    mode,
    language,
    challengeId: challenge.id,
    questionCount: challengeQuestions(challenge.content).length,
    source: (challenge as { source?: unknown }).source ?? 'unknown',
  });

  const questions = challengeQuestions(challenge.content);
  const evaluatePoints = evaluatePointsForMode(mode, questions);
  const now = new Date();

  let progressRow = await db.userQuestionChallenge.findUnique({
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
      answeredPayload: true,
    },
  });

  let sessionProgress = parseSessionProgress(progressRow?.answeredPayload);
  ensureSessionStarted(mode, sessionProgress, questions, now);
  const expiredAdvanced = advanceExpiredQuestions(mode, sessionProgress, questions, now, evaluatePoints);

  const derived = deriveProgressFields(sessionProgress, questions, evaluatePoints);

  if (expiredAdvanced || sessionProgress.sessionStatus === 'IN_PROGRESS') {
    const persistedProgressRow = await db.userQuestionChallenge.upsert({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId: challenge.id,
        },
      },
      create: {
        userId: user.id,
        challengeId: challenge.id,
        completed: derived.completed,
        score: derived.score,
        elapsedTime: progressRow?.elapsedTime ?? 0,
        xpEarned: 0,
        attempts: progressRow?.attempts ?? 0,
        completionPercentage: derived.completionPercentage,
        unlocked: true,
        answeredPayload: sessionProgressToJson(sessionProgress),
        completedAt: derived.completed ? now : null,
      },
      update: {
        completed: derived.completed,
        score: derived.score,
        completionPercentage: derived.completionPercentage,
        answeredPayload: sessionProgressToJson(sessionProgress),
        completedAt: derived.completed ? now : progressRow?.completedAt ?? null,
      },
      select: {
        attempts: true,
        completed: true,
        score: true,
        elapsedTime: true,
        completionPercentage: true,
        unlocked: true,
        answeredPayload: true,
      },
    });
    if (persistedProgressRow) {
      progressRow = persistedProgressRow;
      sessionProgress = parseSessionProgress(persistedProgressRow.answeredPayload);
    }
  }

  return buildSessionView({
    mode,
    challenge: {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      image: challenge.image,
      icon: challenge.icon,
      difficulty: challenge.difficulty,
      xpReward: challenge.xpReward,
      refreshDate: packDateYmd(challenge.refreshDate, timezone),
      refreshTime: challenge.refreshTime,
      streakContribution: challenge.streakContribution,
      leaderboardEligibility: challenge.leaderboardEligibility,
      content: challenge.content as QuestionChallengeSessionDto['content'],
    },
    questions,
    progress: sessionProgress,
    progressMeta: {
      attempts: progressRow?.attempts ?? 0,
      completed: derived.completed,
      score: derived.score,
      elapsedTime: progressRow?.elapsedTime ?? 0,
      completionPercentage: derived.completionPercentage,
      unlocked: progressRow?.unlocked ?? true,
    },
    now,
  });
}

/** What a user has answered so far this round, keyed by question id. */
interface AnsweredQuestionRecord {
  selectedIds: string[];
  isCorrect: boolean;
  completionPercentage: number;
  attempts: number;
}

function readAnsweredRecords(payload: unknown): Record<string, AnsweredQuestionRecord> {
  const session = parseSessionProgress(payload);
  const out: Record<string, AnsweredQuestionRecord> = {};
  for (const [questionId, record] of Object.entries(session.byQuestionId)) {
    if (record.status !== 'answered') continue;
    out[questionId] = {
      selectedIds: record.selectedIds,
      isCorrect: record.isCorrect,
      completionPercentage: record.completionPercentage,
      attempts: record.attempts,
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
    /** Which question of the round — must match the server's current question. */
    questionId?: string;
    selectedIds: string[];
    elapsedTime: number;
    language?: string;
    score?: unknown;
    totalScore?: unknown;
    correctAnswers?: unknown;
    finalScore?: unknown;
  },
  timezone: string,
): Promise<QuestionChallengeSubmitResult> {
  rejectClientScoreFields(payload as Record<string, unknown>);

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
  const verdict = validateStoredRound({
    mode,
    content: challenge.content,
    answer: challenge.answer,
  });
  if (!verdict.ok || questions.length !== roundQuestionCount(mode)) {
    throw new Error('QUESTIONS_CHALLENGE_EMPTY');
  }

  const now = new Date();
  const evaluatePoints = evaluatePointsForMode(mode, questions);

  let txResult: {
    outcome: ReturnType<typeof applyAnswerToSession>;
    alreadyCreditedQuestion: boolean;
    updated: {
      attempts: number;
      completed: boolean;
      score: number;
      elapsedTime: number;
      completionPercentage: number;
      xpEarned: number;
    };
    answer: QuestionChallengeAnswer;
    questionId: string;
    question: QuestionChallengeQuestion | null;
    /** Authoritative coin balance after this answer — see the penalty below. */
    coins: number;
    coinsDeducted: number;
  };

  try {
    txResult = await db.$transaction(async (tx: any) => {
      /*
       * SERIALIZE THIS USER'S SUBMISSIONS.
       *
       * Everything below reads the session, decides whether the question is
       * already closed, and only then writes progress, XP and the coin
       * penalty. Two requests for the same question that arrive together (a
       * double tap, a client retry that raced its own response) would
       * otherwise both read "not answered yet" and both charge — a lost
       * update, and the player pays twice for one mistake.
       *
       * Taking the user row's lock first makes the second request wait for the
       * first to commit; it then reads the answered state and returns the
       * idempotent result. Cheap: one row, held for the length of one answer.
       */
      await tx.$queryRawUnsafe('SELECT id FROM users WHERE id = $1 FOR UPDATE', user.id);

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
          elapsedTime: true,
          answeredPayload: true,
        },
      });

      const sessionProgress = parseSessionProgress(existing?.answeredPayload);
      ensureSessionStarted(mode, sessionProgress, questions, now);
      advanceExpiredQuestions(mode, sessionProgress, questions, now, evaluatePoints);

      const resolvedQuestionId =
        payload.questionId?.trim() ||
        getCurrentQuestionId(sessionProgress, questions) ||
        questions[0]?.id ||
        'q1';
      const question = questions.find((entry) => entry.id === resolvedQuestionId) ?? null;
      const priorRecord = sessionProgress.byQuestionId[resolvedQuestionId];

      const outcome = applyAnswerToSession({
        mode,
        questions,
        roundAnswer,
        questionId: resolvedQuestionId,
        selectedIds: payload.selectedIds,
        now,
        progress: sessionProgress,
        evaluate: (submittedIds, answer) => evaluateChallengeAnswer(mode, submittedIds, answer),
        resolveAnswer: (qid) => resolveQuestionAnswer(questions, roundAnswer, qid),
        evaluatePoints,
      });

      const derived = deriveProgressFields(sessionProgress, questions, evaluatePoints);
      const attempts = outcome.idempotent
        ? (existing?.attempts ?? 0)
        : (existing?.attempts ?? 0) + 1;
      const alreadyCreditedQuestion =
        priorRecord?.status === 'answered' && priorRecord.isCorrect;

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
          completed: derived.completed,
          score: derived.score,
          elapsedTime: Math.max(payload.elapsedTime, 0),
          xpEarned: 0,
          attempts,
          completionPercentage: derived.completionPercentage,
          unlocked: true,
          answeredPayload: sessionProgressToJson(sessionProgress),
          completedAt: derived.completed ? now : null,
        },
        update: {
          completed: derived.completed,
          score: derived.score,
          elapsedTime: Math.max(payload.elapsedTime, 0),
          attempts,
          completionPercentage: derived.completionPercentage,
          answeredPayload: sessionProgressToJson(sessionProgress),
          completedAt: derived.completed ? now : null,
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

      const gradedAnswer = resolveQuestionAnswer(questions, roundAnswer, resolvedQuestionId);
      if (!gradedAnswer) {
        throw new Error('QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND');
      }

      /*
       * WRONG ANSWER → COIN PENALTY.
       *
       * The rule is the app's existing quiz economy, not a new one: the Daily
       * Football Quiz already charges QUIZ_COIN_COST for a wrong answer
       * (quiz-daily.service.ts → `quiz_wrong:<questionId>`), clamps the charge
       * to the balance so coins never go negative, and applies nothing at all
       * on a timeout. Questions modes now do exactly the same thing, so one
       * wrong answer costs the same wherever it is given.
       *
       * IDEMPOTENCY: only a submission that actually CLOSED the question
       * charges. `outcome.idempotent` is true for a retry/double-tap of a
       * question already answered, so a replayed request re-reads the balance
       * and deducts nothing. A time-expired question never reaches here — it
       * throws QUESTIONS_SESSION_TIME_EXPIRED above.
       */
      const chargePenalty = !outcome.idempotent && !outcome.isCorrect && !outcome.timeExpired;
      let coinsAfter = 0;
      let coinsDeducted = 0;

      if (chargePenalty) {
        const account = await tx.user.findUnique({
          where: { id: user.id },
          select: { coins: true },
        });
        const balance = account?.coins ?? 0;
        coinsDeducted = Math.min(balance, WRONG_ANSWER_COIN_PENALTY);
        coinsAfter = balance - coinsDeducted;

        if (coinsDeducted > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: { coins: coinsAfter },
          });
          await tx.coinTransaction.create({
            data: {
              userId: user.id,
              amount: -coinsDeducted,
              type: 'SPEND',
              description: `questions_wrong:${challenge.id}:${resolvedQuestionId}`,
            },
          });
        }
      } else {
        const account = await tx.user.findUnique({
          where: { id: user.id },
          select: { coins: true },
        });
        coinsAfter = account?.coins ?? 0;
      }

      return {
        outcome,
        alreadyCreditedQuestion,
        updated,
        answer: gradedAnswer,
        questionId: resolvedQuestionId,
        question,
        coins: coinsAfter,
        coinsDeducted,
      };
    });
  } catch (err) {
    if (err instanceof QuestionsSessionError) {
      throw new Error(err.code);
    }
    throw err;
  }

  const {
    outcome,
    alreadyCreditedQuestion,
    updated,
    answer,
    questionId,
    question,
    coins,
    coinsDeducted,
  } = txResult;
  /*
   * XP FOR ONE QUESTION — the product's whole rule for this mode:
   *
   *     right → +1 XP        wrong → −1 XP
   *
   * and nothing else. There is no difficulty multiplier, no streak
   * multiplier, no completion bonus and no "all modes today" bonus: those made
   * a round worth ~140 XP, which is where the hub's arbitrary "+140 XP" card
   * label came from and why one question could never be reasoned about.
   *
   * ONE ATTEMPT, ONE MOVEMENT. Both directions carry an idempotency key built
   * from the question itself (not the attempt counter), so a double tap, a
   * retry, a re-mount or a resubmitted answer moves XP exactly once — and a
   * question that was already answered correctly can never be re-credited by
   * answering it again.
   */
  const alreadySettled = outcome.idempotent || alreadyCreditedQuestion;
  const streak = await resolveStreak(user.id);
  const xpIdempotencyKey = `questions.${challenge.id}.${questionId}`;

  let xpEarned = 0;
  /** The user's XP AFTER this answer — what the header shows. */
  let xpSnapshot: { xp: number; level: number } | null = null;
  if (!alreadySettled && !outcome.timeExpired) {
    const xpResult = outcome.isCorrect
      ? await awardXp({
          userId: user.id,
          action: 'QUIZ_ANSWER_CORRECT',
          amount: QUESTION_XP_CORRECT,
          idempotencyKey: xpIdempotencyKey,
          timezone,
          metadata: { challengeId: challenge.id, questionId, mode },
        })
      : await penalizeXp({
          userId: user.id,
          action: 'QUIZ_ANSWER_WRONG',
          amount: QUESTION_XP_WRONG,
          idempotencyKey: xpIdempotencyKey,
          metadata: { challengeId: challenge.id, questionId, mode },
        });
    xpEarned = xpResult.awarded;
    xpSnapshot = { xp: xpResult.newXp, level: xpResult.newLevel };

    if (xpEarned !== 0) {
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
  }

  await redisCacheService.del(challengeProgressCacheKey(user.id, packDateYmd(refreshDate, timezone), language));

  const base = buildSubmitResultBase(
    challenge.id,
    questionId,
    outcome,
    answer,
    question?.hint ?? (challenge.content as any)?.hint ?? null,
  );

  return {
    ...base,
    attempts: updated.attempts,
    elapsedTime: updated.elapsedTime,
    // What this answer actually moved: +1, −1, or 0 when nothing changed
    // hands (a replay, or a question that had already been settled).
    xpEarned,
    bonusXp: 0,
    streakBonus: 0,
    totalXpAwarded: xpEarned,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    // The account's XP after this answer, so the header can show the real
    // number instead of waiting for the next poll.
    ...(xpSnapshot ? { xp: xpSnapshot.xp, level: xpSnapshot.level } : {}),
    idempotent: outcome.idempotent,
    finalResult: outcome.progress.finalResult,
    /*
     * TOP 10 — which of the ten typed names matched, recomputed from the
     * SUBMITTED entries and the stored ranking. Only ever sent with a graded
     * answer, so the reveal can tick each row without the app having held the
     * names beforehand.
     */
    ...(mode === 'top10-challenge' && answer.orderedAnswers?.length
      ? {
          slotResults: gradeTop10Entries(
            outcome.record.selectedIds,
            answer.orderedAnswers,
            top10EvaluationStrategy(),
          ).hits,
        }
      : {}),
    // Authoritative balance AFTER this answer. The app shows this number
    // rather than subtracting the penalty itself — the client is never the
    // source of a balance.
    coins,
    coinsDeducted,
  };
}

/** Legacy helper removed — current question is resolved inside submit transaction. */

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

/**
 * "50:50" — resolves which two options should stay visible: the real correct
 * option (from the round's stored answer) plus exactly one real wrong option,
 * picked deterministically per user/question so repeated taps on the same
 * question can't reroll a different survivor. The correct answer is NEVER
 * exposed on its own — the client only learns "keep these two ids", exactly
 * the same guessing odds a real 50:50 leaves behind — and the round's stored
 * answer is never modified, so grading is unaffected.
 *
 * Only meaningful for a single-correct-answer, flat-option question (the mcq
 * shape every mode except bingo/grid/top10 uses); anything else is reported
 * unavailable rather than guessing at a board-based "wrong answer".
 */
export async function getQuestionFiftyFifty(
  clerkUserId: string,
  mode: QuestionChallengeMode,
  params: { challengeId: string; questionId?: string; language?: string },
  timezone: string,
): Promise<QuestionFiftyFiftyResult> {
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
    select: { id: true, content: true, answer: true },
  });

  if (!challenge) {
    throw new Error('QUESTIONS_CHALLENGE_NOT_FOUND');
  }

  const questions = challengeQuestions(challenge.content);
  const questionId = params.questionId?.trim() || questions[0]?.id || 'q1';
  const question = questions.find((entry) => entry.id === questionId);
  if (!question) {
    throw new Error('QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND');
  }

  const options = question.options ?? [];
  const optionIds = options.map((option) => option.id);
  /*
   * The answer key is resolved the SAME way the grader resolves it
   * (`resolveQuestionAnswer` → normalizedSet(correctIds)), so "which option is
   * correct" can never mean one thing here and another at grading time.
   */
  const answer = resolveQuestionAnswer(
    questions,
    (challenge.answer ?? {}) as QuestionChallengeAnswer,
    questionId,
  );
  const correctSet = normalizedSet(answer?.correctIds);
  const correctOptionIds = optionIds.filter((id) => correctSet.has(normalizeOptionId(id)));
  const wrongOptionIds = optionIds.filter((id) => !correctSet.has(normalizeOptionId(id)));

  /*
   * Refuse rather than half-eliminate. A question whose options do not hold
   * exactly one correct id — or whose ids are not unique — cannot be halved
   * into "the answer + one wrong answer", and returning anything else would
   * hide three options and leave one, which is the bug this guard exists for.
   */
  if (
    correctOptionIds.length !== 1 ||
    wrongOptionIds.length < 1 ||
    new Set(optionIds).size !== optionIds.length
  ) {
    throw new Error('QUESTIONS_CHALLENGE_FIFTY_FIFTY_UNAVAILABLE');
  }

  const rng = seededRng(`${challenge.id}:${questionId}:${user.id}:fifty-fifty`);
  const survivor = wrongOptionIds[Math.floor(rng() * wrongOptionIds.length)]!;

  return {
    challengeId: challenge.id,
    questionId,
    keepIds: [correctOptionIds[0]!, survivor],
  };
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

/**
 * Drop the "today failed to generate" back-off for a day/language.
 *
 * Called after anything that changes the inputs generation depends on — most
 * importantly a roster reseed. Without this a successful seed would still wait
 * out the remaining cooldown before the modes could recover.
 */
export async function clearQuestionsGenerationBackoff(
  timezone = 'UTC',
  refreshDate?: Date,
): Promise<void> {
  const date = refreshDate ?? todayPackDate(timezone);
  const ymd = packDateYmd(date, timezone);
  for (const language of ['ar', 'en'] as QuizLanguage[]) {
    await clearGenerationFailureKeys(ymd, language);
    await redisCacheService.del(challengeCacheKey(ymd, language));
  }
}

/**
 * Build and publish TODAY'S FOOTBALL GRID round, and nothing else.
 *
 * Football Grid is the one mode composed purely from stored provider data, so
 * it can be (re)published on its own in seconds without touching the AI batch —
 * and without rewriting the other seven modes' rounds underneath players who
 * are part-way through them, which a full-day regenerate would do.
 *
 * This is a real generation, not a shortcut: it goes through the same builder
 * the daily job uses and the same publish gate (`persistChallenges`), so a
 * board that fails the round contract is refused here exactly as it would be
 * at 00:00. It exists so the mode can be produced on demand in development and
 * recovered by an operator in production — see scripts/publish-football-grid.ts.
 *
 * Returns true when a round is published.
 */
export async function publishFootballGridRound(options?: {
  language?: QuizLanguage;
  timezone?: string;
  refreshDate?: Date;
}): Promise<boolean> {
  const timezone = options?.timezone ?? 'UTC';
  const refreshDate = options?.refreshDate ?? todayPackDate(timezone);
  const refreshDateYmd = packDateYmd(refreshDate, timezone);
  const languages = options?.language ? [options.language] : (['ar', 'en'] as QuizLanguage[]);

  let publishedAny = false;

  for (const language of languages) {
    const built = await buildAiQuestionChallenges(language, refreshDateYmd, {
      modes: ['football-grid'],
    });
    const round = built?.find((challenge) => challenge.mode === 'football-grid') ?? null;

    if (!round) {
      logger.error('[QuestionsChallenges] Football Grid could not be built', {
        language,
        refreshDate: refreshDateYmd,
      });
      continue;
    }

    const published = await persistChallenges(
      language,
      refreshDate,
      { language, refreshDate: refreshDateYmd, refreshTime: DEFAULT_REFRESH_TIME, challenges: [round] },
      null,
    );

    if (!published.includes('football-grid')) {
      logger.error('[QuestionsChallenges] Football Grid was built but refused at the publish gate', {
        language,
        refreshDate: refreshDateYmd,
      });
      continue;
    }

    publishedAny = true;
    // The day's readiness flag and any back-off are now stale — the mode that
    // was missing is published, so let the next session request re-evaluate.
    await redisCacheService.del(challengeCacheKey(refreshDateYmd, language));
    await clearGenerationFailureKeys(refreshDateYmd, language);
    logger.info('[QuestionsChallenges] Football Grid published', {
      language,
      refreshDate: refreshDateYmd,
    });
  }

  return publishedAny;
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
    }

    // Gap-fill from the most recent real day — after a partial success too, and
    // never over a mode that is already playable today.
    const playable = (await loadPublishedRows(language, refreshDate)).filter((row) => roundVerdict(row).ok);
    if (playable.length < EXPECTED_MODES_PER_DAY) {
      const recycled = await recycleMostRecentChallenges(language, refreshDate, timezone);
      if (!recycled) {
        logger.warn('[QuestionsChallenges] regenerate: day is short of playable modes', {
          language,
          refreshDate: packDateYmd(refreshDate, timezone),
          playable: playable.length,
          expected: EXPECTED_MODES_PER_DAY,
        });
      }
    }
    // An operator/cron regeneration is never subject to the failure back-off —
    // it calls generateAndPersistDailyChallenges directly — and clears it so the
    // next session request re-evaluates immediately.
    await redisCacheService.del(challengeCacheKey(packDateYmd(refreshDate, timezone), language));
    await clearGenerationFailureKeys(packDateYmd(refreshDate, timezone), language);
  }
}
