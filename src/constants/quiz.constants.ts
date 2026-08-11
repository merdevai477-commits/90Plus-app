/** Shared daily quiz pack sizing (backend + generator). */
export const QUIZ_PACK_SIZE = 15;
export const QUIZ_DIFFICULTY_COUNTS = {
  EASY: 5,
  MEDIUM: 5,
  HARD: 5,
} as const;

/** Minimum AI confidence (0–100) to accept a generated question. */
export const QUIZ_MIN_CONFIDENCE = 90;

/** Minimum entity pool sizes before calling the AI. */
export const QUIZ_DATASET_MIN_PLAYERS = 12;
export const QUIZ_DATASET_MIN_CLUBS = 8;
export const QUIZ_DATASET_MIN_STADIUMS = 4;

/** Daily slice sizes passed to the AI per generation attempt. */
export const QUIZ_SLICE_PLAYER_COUNT = 28;
export const QUIZ_SLICE_CLUB_COUNT = 14;
export const QUIZ_SLICE_STADIUM_COUNT = 10;
/** Questions per Questions-mode round — shared across generator, contract, session. */
export const ROUND_QUESTION_COUNT = 10;
/** Alias used in session/game-flow docs and APIs. */
export const QUIZ_QUESTION_COUNT = ROUND_QUESTION_COUNT;
/** Server-authoritative per-question timer (seconds). */
export const QUIZ_QUESTION_TIME_LIMIT_SEC = 30;