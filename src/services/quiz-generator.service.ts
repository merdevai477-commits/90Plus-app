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
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as Record<string, unknown>;
    const question = String(item.question ?? '').trim();
    if (!question) continue;

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
    while (options.length < 4) {
      options.push({ key: OPTION_KEYS[options.length], text: `Option ${options.length + 1}` });
    }

    let correctKey = String(item.correctKey ?? item.correct ?? 'A').toUpperCase() as QuizOptionKey;
    if (!OPTION_KEYS.includes(correctKey)) correctKey = 'A';

    const difficulty = normalizeDifficulty(String(item.difficulty ?? 'EASY'));
    const imageLayout =
      item.imageLayout === 'wide' ? 'wide' : ('square' as const);

    out.push({
      id: `daily-${packDate}-${language}-${i + 1}`,
      question,
      options: options.slice(0, 4),
      correctKey,
      difficulty,
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
      imageLayout,
      imageType: typeof item.imageType === 'string' ? item.imageType : null,
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

async function callOpenRouter(language: QuizLanguage, packDate: string): Promise<StoredQuizQuestion[]> {
  const client = buildClient();
  if (!client) {
    throw new Error('OpenRouter API key not configured');
  }

  const model =
    process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  const langLabel = language === 'ar' ? 'Arabic' : 'English';

  const system = `You are a world football trivia writer for the 90Plus app.
Return ONLY valid JSON (no markdown): {"questions":[...]} with exactly 20 multiple-choice questions.
Distribution: 10 EASY, 5 MEDIUM, 5 HARD.
Topics: global football — leagues, World Cup, UEFA, players, clubs, stadiums, records, history.
Each question object:
- question (string, ${langLabel})
- options: array of 4 objects {key:"A"|"B"|"C"|"D", text:string}
- correctKey: "A"|"B"|"C"|"D"
- difficulty: "EASY"|"MEDIUM"|"HARD"
- imageType: optional "player"|"team"|"league"|"flag"|"venue" when a photo helps
- imageLayout: "square" or "wide" (wide for stadiums)
- hint: short hint string in ${langLabel} (do not reveal the answer)
All four options must be plausible; exactly one correct.`;

  const user = `Generate today's (${packDate}) daily football quiz in ${langLabel}. Make questions diverse and engaging.`;

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

  let questions = parseQuestionsFromAi(parsed, language, packDate);
  if (questions.length < 20) {
    throw new Error(`AI returned ${questions.length} questions, expected 20`);
  }
  questions = questions.slice(0, 20);
  if (!validateDistribution(questions)) {
    questions = rebalanceDifficulties(questions);
  }
  return enrichQuizImages(questions, packDate);
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
