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

const DIFFICULTY_COUNTS: Record<QuizDifficulty, number> = {
  EASY: 10,
  MEDIUM: 5,
  HARD: 5,
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
    const type = normalizeType(String(item.type ?? 'normal'));
    
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
      // Explicitly nullify imageUrl to enforce backend resolution
      imageUrl = null;
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
  return sorted.slice(0, 20).map((q, i) => ({
    ...q,
    id: q.id.replace(/-\d+$/, `-${i + 1}`),
    difficulty: targets[i] ?? 'EASY',
  }));
}

async function attemptOpenRouterCall(language: QuizLanguage, packDate: string): Promise<StoredQuizQuestion[]> {
  const client = buildClient();
  if (!client) throw new Error('OpenRouter API key not configured');

  const model = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  const langLabel = language === 'ar' ? 'Arabic' : 'English';

  const system = `You are a world football trivia writer for the 90Plus app.
Return ONLY valid JSON (no markdown): {"questions":[...]} with exactly 20 multiple-choice questions (MCQ).
Distribution MUST BE EXACTLY: 10 EASY, 5 MEDIUM, 5 HARD.
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
  - teamName: string. REQUIRED ONLY if kind is "player" (the player's current or main team, e.g. "Inter Miami").
- imageLayout: "square" or "wide"
- hint: short hint string in ${langLabel} (do not reveal the answer)
Never generate text-input or essay questions. Exactly 20 questions.`;

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : { questions: [] };
  }

  return parseQuestionsFromAi(parsed, language, packDate);
}

async function callOpenRouter(language: QuizLanguage, packDate: string): Promise<StoredQuizQuestion[]> {
  let attempts = 0;
  const MAX_ATTEMPTS = 3; // 1 initial + 2 retries
  let lastError: Error | null = null;

  while (attempts < MAX_ATTEMPTS) {
    try {
      attempts++;
      logger.info(`[QuizGen] Calling AI for ${packDate} (${language}) - Attempt ${attempts}`);
      let questions = await attemptOpenRouterCall(language, packDate);
      
      // Attempt image resolution. If resolution fails, enrichQuizImages will return null for that question or safely degrade it.
      const enriched = await enrichQuizImages(questions, packDate);
      
      // Filter out discarded questions
      questions = enriched.filter((q): q is StoredQuizQuestion => q !== null);
      
      if (questions.length < 20) {
        throw new Error(`AI returned ${questions.length} valid unique questions after image resolution, expected exactly 20.`);
      }

      questions = questions.slice(0, 20);
      
      if (!validateDistribution(questions)) {
        questions = rebalanceDifficulties(questions);
      }
      
      return questions;
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
