/** Version tags persisted on generated daily quiz packs. */
export const QUIZ_GENERATOR_VERSION = '2.1.0';
export const QUIZ_PROMPT_VERSION = '1.1.0';
export const QUIZ_DATASET_VERSION = '1.0.0';

export function resolveQuizGeneratorModel(): string {
  return process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
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
