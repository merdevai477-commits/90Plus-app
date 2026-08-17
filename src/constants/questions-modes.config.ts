/**
 * PER-MODE QUESTIONS CONFIGURATION
 * =============================================================================
 *
 * Everything about a Questions mode that is NOT the same for every mode lives
 * here, in one place, so a mode-specific rule can never be expressed by
 * changing a global that six other modes also read.
 *
 * Why this module exists: Football Grid is a 3×3 BOARD — nine cells, not ten
 * questions — and Top 10 is one list of ten typed names, which nobody can fill
 * inside the 30-second per-question timer the multiple-choice modes use.
 * Both needed their own round size / timer, and `ROUND_QUESTION_COUNT` is
 * shared by the generator, the round contract, the session service and the
 * grader: bending it would have resized every other mode's round.
 *
 * Anything without an override keeps exactly the value it has always had.
 */

import {
  QUIZ_QUESTION_TIME_LIMIT_SEC,
  ROUND_QUESTION_COUNT,
} from './quiz.constants';
import type { QuestionChallengeMode } from '../types/questions-challenges.types';

/** Football Grid is one board: 3 award columns × 3 club/national-team rows. */
export const FOOTBALL_GRID_ROWS = 3;
export const FOOTBALL_GRID_COLUMNS = 3;
export const FOOTBALL_GRID_CELL_COUNT = FOOTBALL_GRID_ROWS * FOOTBALL_GRID_COLUMNS;

/** How many players a Football Grid cell offers to choose from. */
export const FOOTBALL_GRID_CELL_OPTIONS = 4;

/** Top 10 is ten ranked slots the player types into. */
export const TOP10_SLOT_COUNT = 10;

/**
 * A round is this many questions. Football Grid's "questions" are its nine
 * cells; Top 10's round is a single ten-slot list.
 */
const ROUND_SIZE: Partial<Record<QuestionChallengeMode, number>> = {
  'football-grid': FOOTBALL_GRID_CELL_COUNT,
  'top10-challenge': 1,
};

export function roundQuestionCount(mode: QuestionChallengeMode): number {
  return ROUND_SIZE[mode] ?? ROUND_QUESTION_COUNT;
}

/**
 * Per-question timer. Typing ten names cannot be done in 30 seconds, so Top 10
 * gets a list-sized budget; every other mode keeps the shared one.
 */
const TIME_LIMIT_SEC: Partial<Record<QuestionChallengeMode, number>> = {
  'top10-challenge': 180,
};

export function questionTimeLimitSec(mode: QuestionChallengeMode): number {
  return TIME_LIMIT_SEC[mode] ?? QUIZ_QUESTION_TIME_LIMIT_SEC;
}

/**
 * TOP 10 GRADING SEMANTICS — a genuine product choice, deliberately named
 * rather than buried in the grader.
 *
 * 'ordered'    — a name only counts in the position it really holds. This is
 *                what the repository already did (evaluateChallengeAnswer
 *                compared `orderedIds` index by index), so it is the default.
 * 'membership' — a name counts wherever it is typed, as long as it belongs in
 *                the ten.
 *
 * Set QUESTIONS_TOP10_MATCHING=membership to switch the whole mode over; the
 * grader reads it through `top10EvaluationStrategy()` on every call.
 */
export type Top10EvaluationStrategy = 'ordered' | 'membership';

export function top10EvaluationStrategy(): Top10EvaluationStrategy {
  return process.env.QUESTIONS_TOP10_MATCHING?.trim().toLowerCase() === 'membership'
    ? 'membership'
    : 'ordered';
}

/**
 * How close a typed name has to be to a real one to count.
 *
 * A ratio, not an edit distance: "Ronaldo" and "Ronaldo Nazário" differ by
 * more characters than "Kane" is long. 0.85 accepts ordinary misspellings and
 * accents ("Modric" → "Modrić", "Mbappe" → "Mbappé") and refuses a different
 * player — see `matchesTop10Name` in questions-challenges.top10.ts, which also
 * requires a minimum length before fuzzy matching is allowed at all.
 */
export const TOP10_FUZZY_MIN_RATIO = 0.85;
