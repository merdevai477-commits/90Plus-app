/**
 * Generates daily football quiz questions via OpenRouter (Gemini).
 * Entity selection is backend-owned — see QUIZ_GENERATOR_PROMPT.md.
 */

import OpenAI from 'openai';
import { fromZonedTime } from 'date-fns-tz';
import { logger } from '../utils/logger';
import { sanitizeTimezone, todayInTimezone } from '../utils/chat-timezone';
import type {
  QuizDifficulty,
  QuizLanguage,
  QuizOptionKey,
  StoredQuizQuestion,
  QuizQuestionType,
} from '../types/quiz.types';
import type { QuizEntitySlice, QuizPackValidationContext } from '../types/quiz-entity.types';
import { enrichQuizImages } from './quiz-image-enricher.service';
import {
  alignCorrectKeyWithBinding,
  verifyQuestionConsistency,
  validateQuestionAgainstDataset,
  createPackValidationContext,
} from './quiz-answer-validator.service';
import { hasGuessPlayerClue } from './quiz-image-legends';
import {
  QUIZ_DIFFICULTY_COUNTS,
  QUIZ_MIN_CONFIDENCE,
  QUIZ_PACK_SIZE,
} from '../constants/quiz.constants';
import {
  buildQuizEntityDataset,
  enrichSliceForTheme,
  selectDailyEntitySlice,
} from './quiz-entity-dataset.service';
import { buildQuizSystemPrompt, buildQuizUserPrompt } from './quiz-prompt.builder';
import {
  getDefaultTypeTargets,
  getQuizThemeCampaign,
  resolveQuizTheme,
  resolveTopicFocus,
} from '../constants/quiz-theme.config';
import type { QuizTheme } from '../types/quiz-theme.types';
import {
  buildPackGenerationMeta,
  type QuizPackGenerationMeta,
} from '../constants/quiz-generation.constants';

const DIFFICULTY_COUNTS: Record<QuizDifficulty, number> = {
  EASY: QUIZ_DIFFICULTY_COUNTS.EASY,
  MEDIUM: QUIZ_DIFFICULTY_COUNTS.MEDIUM,
  HARD: QUIZ_DIFFICULTY_COUNTS.HARD,
};

const OPTION_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];

const DAILY_TOPIC_POOL = [
  'Premier League clubs and players',
  'La Liga rivalries and stars',
  'Champions League history',
  'Serie A tactics and icons',
  'Bundesliga and German football',
  'World Cup and international tournaments',
  'African and Arab league stars',
  'Transfer market and modern squads',
  'Stadium architecture and famous venues',
  'Club badges and identity trivia',
];

const QUIZ_COMPLETION_OPTS = {
  max_tokens: 16_000,
  response_format: { type: 'json_object' as const },
};

const AI_PARSE_MAX_RETRIES = 2;
const MAX_GENERATION_ATTEMPTS = 3;
const MAX_THEMED_GENERATION_ATTEMPTS = 10;

export type AiQuizResponse =
  | { questions: unknown[]; status?: 'OK' }
  | { questions: []; status: 'INSUFFICIENT_DATA' };

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function dailyTopicFocus(packDate: string, language: QuizLanguage): string {
  const idx = hashSeed(`${packDate}:${language}`) % DAILY_TOPIC_POOL.length;
  return DAILY_TOPIC_POOL[idx];
}

function buildClient(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  if (!apiKey) return null;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ??
    process.env.AI_BASE_URL ??
    'https://openrouter.ai/api/v1';
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      'HTTP-Referer': 'https://90plus.pro',
      'X-Title': '90Plus Daily Quiz',
    },
  });
}

/** Start of "today" for quiz pack selection in the user's timezone. */
export function todayPackDate(timezone?: string): Date {
  const tz = sanitizeTimezone(timezone);
  const ymdLocal = todayInTimezone(tz);
  return fromZonedTime(`${ymdLocal}T00:00:00`, tz);
}

export function packExpiresAt(packDate: Date, timezone?: string): Date {
  const tz = sanitizeTimezone(timezone);
  const ymdLocal = packDateYmd(packDate, tz);
  const [y, m, d] = ymdLocal.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextYmd = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  return fromZonedTime(`${nextYmd}T00:00:00`, tz);
}

export function packDateYmd(packDate: Date, timezone?: string): string {
  const tz = sanitizeTimezone(timezone);
  return todayInTimezone(tz, packDate);
}

function normalizeDifficulty(raw: string): QuizDifficulty {
  const u = String(raw || '').toUpperCase();
  if (u === 'MEDIUM') return 'MEDIUM';
  if (u === 'HARD') return 'HARD';
  return 'EASY';
}

function normalizeType(raw: string): QuizQuestionType {
  const s = String(raw || '').toLowerCase();
  if (['normal', 'image', 'guess_player', 'logo', 'stadium'].includes(s)) {
    return s as QuizQuestionType;
  }
  return 'normal';
}

function hashQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function repairJsonText(jsonText: string): string {
  return jsonText
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1');
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(repairJsonText(text));
  } catch {
    return null;
  }
}

/** Parse AI JSON; propagate INSUFFICIENT_DATA without salvaging partial packs. */
export function parseAiQuizResponse(content: string): AiQuizResponse {
  const stripped = stripMarkdownFences(content.trim());
  const parsed = tryParseJson(stripped);
  if (Array.isArray(parsed)) {
    return { questions: parsed, status: 'OK' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { questions: [] };
  }

  const obj = parsed as { questions?: unknown; status?: string };
  if (obj.status === 'INSUFFICIENT_DATA') {
    return { questions: [], status: 'INSUFFICIENT_DATA' };
  }

  const questions = Array.isArray(obj.questions) ? obj.questions : [];
  return { questions, status: 'OK' };
}

type SlotBudget = {
  diffNeeded: Record<QuizDifficulty, number>;
  typeNeeded: Record<QuizQuestionType, number>;
};

function initSlotBudget(theme: QuizTheme): SlotBudget {
  const campaign = getQuizThemeCampaign(theme);
  const targets = campaign?.typeTargets ?? getDefaultTypeTargets();
  return {
    diffNeeded: {
      EASY: DIFFICULTY_COUNTS.EASY,
      MEDIUM: DIFFICULTY_COUNTS.MEDIUM,
      HARD: DIFFICULTY_COUNTS.HARD,
    },
    typeNeeded: { ...targets },
  };
}

function hasSlot(budget: SlotBudget, q: Pick<StoredQuizQuestion, 'difficulty' | 'type'>): boolean {
  return budget.diffNeeded[q.difficulty] > 0 && (budget.typeNeeded[q.type] ?? 0) > 0;
}

function consumeSlot(budget: SlotBudget, q: Pick<StoredQuizQuestion, 'difficulty' | 'type'>): void {
  budget.diffNeeded[q.difficulty] -= 1;
  budget.typeNeeded[q.type] = (budget.typeNeeded[q.type] ?? 0) - 1;
}

function parseQuestionsFromAi(
  raw: AiQuizResponse,
  language: QuizLanguage,
  packDate: string,
  slice: QuizEntitySlice,
  theme: QuizTheme = resolveQuizTheme(),
  packContext: QuizPackValidationContext = createPackValidationContext(),
  slotBudget?: SlotBudget,
  seenHashes: Set<string> = new Set<string>(),
): StoredQuizQuestion[] {
  if (raw.status === 'INSUFFICIENT_DATA') return [];

  const arr = raw.questions;
  const out: StoredQuizQuestion[] = [];
  const seenInBatch = new Set<string>();

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as Record<string, unknown>;
    const question = String(item.question ?? '').trim();
    if (!question) continue;

    const confidenceRaw = item.confidence;
    const confidence =
      typeof confidenceRaw === 'number' ? confidenceRaw
      : typeof confidenceRaw === 'string' ? Number(confidenceRaw)
      : NaN;
    if (!Number.isFinite(confidence) || confidence < QUIZ_MIN_CONFIDENCE) {
      logger.info(`[QuizGen] Dropped question: confidence ${confidenceRaw}`);
      continue;
    }

    const hash = hashQuestion(question);
    if (seenHashes.has(hash) || seenInBatch.has(hash)) continue;

    const optionsRaw = item.options;
    const options: StoredQuizQuestion['options'] = [];
    if (Array.isArray(optionsRaw)) {
      for (const o of optionsRaw) {
        if (typeof o === 'object' && o && 'key' in o && 'text' in o) {
          const key = String((o as { key: string }).key).toUpperCase() as QuizOptionKey;
          if (OPTION_KEYS.includes(key)) {
            options.push({ key, text: String((o as { text: string }).text).trim() });
          }
        } else if (typeof o === 'string') {
          const idx = options.length;
          if (idx < 4) options.push({ key: OPTION_KEYS[idx], text: o.trim() });
        }
      }
    }

    if (options.length !== 4) continue;

    const correctKey = String(item.correctKey ?? item.correct ?? '').toUpperCase() as QuizOptionKey;
    if (!OPTION_KEYS.includes(correctKey)) continue;
    if (!options.some((o) => o.key === correctKey)) continue;

    const difficulty = normalizeDifficulty(String(item.difficulty ?? 'EASY'));
    const type = normalizeType(String(item.type ?? 'normal'));
    if (!isTypeAllowedForTheme(type, theme)) {
      logger.info(`[QuizGen] Dropped question: type "${type}" not allowed for theme ${theme}`);
      continue;
    }

    let imageBinding: StoredQuizQuestion['imageBinding'] = null;

    if (type !== 'normal') {
      const binding = item.imageBinding as Record<string, unknown> | null;
      if (!binding || typeof binding.kind !== 'string' || typeof binding.entityName !== 'string') {
        continue;
      }

      const kind = binding.kind.toLowerCase();
      if (!['player', 'team', 'league', 'venue'].includes(kind)) continue;

      imageBinding = {
        kind: kind as 'player' | 'team' | 'venue' | 'league',
        entityId: typeof binding.entityId === 'string' ? binding.entityId.trim() : undefined,
        entityName: binding.entityName.trim(),
        teamName: typeof binding.teamName === 'string' ? binding.teamName.trim() : undefined,
      };
    }

    if (type === 'guess_player' && !hasGuessPlayerClue(question)) {
      logger.info(`[QuizGen] Rejected clueless guess_player: "${question.slice(0, 100)}"`);
      continue;
    }

    const imageLayout = item.imageLayout === 'wide' ? 'wide' : ('square' as const);

    const candidate: StoredQuizQuestion = {
      id: `daily-${packDate}-${language}-${out.length + 1}`,
      question,
      type,
      options,
      correctKey,
      difficulty,
      imageUrl: null,
      imageLayout,
      imageType: null,
      imageBinding,
      hint: typeof item.hint === 'string' ? item.hint : null,
    };

    const aligned = alignCorrectKeyWithBinding(candidate, language);
    if (!aligned) continue;

    if (slotBudget && !hasSlot(slotBudget, aligned)) continue;

    const validated = validateQuestionAgainstDataset(aligned, slice, packContext, confidence);
    if (!validated) continue;

    if (slotBudget) consumeSlot(slotBudget, validated);
    seenHashes.add(hash);
    seenInBatch.add(hash);
    out.push({ ...validated, confidence });
  }

  return out;
}

function validateDistribution(questions: StoredQuizQuestion[]): boolean {
  const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
  for (const q of questions) counts[q.difficulty]++;
  return (
    counts.EASY === DIFFICULTY_COUNTS.EASY &&
    counts.MEDIUM === DIFFICULTY_COUNTS.MEDIUM &&
    counts.HARD === DIFFICULTY_COUNTS.HARD
  );
}

function validateTypeMix(questions: StoredQuizQuestion[], theme: QuizTheme): boolean {
  const campaign = getQuizThemeCampaign(theme);
  if (!campaign) return true;

  const counts: Partial<Record<QuizQuestionType, number>> = {};
  for (const q of questions) {
    counts[q.type] = (counts[q.type] ?? 0) + 1;
  }

  for (const [type, expected] of Object.entries(campaign.typeTargets)) {
    const actual = counts[type as QuizQuestionType] ?? 0;
    if (actual !== expected) return false;
  }

  for (const q of questions) {
    if (!campaign.allowedTypes.includes(q.type)) return false;
  }

  return true;
}

function isTypeAllowedForTheme(type: QuizQuestionType, theme: QuizTheme): boolean {
  const campaign = getQuizThemeCampaign(theme);
  if (!campaign) return true;
  return campaign.allowedTypes.includes(type);
}

function renumberQuestionIds(
  questions: StoredQuizQuestion[],
  language: QuizLanguage,
  packDate: string,
): StoredQuizQuestion[] {
  return questions.map((q, i) => ({
    ...q,
    id: `daily-${packDate}-${language}-${i + 1}`,
  }));
}

function historyQuestionHashes(history: StoredQuizQuestion[]): Set<string> {
  return new Set(history.map((q) => hashQuestion(q.question)));
}

function excludeHistoricalQuestions(
  questions: StoredQuizQuestion[],
  history: StoredQuizQuestion[],
): StoredQuizQuestion[] {
  if (history.length === 0) return questions;
  const seen = historyQuestionHashes(history);
  return questions.filter((q) => !seen.has(hashQuestion(q.question)));
}

function formatAvoidSample(questions: StoredQuizQuestion[], max = 24): string[] {
  return questions.slice(0, max).map((q) => q.question.slice(0, 90));
}

async function enrichAndFilterValid(
  questions: StoredQuizQuestion[],
  packDate: string,
  language: QuizLanguage,
): Promise<StoredQuizQuestion[]> {
  const enriched = await enrichQuizImages(questions, packDate);
  return enriched
    .filter((q): q is StoredQuizQuestion => q !== null)
    .map((q) => verifyQuestionConsistency(q, language))
    .filter((q): q is StoredQuizQuestion => {
      if (q === null) return false;
      if (q.type === 'guess_player' && !q.imageUrl?.trim()) return false;
      return true;
    });
}

async function callQuizAiJson(
  system: string,
  user: string,
  temperature: number,
): Promise<AiQuizResponse> {
  const client = buildClient();
  if (!client) throw new Error('OpenRouter API key not configured');

  const model = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  let lastContent = '{}';

  for (let attempt = 1; attempt <= AI_PARSE_MAX_RETRIES; attempt += 1) {
    const completion = await client.chat.completions.create({
      model,
      temperature: attempt === 1 ? temperature : Math.min(temperature, 0.7),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...QUIZ_COMPLETION_OPTS,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    lastContent = content;
    const parsed = parseAiQuizResponse(content);

    if (parsed.status === 'INSUFFICIENT_DATA') {
      return parsed;
    }

    if (parsed.questions.length > 0) {
      return parsed;
    }

    logger.warn('[QuizGen] AI returned unparsable or empty JSON', {
      attempt,
      finishReason: completion.choices[0]?.finish_reason,
      length: content.length,
      preview: content.slice(0, 120).replace(/\s+/g, ' '),
    });
  }

  return parseAiQuizResponse(lastContent);
}

async function attemptOpenRouterCall(
  language: QuizLanguage,
  packDate: string,
  slice: QuizEntitySlice,
  avoidFromHistory: StoredQuizQuestion[] = [],
  theme: QuizTheme = resolveQuizTheme(),
  packContext?: QuizPackValidationContext,
  slotBudget?: SlotBudget,
  seenHashes?: Set<string>,
): Promise<{ questions: StoredQuizQuestion[]; insufficient: boolean }> {
  const topicFocus = resolveTopicFocus(theme, dailyTopicFocus(packDate, language));
  const system = buildQuizSystemPrompt({ language, topicFocus, theme });
  const user = buildQuizUserPrompt({
    language,
    packDate,
    topicFocus,
    slice,
    theme,
    avoidQuestionSamples: formatAvoidSample(avoidFromHistory),
  });

  const parsed = await callQuizAiJson(system, user, 0.85);
  if (parsed.status === 'INSUFFICIENT_DATA') {
    return { questions: [], insufficient: true };
  }

  const parsedQuestions = parseQuestionsFromAi(
    parsed,
    language,
    packDate,
    slice,
    theme,
    packContext,
    slotBudget,
    seenHashes,
  );
  return { questions: parsedQuestions, insufficient: false };
}

async function buildPackFromDataset(
  language: QuizLanguage,
  packDate: string,
  avoidFromHistory: StoredQuizQuestion[] = [],
): Promise<StoredQuizQuestion[]> {
  const theme = resolveQuizTheme();
  const campaign = getQuizThemeCampaign(theme);
  if (campaign) {
    logger.info(`[QuizGen] Active campaign theme: ${theme}`);
  }

  const datasetResult = await buildQuizEntityDataset();
  if (!datasetResult.ok) {
    throw new Error(
      `Entity dataset insufficient: players=${datasetResult.counts.players}, clubs=${datasetResult.counts.clubs}, stadiums=${datasetResult.counts.stadiums}`,
    );
  }

  const maxAttempts = campaign ? MAX_THEMED_GENERATION_ATTEMPTS : MAX_GENERATION_ATTEMPTS;
  const packContext = createPackValidationContext();
  const slotBudget = initSlotBudget(theme);
  const seenHashes = historyQuestionHashes(avoidFromHistory);
  const accumulated: StoredQuizQuestion[] = [];

  for (let attempt = 0; attempt < maxAttempts && accumulated.length < QUIZ_PACK_SIZE; attempt += 1) {
    const slice = enrichSliceForTheme(
      selectDailyEntitySlice(datasetResult.dataset, packDate, language, attempt),
      theme,
    );
    logger.info(
      `[QuizGen] Attempt ${attempt + 1}/${maxAttempts} slice: ${slice.players.length} players, ${slice.clubs.length} clubs, ${slice.stadiums.length} stadiums, nations=${slice.nations?.length ?? 0} (pack ${accumulated.length}/${QUIZ_PACK_SIZE})`,
    );

    const { questions: raw, insufficient } = await attemptOpenRouterCall(
      language,
      packDate,
      slice,
      avoidFromHistory,
      theme,
      packContext,
      slotBudget,
      seenHashes,
    );

    if (insufficient) {
      logger.warn(`[QuizGen] AI returned INSUFFICIENT_DATA on attempt ${attempt + 1}`);
      continue;
    }

    const enriched = await enrichAndFilterValid(raw, packDate, language);
    for (const q of enriched) {
      if (accumulated.length >= QUIZ_PACK_SIZE) break;
      accumulated.push(q);
    }

    logger.info(
      `[QuizGen] Accumulated ${accumulated.length}/${QUIZ_PACK_SIZE} after attempt ${attempt + 1}`,
    );
  }

  if (accumulated.length !== QUIZ_PACK_SIZE) {
    throw new Error(
      `Failed to generate valid ${QUIZ_PACK_SIZE}-question pack after ${maxAttempts} attempts (got ${accumulated.length})`,
    );
  }

  if (!validateDistribution(accumulated)) {
    throw new Error('Generated pack has invalid difficulty distribution');
  }

  if (!validateTypeMix(accumulated, theme)) {
    throw new Error(`Generated pack has invalid type mix for theme ${theme}`);
  }

  return renumberQuestionIds(accumulated, language, packDate);
}

export async function generateDailyQuizPack(
  language: QuizLanguage,
  packDateInput?: Date,
  avoidFromHistory: StoredQuizQuestion[] = [],
  timezone?: string,
): Promise<{
  packDate: Date;
  expiresAt: Date;
  questions: StoredQuizQuestion[];
  generationMeta: QuizPackGenerationMeta;
}> {
  const packDate = packDateInput ?? todayPackDate(timezone);
  const dateStr = packDateYmd(packDate, timezone);
  const theme = resolveQuizTheme();
  logger.info(
    `[QuizGen] Generating pack ${dateStr} (${language}), theme=${theme}, avoiding ${avoidFromHistory.length} prior question(s)`,
  );

  const questions = await buildPackFromDataset(language, dateStr, avoidFromHistory);
  return {
    packDate,
    expiresAt: packExpiresAt(packDate, timezone),
    questions,
    generationMeta: buildPackGenerationMeta(false),
  };
}
