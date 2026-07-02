import {
  isGeminiQuizConfigured,
  resolveGeminiQuizModel,
} from '../services/gemini-text.client';

/** Version tags persisted on generated daily quiz packs. */
export const QUIZ_GENERATOR_VERSION = '2.2.0';
export const QUIZ_PROMPT_VERSION = '1.1.0';
export const QUIZ_DATASET_VERSION = '1.1.0';

export function resolveQuizGeneratorModel(): string {
  if (isGeminiQuizConfigured()) {
    return resolveGeminiQuizModel();
  }
  return process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
}

/** OpenRouter bills against max_tokens; keep below credit headroom (default 12k). */
export function resolveQuizMaxTokens(): number {
  const raw = process.env.GEMINI_QUIZ_MAX_TOKENS ?? process.env.OPENROUTER_QUIZ_MAX_TOKENS;
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2000) return n;
  }
  return 12_000;
}

export interface QuizPackGenerationMeta {
  generatorModel: string;
  generatorVersion: string;
  promptVersion: string;
  datasetVersion: string;
  isFallback: boolean;
}

export function buildPackGenerationMeta(isFallback = false): QuizPackGenerationMeta {
  return {
    generatorModel: resolveQuizGeneratorModel(),
    generatorVersion: QUIZ_GENERATOR_VERSION,
    promptVersion: QUIZ_PROMPT_VERSION,
    datasetVersion: QUIZ_DATASET_VERSION,
    isFallback,
  };
}
