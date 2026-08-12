/**
 * THE CANONICAL QUESTIONS-ROUND CONTRACT
 * =============================================================================
 *
 * ONE definition of "a playable round", shared by every stage of the pipeline:
 *
 *   candidate dataset → AI generation → validation → round construction
 *     → fallback/recycle → persistence → published round → session endpoint
 *
 * Before this module the rules lived in two places that disagreed:
 *
 *  • questions-challenges.ai-generator.service.ts validated a freshly generated
 *    round strictly (4 unique options, real remote images, answers that point at
 *    options that exist).
 *  • questions-challenges.service.ts checked only `content.questions.length > 0`
 *    when it counted a day as generated, when it recycled a previous day, and
 *    when it served a session.
 *
 * A row could therefore be published, counted and served while failing the very
 * rules it was generated under — which is how a `source: 'STATIC_FALLBACK'` row
 * carrying `{hint,title,prompt,options,imageUrl,description,playerFacts}` and NO
 * `questions` array stayed published on today's date and answered every
 * guess-player session request with a 502.
 *
 * Every function here is pure and dependency-free, so the session hot path can
 * validate a row without pulling in the football/AI services.
 *
 * FAILURE REASONS
 * ---------------
 * Validation returns reason codes, never a bare boolean, so a rejection can be
 * logged as what it actually was (`q3:HERO_IMAGE_MISSING`) instead of "round
 * rejected" with nothing to act on.
 */

import { ROUND_QUESTION_COUNT } from '../constants/quiz.constants';
import type {
  QuestionChallengeAnswer,
  QuestionChallengeMode,
  QuestionChallengeOption,
  QuestionChallengeQuestion,
} from '../types/questions-challenges.types';

/** A usable remote image URL, or null. Never invents or substitutes one. */
export function remoteImageUrlOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function isRemoteImage(value: unknown): boolean {
  return remoteImageUrlOrNull(value) !== null;
}

function allUnique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export interface RoundValidation {
  ok: boolean;
  /** Machine-readable reason codes, most specific first. Empty when ok. */
  errors: string[];
  questionCount: number;
}

/** The round's questions as stored on a challenge row (`content.questions`). */
export function challengeQuestions(content: unknown): QuestionChallengeQuestion[] {
  const questions = (content as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(questions)) return [];
  return questions.filter(
    (question): question is QuestionChallengeQuestion => Boolean(question) && typeof question === 'object',
  );
}

/**
 * Canned authored content from retired code paths (`STATIC_FALLBACK`,
 * `FOOTBALL_DATA` — e.g. "Who is this player?" over a stock photo). No live code
 * writes it, but old rows still carry it. It must never be recycled forward,
 * counted as a generated day, or served: OMAR_QUIZ_AI_FOOTBALL_API.md requires
 * every question to be authored over real football entities.
 */
export function isCannedLegacySource(source: unknown): boolean {
  return source === 'STATIC_FALLBACK' || source === 'FOOTBALL_DATA';
}

/* ────────────────────────── option rules ────────────────────────── */

function checkMcqOptions(
  prefix: string,
  options: QuestionChallengeOption[] | undefined,
  correctIds: string[] | undefined,
  expectedCount: number,
  requireImages: boolean,
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(options) || options.length !== expectedCount) {
    return [`${prefix}:OPTION_COUNT_NOT_${expectedCount}`];
  }
  const ids = options.map((option) => option.id);
  if (ids.some((id) => !id)) errors.push(`${prefix}:OPTION_ID_MISSING`);
  else if (!allUnique(ids)) errors.push(`${prefix}:OPTION_ID_DUPLICATE`);

  const labels = options.map((option) => (option.label ?? '').trim().toLowerCase());
  if (labels.some((label) => !label)) errors.push(`${prefix}:OPTION_LABEL_MISSING`);
  else if (!allUnique(labels)) errors.push(`${prefix}:OPTION_LABEL_DUPLICATE`);

  if (requireImages && !options.every((option) => isRemoteImage(option.imageUrl))) {
    errors.push(`${prefix}:OPTION_IMAGE_MISSING`);
  }

  if (!correctIds || correctIds.length === 0) {
    errors.push(`${prefix}:ANSWER_EMPTY`);
  } else if (!correctIds.every((id) => ids.includes(id))) {
    errors.push(`${prefix}:ANSWER_NOT_AN_OPTION`);
  }

  return errors;
}

/* ────────────────────────── per-question rules ────────────────────────── */

/**
 * Shape/answer/image rules for ONE question of a round, independent of how it
 * was produced — AI-generated, recycled, or read back off a published row.
 *
 * Guards the invariants the Questions UI and the grader depend on: every
 * option-bearing mode carries exactly 4 unique options, the recorded answer
 * references options that exist, and every entity the UI draws a picture for has
 * a real remote image URL.
 *
 * Returns the reason codes for the failures; an empty array means valid.
 */
export function validateQuestionContract(
  mode: QuestionChallengeMode,
  question: QuestionChallengeQuestion,
  index = 0,
): string[] {
  const prefix = question?.id || `#${index + 1}`;
  const errors: string[] = [];

  if (!question || typeof question !== 'object') return [`${prefix}:NOT_AN_OBJECT`];
  if (!question.id) errors.push(`${prefix}:ID_MISSING`);
  if (!question.prompt || !String(question.prompt).trim()) errors.push(`${prefix}:PROMPT_MISSING`);

  const answer = question.answer ?? {};

  switch (mode) {
    case 'guess-player':
    case 'guess-club': {
      // The picture IS the question.
      if (!isRemoteImage(question.imageUrl)) errors.push(`${prefix}:HERO_IMAGE_MISSING`);
      if (!question.entity) errors.push(`${prefix}:ENTITY_MISSING`);
      else {
        if (!isRemoteImage(question.entity.imageUrl)) errors.push(`${prefix}:ENTITY_IMAGE_MISSING`);
        else if (question.entity.imageUrl !== question.imageUrl) {
          errors.push(`${prefix}:HERO_IMAGE_NOT_THE_ENTITYS`);
        }
      }
      if (!question.evidence?.length) errors.push(`${prefix}:EVIDENCE_MISSING`);
      errors.push(...checkMcqOptions(prefix, question.options, answer.correctIds, 4, false));
      break;
    }

    case 'player-connections': {
      const players = question.players;
      if (!Array.isArray(players) || players.length !== 4) {
        errors.push(`${prefix}:PORTRAIT_COUNT_NOT_4`);
      } else {
        if (!players.every((player) => player.name?.trim())) errors.push(`${prefix}:PORTRAIT_NAME_MISSING`);
        if (!players.every((player) => isRemoteImage(player.imageUrl))) {
          errors.push(`${prefix}:PORTRAIT_IMAGE_MISSING`);
        } else if (new Set(players.map((player) => player.imageUrl)).size !== 4) {
          errors.push(`${prefix}:PORTRAIT_IMAGE_REUSED`);
        }
      }
      errors.push(...checkMcqOptions(prefix, question.options, answer.correctIds, 4, false));
      break;
    }

    case 'transfer-puzzle': {
      const timeline = question.transferTimeline;
      if (!Array.isArray(timeline) || timeline.length < 2) {
        errors.push(`${prefix}:TIMELINE_TOO_SHORT`);
      } else {
        const visible = timeline.filter((step) => !step.hidden);
        const hidden = timeline.filter((step) => step.hidden);
        if (visible.length === 0) errors.push(`${prefix}:TIMELINE_NO_VISIBLE_STEP`);
        if (hidden.length !== 1) errors.push(`${prefix}:TIMELINE_HIDDEN_STEP_COUNT_NOT_1`);
        if (!visible.every((step) => isRemoteImage(step.imageUrl))) {
          errors.push(`${prefix}:TIMELINE_IMAGE_MISSING`);
        }
      }
      // Every option renders a crest in this mode.
      errors.push(...checkMcqOptions(prefix, question.options, answer.correctIds, 4, true));
      break;
    }

    case 'football-bingo': {
      const board = question.bingoBoard;
      if (!Array.isArray(board) || board.length !== 3 || board.flat().length !== 9) {
        errors.push(`${prefix}:BOARD_NOT_3X3`);
        break;
      }
      const cells = board.flat();
      const ids = cells.map((cell) => cell.id);
      if (ids.some((id) => !id)) errors.push(`${prefix}:CELL_ID_MISSING`);
      else if (!allUnique(ids)) errors.push(`${prefix}:CELL_ID_DUPLICATE`);
      if (!cells.every((cell) => isRemoteImage(cell.imageUrl))) errors.push(`${prefix}:CELL_IMAGE_MISSING`);

      const correctIds = answer.correctIds ?? [];
      if (correctIds.length !== 3) errors.push(`${prefix}:ANSWER_CELL_COUNT_NOT_3`);
      else if (!allUnique(correctIds)) errors.push(`${prefix}:ANSWER_CELL_DUPLICATE`);
      else if (!correctIds.every((id) => ids.includes(id))) errors.push(`${prefix}:ANSWER_NOT_ON_BOARD`);
      break;
    }

    case 'football-grid': {
      if (question.rows?.length !== 3 || question.columns?.length !== 3) {
        errors.push(`${prefix}:GRID_NOT_3X3`);
      }
      const rowImages = question.rowImages;
      if (!Array.isArray(rowImages) || rowImages.length !== 3 || !rowImages.every(isRemoteImage)) {
        errors.push(`${prefix}:ROW_IMAGE_MISSING`);
      }
      const correctId = answer.correctIds?.[0];
      if (!correctId) errors.push(`${prefix}:ANSWER_EMPTY`);
      else if (!/^r[0-2]-c[0-2]$/.test(correctId)) errors.push(`${prefix}:ANSWER_CELL_OUT_OF_RANGE`);
      break;
    }

    case 'top10-challenge': {
      const options = question.options;
      if (!Array.isArray(options) || options.length < 3) {
        errors.push(`${prefix}:RANKED_OPTION_COUNT_BELOW_3`);
        break;
      }
      const ids = options.map((option) => option.id);
      if (ids.some((id) => !id)) errors.push(`${prefix}:OPTION_ID_MISSING`);
      else if (!allUnique(ids)) errors.push(`${prefix}:OPTION_ID_DUPLICATE`);
      if (!options.every((option) => isRemoteImage(option.imageUrl))) {
        errors.push(`${prefix}:OPTION_IMAGE_MISSING`);
      }
      const orderedIds = answer.orderedIds ?? [];
      if (orderedIds.length !== 3) errors.push(`${prefix}:ORDERED_ANSWER_COUNT_NOT_3`);
      else if (!allUnique(orderedIds)) errors.push(`${prefix}:ORDERED_ANSWER_DUPLICATE`);
      else if (!orderedIds.every((id) => ids.includes(id))) errors.push(`${prefix}:ORDERED_ANSWER_NOT_AN_OPTION`);
      break;
    }

    /*
     * Football Quiz rides on the daily AI quiz pack, whose questions are plain
     * A–D multiple choice. Its images come from the pack's own entity binding
     * and are genuinely optional (a question about a competition may have none),
     * so an image is NOT required here — but when one is present it must be a
     * real remote URL, never a local placeholder path.
     */
    case 'football-quiz': {
      if (question.imageUrl !== undefined && !isRemoteImage(question.imageUrl)) {
        errors.push(`${prefix}:HERO_IMAGE_NOT_REMOTE`);
      }
      errors.push(...checkMcqOptions(prefix, question.options, answer.correctIds, 4, false));
      break;
    }

    default:
      errors.push(`${prefix}:UNKNOWN_MODE`);
  }

  return errors;
}

/**
 * The subject a question is ABOUT — the key round-level duplicate detection runs
 * on.
 *
 * This deliberately replaces the old "no two questions may share prompt text"
 * rule, which was rejecting perfectly good rounds: in guess-club and
 * guess-player the crest/portrait IS the question, so the heading ("Which club
 * is this?") is naturally the same on all six while the six subjects differ.
 * Keying on the subject entity is both stricter where it matters — the same
 * club can never be asked twice — and free of that false positive.
 */
export function roundSubjectKey(mode: QuestionChallengeMode, question: QuestionChallengeQuestion): string {
  if (question.entity?.id) return `${mode}:entity:${question.entity.id}`;
  const answer = question.answer ?? {};
  const ids = [...(answer.correctIds ?? []), ...(answer.orderedIds ?? [])];
  if (ids.length) return `${mode}:answer:${[...ids].sort().join('|')}:${question.prompt.trim().toLowerCase()}`;
  return `${mode}:prompt:${question.prompt.trim().toLowerCase()}`;
}

/* ────────────────────────── round rules ────────────────────────── */

/**
 * Whole-round validation — the gate every producer must pass before a round is
 * published, and every consumer may rely on after it was.
 *
 * `expectFullRound` is true everywhere content is created or published: a mode's
 * round is exactly ROUND_QUESTION_COUNT questions, never a partial one that got
 * topped up or trimmed.
 */
export function validateRoundContract(params: {
  mode: QuestionChallengeMode;
  questions: QuestionChallengeQuestion[];
  answer?: QuestionChallengeAnswer | null;
  expectFullRound?: boolean;
}): RoundValidation {
  const { mode, questions } = params;
  const expectFullRound = params.expectFullRound ?? true;
  const errors: string[] = [];

  if (!questions.length) {
    return { ok: false, errors: ['ROUND_HAS_NO_QUESTIONS'], questionCount: 0 };
  }
  if (expectFullRound && questions.length !== ROUND_QUESTION_COUNT) {
    errors.push(`ROUND_QUESTION_COUNT_NOT_${ROUND_QUESTION_COUNT}:got=${questions.length}`);
  }

  const ids = questions.map((question) => question.id);
  if (!allUnique(ids)) errors.push('ROUND_DUPLICATE_QUESTION_ID');

  const subjects = new Set<string>();
  for (const question of questions) {
    const key = roundSubjectKey(mode, question);
    if (subjects.has(key)) errors.push(`ROUND_DUPLICATE_SUBJECT:${key}`);
    subjects.add(key);
  }

  const byQuestionId = params.answer?.byQuestionId ?? {};
  questions.forEach((question, index) => {
    errors.push(...validateQuestionContract(mode, question, index));
    // The grader resolves an answer from the question itself or from the
    // round-level map; a question that has neither cannot be scored.
    if (!question.answer && !byQuestionId[question.id]) {
      errors.push(`${question.id || `#${index + 1}`}:ANSWER_NOT_RECORDED`);
    }
  });

  return { ok: errors.length === 0, errors, questionCount: questions.length };
}

/**
 * Validation of a PERSISTED row exactly as the session endpoint will serve it.
 * Reads the round out of `content`, refuses canned legacy sources, and applies
 * the identical rules an AI-generated round had to pass.
 */
export function validateStoredRound(params: {
  mode: QuestionChallengeMode;
  content: unknown;
  answer?: unknown;
  source?: unknown;
}): RoundValidation {
  if (isCannedLegacySource(params.source)) {
    return { ok: false, errors: [`CANNED_LEGACY_SOURCE:${String(params.source)}`], questionCount: 0 };
  }
  const questions = challengeQuestions(params.content);
  return validateRoundContract({
    mode: params.mode,
    questions,
    answer: (params.answer ?? null) as QuestionChallengeAnswer | null,
  });
}

/** Convenience for call sites that only need the verdict. */
export function isServableRound(params: {
  mode: QuestionChallengeMode;
  content: unknown;
  answer?: unknown;
  source?: unknown;
}): boolean {
  return validateStoredRound(params).ok;
}

/** Errors, trimmed for a log line — the full list can be one per question. */
export function summarizeErrors(errors: string[], limit = 8): string[] {
  return errors.slice(0, limit);
}
