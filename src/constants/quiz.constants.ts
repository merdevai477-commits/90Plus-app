/** Shared daily quiz pack sizing (backend + generator). */
export const QUIZ_PACK_SIZE = 15;
export const QUIZ_DIFFICULTY_COUNTS = {
  EASY: 5,
  MEDIUM: 5,
  HARD: 5,
} as const;

/** Minimum AI confidence (0–100) to accept a generated question. */
export const QUIZ_MIN_CONFIDENCE = 90;

/**
 * Questions-hub round length: how many real questions one mode serves per day.
 * The AI is asked for exactly this many per mode and a short round is rejected
 * rather than padded — see questions-challenges.ai-generator.service.ts.
 */
export const ROUND_QUESTION_COUNT = 6;

/** Minimum entity pool sizes before calling the AI. */
export const QUIZ_DATASET_MIN_PLAYERS = 12;
export const QUIZ_DATASET_MIN_CLUBS = 8;
export const QUIZ_DATASET_MIN_STADIUMS = 4;

/** Daily slice sizes passed to the AI per generation attempt. */
export const QUIZ_SLICE_PLAYER_COUNT = 28;
export const QUIZ_SLICE_CLUB_COUNT = 14;
export const QUIZ_SLICE_STADIUM_COUNT = 10;
