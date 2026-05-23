/**
 * Generates daily football quiz questions via OpenRouter (Gemini).
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';
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
} from './quiz-image-legends';
import { QUIZ_DIFFICULTY_COUNTS, QUIZ_PACK_SIZE } from '../constants/quiz.constants';

const DIFFICULTY_COUNTS: Record<QuizDifficulty, number> = {
  EASY: QUIZ_DIFFICULTY_COUNTS.EASY,
  MEDIUM: QUIZ_DIFFICULTY_COUNTS.MEDIUM,
  HARD: QUIZ_DIFFICULTY_COUNTS.HARD,
};

const OPTION_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];

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
      'HTTP-Referer': 'https://90plus.app',
      'X-Title': '90Plus Daily Quiz',
    },
  });
}

function todayPackDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function packExpiresAt(packDate: Date): Date {
  const exp = new Date(packDate);
  exp.setUTCDate(exp.getUTCDate() + 1);
  return exp;
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

function parseAiJsonContent(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return { questions: [] };
    let jsonText = match[0];
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(jsonText);
    } catch {
      logger.warn('[QuizGen] Failed to parse AI JSON after cleanup');
      return { questions: [] };
    }
  }
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

async function attemptOpenRouterCall(language: QuizLanguage, packDate: string): Promise<StoredQuizQuestion[]> {
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
  - entityName: specific name to search for (e.g. "Lionel Messi", "Real Madrid")
  - teamName: string. REQUIRED ONLY if kind is "player" (player's CURRENT club in 2024-2026, e.g. Mbappe -> "Real Madrid", Salah -> "Liverpool"). Do NOT use former clubs.
- imageLayout: "square" or "wide"
- hint: short hint string in ${langLabel} (do not reveal the answer)

CRITICAL — guess_player / player images:
- For type "guess_player" with kind "player", ONLY use currently active or very recently active players whose photos exist in football APIs (2024-2026 squads).
- Good examples: Mohamed Salah, Erling Haaland, Kylian Mbappe, Vinicius Jr, Jude Bellingham, Harry Kane, Robert Lewandowski, Lamine Yamal.
- NEVER use retired legends or historical players for guess_player / image-based player questions: Paolo Maldini, Zinedine Zidane, Ronaldo Nazario, Ronaldinho, Diego Maradona, Pele, David Beckham, Andrea Pirlo, Xavi, Iniesta, Buffon, Totti, etc.
- Retired legends MAY appear ONLY in type "normal" (text-only, no imageBinding).
- Prefer "logo" and "stadium" and "normal" for history/legends trivia.

- Include at least 3 type "guess_player" questions (player photo hidden until user answers — use active stars only).
- Use type "logo" for club badges, "stadium" for venues, "normal" for history/legends text trivia.

Never generate text-input or essay questions. Exactly ${QUIZ_PACK_SIZE} questions.`;

  const user = `Generate today's (${packDate}) daily football quiz in ${langLabel}. Ensure no duplicates, exactly 4 options per question, and correctKey exists.`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.85,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const parsed = parseAiJsonContent(content);

  return parseQuestionsFromAi(parsed, language, packDate);
}

async function generateReplacementQuestions(
  count: number,
  language: QuizLanguage,
  packDate: string,
  existing: StoredQuizQuestion[],
): Promise<StoredQuizQuestion[]> {
  const client = buildClient();
  if (!client) throw new Error('OpenRouter API key not configured');

  const model = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  const langLabel = language === 'ar' ? 'Arabic' : 'English';
  const avoidSample = existing
    .slice(0, 12)
    .map((q) => q.question.slice(0, 100))
    .join(' | ');

  const system = `You are a football trivia writer for 90Plus.
Return ONLY valid JSON: {"questions":[...]} with exactly ${count} NEW multiple-choice questions.
Each question: question, type (normal|image|guess_player|logo|stadium), options (4x A-D), correctKey, difficulty (EASY|MEDIUM|HARD), imageBinding when not normal, imageLayout, hint.
For guess_player: ONLY active 2024-2026 players with real club photos (Salah, Haaland, Mbappe, Vinicius, Bellingham, Kane, etc.).
NEVER use retired legends for guess_player: Maldini, Zidane, Ronaldinho, Maradona, Pele, Beckham, Pirlo, Xavi, Buffon.
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
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const parsed = parseAiJsonContent(content);

  return parseQuestionsFromAi(parsed, language, packDate);
}

async function buildPackWithReplacements(
  language: QuizLanguage,
  packDate: string,
): Promise<StoredQuizQuestion[]> {
  let questions = await attemptOpenRouterCall(language, packDate);
  questions = await enrichAndFilterValid(questions, packDate);

  let fillRound = 0;
  const MAX_FILL_ROUNDS = 4;

  while (questions.length < QUIZ_PACK_SIZE && fillRound < MAX_FILL_ROUNDS) {
    fillRound++;
    const needed = QUIZ_PACK_SIZE - questions.length;
    const buffer = needed + 3;
    logger.info(
      `[QuizGen] Pack has ${questions.length}/${QUIZ_PACK_SIZE} — generating ${buffer} replacement question(s) (round ${fillRound})`,
    );

    const replacements = await generateReplacementQuestions(
      buffer,
      language,
      packDate,
      questions,
    );
    const validReplacements = await enrichAndFilterValid(replacements, packDate);
    questions = mergeUniqueQuestions(questions, validReplacements);
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
  return renumberQuestionIds(questions, language, packDate);
}

async function callOpenRouter(language: QuizLanguage, packDate: string): Promise<StoredQuizQuestion[]> {
  let attempts = 0;
  const MAX_ATTEMPTS = 3; // 1 initial + 2 retries
  let lastError: Error | null = null;

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;
      logger.info(`[QuizGen] Calling AI for ${packDate} (${language}) - Attempt ${attempts}`);
      return await buildPackWithReplacements(language, packDate);
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
): Promise<{ packDate: Date; expiresAt: Date; questions: StoredQuizQuestion[] }> {
  const packDate = packDateInput ?? todayPackDate();
  const dateStr = ymd(packDate);
  logger.info(`[QuizGen] Generating pack ${dateStr} (${language})`);

  const questions = await callOpenRouter(language, dateStr);
  return {
    packDate,
    expiresAt: packExpiresAt(packDate),
    questions,
  };
}

export { todayPackDate, packExpiresAt, ymd as packDateYmd };
