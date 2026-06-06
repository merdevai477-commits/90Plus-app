/**
 * Generates daily football quiz questions via OpenRouter (Gemini).
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
  QuizImageType,
} from '../types/quiz.types';
import { enrichQuizImages } from './quiz-image-enricher.service';
import {
  isImageDependentQuestionText,
  isRetiredLegendPlayerName,
  hasGuessPlayerClue,
} from './quiz-image-legends';
import { QUIZ_DIFFICULTY_COUNTS, QUIZ_PACK_SIZE } from '../constants/quiz.constants';

const DIFFICULTY_COUNTS: Record<QuizDifficulty, number> = {
  EASY: QUIZ_DIFFICULTY_COUNTS.EASY,
  MEDIUM: QUIZ_DIFFICULTY_COUNTS.MEDIUM,
  HARD: QUIZ_DIFFICULTY_COUNTS.HARD,
};

const OPTION_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];

/** Target count per question type for a 15-question daily pack */
const TYPE_TARGETS: Record<QuizQuestionType, number> = {
  normal: 3,
  guess_player: 3,
  logo: 3,
  stadium: 3,
  image: 3,
};

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

function countQuestionTypes(questions: StoredQuizQuestion[]): Map<QuizQuestionType, number> {
  const counts = new Map<QuizQuestionType, number>();
  for (const q of questions) {
    counts.set(q.type, (counts.get(q.type) ?? 0) + 1);
  }
  return counts;
}

function validateTypeMix(questions: StoredQuizQuestion[]): boolean {
  const distinct = new Set(questions.map((q) => q.type));
  return distinct.size >= 3;
}

function typeMixSummary(questions: StoredQuizQuestion[]): string {
  const counts = countQuestionTypes(questions);
  return Array.from(counts.entries())
    .map(([type, count]) => `${type}:${count}`)
    .join(', ');
}

const GUESS_PLAYER_PROMPT_RULES = `
CRITICAL — guess_player (photo hidden until answer):
- The "question" field MUST include a clear factual clue so users can guess WITHOUT seeing the photo.
- NEVER use only generic text like "Who is this player?" or "من هو هذا اللاعب؟" — ALWAYS add club, nationality, position, nickname, stats, or achievement BEFORE the final "who is he?" part.
- Arabic examples:
  - "يلعب في ليفربول ويلقب بملك مصر — من هو؟"
  - "مهاجم نرويجي يسجل أهدافاً كثيرة مع مانشستر سيتي — من هو؟"
- English examples:
  - "This Egyptian winger plays for Liverpool — who is he?"
  - "Norwegian striker at Manchester City — guess the player."
- Options must be 4 plausible players in the same era/position.
- ONLY active 2024-2026 players with API photos (Salah, Haaland, Mbappe, Vinicius Junior, Bellingham, Kane, etc.).
- NEVER retired legends for guess_player.`;

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

function ymd(date: Date): string {
  return date.toISOString().split('T')[0];
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

function normalizeImageType(raw: string | null | undefined): QuizImageType {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (['player', 'team', 'league', 'flag', 'venue'].includes(s)) {
    return s as QuizImageType;
  }
  return null;
}

function hashQuestion(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

const QUIZ_COMPLETION_OPTS = {
  max_tokens: 12_000,
  response_format: { type: 'json_object' as const },
};

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

function salvageQuestionsJson(jsonText: string): { questions: unknown[] } | null {
  const keyIdx = jsonText.indexOf('"questions"');
  if (keyIdx < 0) return null;
  const arrStart = jsonText.indexOf('[', keyIdx);
  if (arrStart < 0) return null;

  const questions: unknown[] = [];
  let i = arrStart + 1;

  while (i < jsonText.length) {
    while (i < jsonText.length && /[\s,]/.test(jsonText[i])) i += 1;
    if (jsonText[i] === ']') break;
    if (jsonText[i] !== '{') break;

    let depth = 0;
    let inString = false;
    let escape = false;
    const start = i;

    for (; i < jsonText.length; i += 1) {
      const c = jsonText[i];
      if (inString) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === '{') depth += 1;
      if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          const objStr = jsonText.slice(start, i + 1);
          const obj = tryParseJson(objStr);
          if (obj && typeof obj === 'object') questions.push(obj);
          i += 1;
          break;
        }
      }
    }
  }

  if (questions.length === 0) return null;
  logger.info(`[QuizGen] Salvaged ${questions.length} question object(s) from broken JSON`);
  return { questions };
}

function parseAiJsonContent(content: string): unknown {
  const stripped = stripMarkdownFences(content.trim());
  const direct = tryParseJson(stripped);
  if (direct) return direct;

  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    const fromObject = tryParseJson(match[0]);
    if (fromObject) return fromObject;

    const salvaged = salvageQuestionsJson(match[0]);
    if (salvaged) return salvaged;
  }

  logger.warn('[QuizGen] Failed to parse AI JSON after cleanup', {
    length: content.length,
    preview: content.slice(0, 280).replace(/\s+/g, ' '),
  });
  return { questions: [] };
}

function parseQuestionsFromAi(
  raw: unknown,
  language: QuizLanguage,
  packDate: string,
): StoredQuizQuestion[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { questions?: unknown })?.questions)
      ? (raw as { questions: unknown[] }).questions
      : [];

  const out: StoredQuizQuestion[] = [];
  const seenHashes = new Set<string>();

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as Record<string, unknown>;
    const question = String(item.question ?? '').trim();
    if (!question) continue;

    const hash = hashQuestion(question);
    if (seenHashes.has(hash)) continue; // duplicate removal
    seenHashes.add(hash);

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
    
    // Only accept exactly 4 options. If not 4, this question is invalid.
    if (options.length !== 4) continue;

    let correctKey = String(item.correctKey ?? item.correct ?? '').toUpperCase() as QuizOptionKey;
    if (!OPTION_KEYS.includes(correctKey)) correctKey = 'A';
    
    // Ensure correctKey actually exists in options
    if (!options.some(o => o.key === correctKey)) {
      correctKey = options[0].key;
    }

    const difficulty = normalizeDifficulty(String(item.difficulty ?? 'EASY'));
    let type = normalizeType(String(item.type ?? 'normal'));
    
    let imageBinding: StoredQuizQuestion['imageBinding'] = null;
    let imageUrl: string | null = null;
    
    if (type !== 'normal') {
      const binding = item.imageBinding as Record<string, unknown> | null;
      if (!binding || typeof binding.kind !== 'string' || typeof binding.entityName !== 'string') {
        continue; // Reject image-based question if imageBinding is missing or invalid
      }
      
      const kind = binding.kind.toLowerCase();
      if (!['player', 'team', 'league', 'venue'].includes(kind)) {
        continue; // Reject invalid kind
      }
      
      imageBinding = {
        kind: kind as 'player' | 'team' | 'venue' | 'league',
        entityName: binding.entityName.trim(),
        teamName: typeof binding.teamName === 'string' ? binding.teamName.trim() : undefined
      };
      imageUrl = null;

      if (
        type === 'guess_player' &&
        imageBinding.kind === 'player' &&
        isRetiredLegendPlayerName(imageBinding.entityName) &&
        !isImageDependentQuestionText(question)
      ) {
        type = 'normal';
        imageBinding = null;
        imageUrl = null;
      }
    }

    if (type === 'guess_player' && !hasGuessPlayerClue(question)) {
      logger.info(`[QuizGen] Rejected clueless guess_player: "${question.slice(0, 100)}"`);
      continue;
    }
    
    const imageLayout =
      item.imageLayout === 'wide' ? 'wide' : ('square' as const);

    out.push({
      id: `daily-${packDate}-${language}-${out.length + 1}`,
      question,
      type,
      options: options,
      correctKey,
      difficulty,
      imageUrl,
      imageLayout,
      imageType: null, // deprecated
      imageBinding,
      hint: typeof item.hint === 'string' ? item.hint : null,
    });
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

function rebalanceDifficulties(questions: StoredQuizQuestion[]): StoredQuizQuestion[] {
  const sorted = [...questions];
  const targets = [
    ...Array(DIFFICULTY_COUNTS.EASY).fill('EASY' as QuizDifficulty),
    ...Array(DIFFICULTY_COUNTS.MEDIUM).fill('MEDIUM' as QuizDifficulty),
    ...Array(DIFFICULTY_COUNTS.HARD).fill('HARD' as QuizDifficulty),
  ];
  return sorted.slice(0, QUIZ_PACK_SIZE).map((q, i) => ({
    ...q,
    id: q.id.replace(/-\d+$/, `-${i + 1}`),
    difficulty: targets[i] ?? 'EASY',
  }));
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

function mergeUniqueQuestions(
  base: StoredQuizQuestion[],
  additions: StoredQuizQuestion[],
): StoredQuizQuestion[] {
  const seen = new Set(base.map((q) => hashQuestion(q.question)));
  const merged = [...base];
  for (const q of additions) {
    const h = hashQuestion(q.question);
    if (seen.has(h)) continue;
    seen.add(h);
    merged.push(q);
  }
  return merged;
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

function formatAvoidSample(questions: StoredQuizQuestion[], max = 24): string {
  return questions
    .slice(0, max)
    .map((q) => q.question.slice(0, 90))
    .join(' | ');
}

async function enrichAndFilterValid(
  questions: StoredQuizQuestion[],
  packDate: string,
): Promise<StoredQuizQuestion[]> {
  const enriched = await enrichQuizImages(questions, packDate);
  return enriched.filter((q): q is StoredQuizQuestion => {
    if (q === null) return false;
    if (q.type === 'guess_player' && !q.imageUrl?.trim()) {
      return false;
    }
    return true;
  });
}

async function attemptOpenRouterCall(
  language: QuizLanguage,
  packDate: string,
  avoidFromHistory: StoredQuizQuestion[] = [],
): Promise<StoredQuizQuestion[]> {
  const client = buildClient();
  if (!client) throw new Error('OpenRouter API key not configured');

  const model = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  const langLabel = language === 'ar' ? 'Arabic' : 'English';

  const system = `You are a world football trivia writer for the 90Plus app.
Return ONLY valid JSON (no markdown): {"questions":[...]} with exactly ${QUIZ_PACK_SIZE} multiple-choice questions (MCQ).
Distribution MUST BE EXACTLY: ${QUIZ_DIFFICULTY_COUNTS.EASY} EASY, ${QUIZ_DIFFICULTY_COUNTS.MEDIUM} MEDIUM, ${QUIZ_DIFFICULTY_COUNTS.HARD} HARD.
Do NOT generate duplicate questions.
Each question object:
- question (string, ${langLabel})
- type (string, strictly one of: "normal", "image", "guess_player", "logo", "stadium")
- options: array of EXACTLY 4 objects {key:"A"|"B"|"C"|"D", text:string}
- correctKey: "A"|"B"|"C"|"D" (must match one of the options)
- difficulty: "EASY"|"MEDIUM"|"HARD"
- imageBinding: required IF type is not "normal". Object with:
  - kind: "player" | "team" | "league" | "venue"
  - entityName: specific name to search for (e.g. "Lionel Messi", "Real Madrid", "Barcelona" not "FC Barcelona", "Vinicius Junior" not "Vinicius Jr.")
  - teamName: string. REQUIRED ONLY if kind is "player" (player's CURRENT club in 2024-2026, e.g. Mbappe -> "Real Madrid", Salah -> "Liverpool"). Do NOT use former clubs.
- imageLayout: "square" or "wide"
- hint: short hint string in ${langLabel} (do not reveal the answer)

CRITICAL — guess_player / player images:
- For type "guess_player" with kind "player", ONLY use currently active or very recently active players whose photos exist in football APIs (2024-2026 squads).
${GUESS_PLAYER_PROMPT_RULES}
- NEVER use retired legends or historical players for guess_player / image-based player questions: Paolo Maldini, Zinedine Zidane, Ronaldo Nazario, Ronaldinho, Diego Maradona, Pele, David Beckham, Andrea Pirlo, Xavi, Iniesta, Buffon, Totti, etc.
- Retired legends MAY appear ONLY in type "normal" (text-only, no imageBinding).
- Prefer "logo" and "stadium" and "normal" for history/legends trivia.

- Include at least 3 type "guess_player" questions (each with a written clue in the question text).
- Use type "logo" for club badges, "stadium" for venues, "normal" for history/legends text trivia.
- TYPE MIX (exactly ${QUIZ_PACK_SIZE} questions): ${Object.entries(TYPE_TARGETS)
    .map(([type, count]) => `${count}× "${type}"`)
    .join(', ')}.
- Rotate topics away from yesterday — focus today's pack on: {TOPIC_FOCUS}.

Never generate text-input or essay questions. Exactly ${QUIZ_PACK_SIZE} questions.`;

  const topicFocus = dailyTopicFocus(packDate, language);
  const systemWithTopic = system.replace('{TOPIC_FOCUS}', topicFocus);
  const historyAvoid = avoidFromHistory.length
    ? ` Do NOT repeat or closely paraphrase any of these recent daily questions: ${formatAvoidSample(avoidFromHistory)}.`
    : '';

  const user = `Generate today's (${packDate}) daily football quiz in ${langLabel}. Topic focus: ${topicFocus}. Ensure no duplicates, exactly 4 options per question, correctKey exists, and the exact type mix above.${historyAvoid}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.85,
    messages: [
      { role: 'system', content: systemWithTopic },
      { role: 'user', content: user },
    ],
    ...QUIZ_COMPLETION_OPTS,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const parsed = parseAiJsonContent(content);
  const parsedQuestions = parseQuestionsFromAi(parsed, language, packDate);
  if (parsedQuestions.length === 0) {
    logger.warn(
      `[QuizGen] Initial AI call returned 0 parseable questions (${content.length} chars)`,
    );
  }
  return parsedQuestions;
}

async function generateReplacementQuestions(
  count: number,
  language: QuizLanguage,
  packDate: string,
  existing: StoredQuizQuestion[],
  avoidFromHistory: StoredQuizQuestion[] = [],
): Promise<StoredQuizQuestion[]> {
  const client = buildClient();
  if (!client) throw new Error('OpenRouter API key not configured');

  const model = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  const langLabel = language === 'ar' ? 'Arabic' : 'English';
  const avoidSample = formatAvoidSample([...avoidFromHistory, ...existing].slice(0, 24));

  const system = `You are a football trivia writer for 90Plus.
Return ONLY valid JSON: {"questions":[...]} with exactly ${count} NEW multiple-choice questions.
Each question: question, type (normal|image|guess_player|logo|stadium), options (4x A-D), correctKey, difficulty (EASY|MEDIUM|HARD), imageBinding when not normal, imageLayout, hint.
${GUESS_PLAYER_PROMPT_RULES}
For guess_player: ONLY active 2024-2026 players with real club photos (Salah, Haaland, Mbappe, Vinicius Junior, Bellingham, Kane, etc.).
Use type "normal" for legend/history trivia without images.
Language: ${langLabel}. No duplicates.`;

  const user = `Generate ${count} replacement questions for pack ${packDate}. Do NOT repeat or paraphrase: ${avoidSample}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.9,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ...QUIZ_COMPLETION_OPTS,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const parsed = parseAiJsonContent(content);

  return parseQuestionsFromAi(parsed, language, packDate);
}

async function generateNormalOnlyReplacements(
  count: number,
  language: QuizLanguage,
  packDate: string,
  existing: StoredQuizQuestion[],
  avoidFromHistory: StoredQuizQuestion[] = [],
): Promise<StoredQuizQuestion[]> {
  const client = buildClient();
  if (!client) throw new Error('OpenRouter API key not configured');

  const model = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  const langLabel = language === 'ar' ? 'Arabic' : 'English';
  const avoidSample = formatAvoidSample([...avoidFromHistory, ...existing].slice(0, 20));

  const system = `You are a football trivia writer for 90Plus.
Return ONLY valid JSON: {"questions":[...]} with exactly ${count} NEW text-only multiple-choice questions.
Every question MUST use type "normal" with NO imageBinding.
Language: ${langLabel}. Mix EASY/MEDIUM/HARD. No duplicates.`;

  const user = `Generate ${count} normal football trivia questions for ${packDate}. Avoid: ${avoidSample}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.85,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ...QUIZ_COMPLETION_OPTS,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const parsed = parseAiJsonContent(content);
  const parsedQuestions = parseQuestionsFromAi(parsed, language, packDate);
  return parsedQuestions.map((q) => ({
    ...q,
    type: 'normal' as const,
    imageBinding: null,
    imageUrl: null,
  }));
}

async function generateInitialQuestionsInBatches(
  language: QuizLanguage,
  packDate: string,
  avoidFromHistory: StoredQuizQuestion[] = [],
): Promise<StoredQuizQuestion[]> {
  let merged: StoredQuizQuestion[] = [];
  const batchSize = 5;
  const batches = Math.ceil(QUIZ_PACK_SIZE / batchSize);

  for (let batch = 0; batch < batches; batch += 1) {
    const needed = Math.min(batchSize, QUIZ_PACK_SIZE - merged.length);
    if (needed <= 0) break;
    const batchQuestions = await generateReplacementQuestions(
      needed,
      language,
      packDate,
      merged,
      avoidFromHistory,
    );
    merged = mergeUniqueQuestions(merged, batchQuestions);
    logger.info(
      `[QuizGen] Batch ${batch + 1}/${batches}: ${merged.length}/${QUIZ_PACK_SIZE} questions collected`,
    );
  }

  return merged;
}

async function buildPackWithReplacements(
  language: QuizLanguage,
  packDate: string,
  avoidFromHistory: StoredQuizQuestion[] = [],
): Promise<StoredQuizQuestion[]> {
  let questions = await attemptOpenRouterCall(language, packDate, avoidFromHistory);
  if (questions.length === 0) {
    logger.warn('[QuizGen] Full-pack AI parse failed — falling back to batched generation');
    questions = await generateInitialQuestionsInBatches(language, packDate, avoidFromHistory);
  }
  questions = excludeHistoricalQuestions(
    await enrichAndFilterValid(questions, packDate),
    avoidFromHistory,
  );

  if (questions.length < Math.ceil(QUIZ_PACK_SIZE * 0.6)) {
    logger.warn(
      `[QuizGen] Low post-enrich yield (${questions.length}/${QUIZ_PACK_SIZE}) — supplementing with batched generation`,
    );
    const batched = await generateInitialQuestionsInBatches(language, packDate, avoidFromHistory);
    const batchedValid = excludeHistoricalQuestions(
      await enrichAndFilterValid(batched, packDate),
      avoidFromHistory,
    );
    questions = mergeUniqueQuestions(questions, batchedValid);
  }

  let fillRound = 0;
  const MAX_FILL_ROUNDS = 6;
  let stagnantRounds = 0;

  while (questions.length < QUIZ_PACK_SIZE && fillRound < MAX_FILL_ROUNDS) {
    fillRound++;
    const beforeCount = questions.length;
    const needed = QUIZ_PACK_SIZE - questions.length;
    const buffer = Math.min(needed + 2, 6);
    logger.info(
      `[QuizGen] Pack has ${questions.length}/${QUIZ_PACK_SIZE} — generating ${buffer} replacement question(s) (round ${fillRound})`,
    );

    const replacements = await generateReplacementQuestions(
      buffer,
      language,
      packDate,
      questions,
      avoidFromHistory,
    );
    const validReplacements = excludeHistoricalQuestions(
      await enrichAndFilterValid(replacements, packDate),
      avoidFromHistory,
    );
    questions = mergeUniqueQuestions(questions, validReplacements);

    if (questions.length === beforeCount) {
      stagnantRounds += 1;
      if (stagnantRounds >= 2) {
        logger.warn('[QuizGen] Replacement rounds stalled — switching to normal text fallback early');
        break;
      }
    } else {
      stagnantRounds = 0;
    }
  }

  if (questions.length < QUIZ_PACK_SIZE) {
    let stillNeeded = QUIZ_PACK_SIZE - questions.length;
    while (stillNeeded > 0) {
      const chunk = Math.min(stillNeeded + 1, 5);
      logger.info(
        `[QuizGen] Image rounds exhausted at ${questions.length}/${QUIZ_PACK_SIZE} — generating ${chunk} normal text fallback question(s)`,
      );
      const normalFallback = await generateNormalOnlyReplacements(
        chunk,
        language,
        packDate,
        questions,
        avoidFromHistory,
      );
      const before = questions.length;
      questions = mergeUniqueQuestions(
        questions,
        excludeHistoricalQuestions(normalFallback, avoidFromHistory),
      );
      if (questions.length === before) break;
      stillNeeded = QUIZ_PACK_SIZE - questions.length;
    }
  }

  if (questions.length < QUIZ_PACK_SIZE) {
    throw new Error(
      `Only ${questions.length} valid unique questions after image resolution and ${fillRound} replacement round(s), expected exactly ${QUIZ_PACK_SIZE}.`,
    );
  }

  questions = questions.slice(0, QUIZ_PACK_SIZE);
  if (!validateDistribution(questions)) {
    questions = rebalanceDifficulties(questions);
  }

  if (!validateTypeMix(questions)) {
    logger.warn(
      `[QuizGen] Type mix too narrow (${typeMixSummary(questions)}) — regenerating slice`,
    );
    const replacements = await generateReplacementQuestions(
      6,
      language,
      packDate,
      questions,
      avoidFromHistory,
    );
    const validReplacements = excludeHistoricalQuestions(
      await enrichAndFilterValid(replacements, packDate),
      avoidFromHistory,
    );
    questions = mergeUniqueQuestions(questions, validReplacements).slice(0, QUIZ_PACK_SIZE);
    if (!validateTypeMix(questions)) {
      logger.warn(
        `[QuizGen] Type mix still narrow after regen (${typeMixSummary(questions)})`,
      );
    }
  }

  return renumberQuestionIds(questions, language, packDate);
}

async function callOpenRouter(
  language: QuizLanguage,
  packDate: string,
  avoidFromHistory: StoredQuizQuestion[] = [],
): Promise<StoredQuizQuestion[]> {
  let attempts = 0;
  const MAX_ATTEMPTS = 3; // 1 initial + 2 retries
  let lastError: Error | null = null;

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;
      logger.info(`[QuizGen] Calling AI for ${packDate} (${language}) - Attempt ${attempts}`);
      return await buildPackWithReplacements(language, packDate, avoidFromHistory);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`[QuizGen] Attempt ${attempts} failed: ${lastError.message}`);
    }
  }

  throw new Error(`Failed to generate valid pack after ${MAX_ATTEMPTS} attempts. Last error: ${lastError?.message}`);
}

export async function generateDailyQuizPack(
  language: QuizLanguage,
  packDateInput?: Date,
  avoidFromHistory: StoredQuizQuestion[] = [],
  timezone?: string,
): Promise<{ packDate: Date; expiresAt: Date; questions: StoredQuizQuestion[] }> {
  const packDate = packDateInput ?? todayPackDate(timezone);
  const dateStr = packDateYmd(packDate, timezone);
  logger.info(
    `[QuizGen] Generating pack ${dateStr} (${language}), avoiding ${avoidFromHistory.length} prior question(s)`,
  );

  const questions = await callOpenRouter(language, dateStr, avoidFromHistory);
  return {
    packDate,
    expiresAt: packExpiresAt(packDate, timezone),
    questions,
  };
}

