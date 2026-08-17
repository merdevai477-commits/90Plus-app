/**
 * CONTRACT-VALID ROUND FIXTURES
 *
 * Builds, for any mode, a round that satisfies questions-challenges.round-contract.ts
 * — the same contract the AI generator, the publish gate and the session
 * endpoint all validate against.
 *
 * Tests use these wherever they need "a round the pipeline would accept", so a
 * fixture can never quietly drift into a shape production would refuse.
 */

import {
  FOOTBALL_GRID_COLUMNS,
  FOOTBALL_GRID_ROWS,
  roundQuestionCount,
  TOP10_SLOT_COUNT,
} from '../constants/questions-modes.config';
import type {
  QuestionChallengeAnswer,
  QuestionChallengeMode,
  QuestionChallengeQuestion,
} from '../types/questions-challenges.types';

const DIFFICULTY_XP = { EASY: 10, MEDIUM: 15, HARD: 20 } as const;

const PORTRAIT = (n: number) => `https://imagecache.365scores.com/player-${n}.png`;
const CREST = (n: number) => `https://media.api-sports.io/football/teams/${n}.png`;

function mcqOptions(index: number, withImages: boolean) {
  return ['a', 'b', 'c', 'd'].map((id, slot) => ({
    id,
    label: `Entity ${index}-${slot}`,
    ...(withImages ? { imageUrl: CREST(index * 10 + slot) } : {}),
  }));
}

/** One contract-valid question of `mode`, distinct from every other index. */
export function validQuestion(mode: QuestionChallengeMode, index: number): QuestionChallengeQuestion {
  const difficulty = (['EASY', 'MEDIUM', 'HARD'] as const)[index % 3]!;
  const base = {
    id: `q${index + 1}`,
    difficulty,
    xpReward: DIFFICULTY_XP[difficulty],
    prompt: `${mode} question ${index + 1}`,
    hint: `hint ${index + 1}`,
  };

  switch (mode) {
    case 'guess-player':
    case 'guess-club': {
      const image = mode === 'guess-player' ? PORTRAIT(index) : CREST(index);
      return {
        ...base,
        imageUrl: image,
        entity: {
          kind: mode === 'guess-player' ? 'player' : 'team',
          id: `${mode === 'guess-player' ? 'player' : 'team'}:${index}`,
          name: `Entity ${index}-0`,
          imageUrl: image,
        },
        evidence: [{ id: 'e1', text: 'Country: England', label: 'Country', value: 'England' }],
        options: mcqOptions(index, false),
        answer: { correctIds: ['a'] },
      };
    }

    case 'football-bingo': {
      const board = Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 3 }, (_, col) => ({
          id: `r${row}-c${col}`,
          label: `Club ${index}-${row}${col}`,
          imageUrl: CREST(index * 100 + row * 3 + col),
          kind: 'club' as const,
        })),
      );
      return {
        ...base,
        entity: { kind: 'team', id: `bingo:${index}`, name: `Card ${index}` },
        bingoBoard: board,
        objectives: [`Pick the three clubs (${index})`],
        answer: { correctIds: ['r0-c0', 'r1-c1', 'r2-c2'] },
      };
    }

    /*
     * One CELL of the shared 3×3 board: awards across, clubs/national teams
     * down, four real players to place. `index` walks the nine cells in the
     * same order the generator emits them.
     */
    case 'football-grid': {
      const row = Math.floor(index / FOOTBALL_GRID_COLUMNS) % FOOTBALL_GRID_ROWS;
      const column = index % FOOTBALL_GRID_COLUMNS;
      return {
        ...base,
        prompt: `Pick a player who played for Club ${row} and won Award ${column}`,
        rows: ['Club 0', 'Club 1', 'Club 2'],
        columns: ['Award 0', 'Award 1', 'Award 2'],
        rowImages: [CREST(1), CREST(2), CREST(3)],
        gridCell: { row, column },
        validationRules: [`Club ${row} × Award ${column}`],
        options: ['a', 'b', 'c', 'd'].map((id, slot) => ({
          id,
          label: `Grid Player ${index}-${slot}`,
          imageUrl: PORTRAIT(index * 10 + slot),
        })),
        answer: { correctIds: ['a'] },
      };
    }

    case 'player-connections':
      return {
        ...base,
        entity: { kind: 'team', id: `team:${index}`, name: `Club ${index}` },
        players: Array.from({ length: 4 }, (_, slot) => ({
          id: `p${slot + 1}`,
          name: `Player ${index}-${slot}`,
          imageUrl: PORTRAIT(index * 10 + slot),
        })),
        options: mcqOptions(index, false),
        relationships: [`Entity ${index}-0`],
        answer: { correctIds: ['a'] },
      };

    case 'transfer-puzzle':
      return {
        ...base,
        entity: { kind: 'player', id: `player:${index}`, name: `Player ${index}` },
        transferTimeline: [
          { id: 't1', label: `Club ${index}-prior`, year: '2019', imageUrl: CREST(index + 200) },
          { id: 't2', label: '?', hidden: true },
        ],
        clubs: [`Club ${index}-prior`],
        years: ['2019'],
        hiddenSteps: ['t2'],
        options: mcqOptions(index, true),
        answer: { correctIds: ['a'] },
      };

    /* Ten typed slots. The names live in the answer and never reach a client. */
    case 'top10-challenge':
      return {
        ...base,
        entity: { kind: 'league', id: `league:${index}`, name: `League ${index}` },
        top10: {
          slots: TOP10_SLOT_COUNT,
          categoryLabel: `League ${index}`,
          seasonLabel: String(2010 + index),
        },
        answer: {
          orderedAnswers: Array.from({ length: TOP10_SLOT_COUNT }, (_, slot) => ({
            rank: slot + 1,
            canonical: `Scorer ${index}-${slot}`,
            aliases: [`Scorer ${index}-${slot}`],
            imageUrl: PORTRAIT(index * 20 + slot),
            value: 30 - slot,
          })),
        },
      };

    case 'football-quiz':
      return {
        ...base,
        entity: { kind: 'player', id: `player:${index}`, name: `Player ${index}` },
        options: mcqOptions(index, false),
        answer: { correctIds: ['a'] },
      };

    default:
      throw new Error(`no fixture for mode ${mode}`);
  }
}

/**
 * A full contract-valid round: `content` + the round-level `answer` map.
 *
 * The round's LENGTH is the mode's own — nine cells for Football Grid, one list
 * for Top 10, ROUND_QUESTION_COUNT everywhere else — so a fixture can never be
 * a shape the publish gate would refuse.
 */
export function validRound(
  mode: QuestionChallengeMode,
  count = roundQuestionCount(mode),
): { content: Record<string, unknown>; answer: QuestionChallengeAnswer; questions: QuestionChallengeQuestion[] } {
  const questions = Array.from({ length: count }, (_, index) => validQuestion(mode, index));
  const byQuestionId: NonNullable<QuestionChallengeAnswer['byQuestionId']> = {};
  for (const question of questions) byQuestionId[question.id] = question.answer;
  const first = questions[0]!;

  return {
    questions,
    content: {
      title: `${mode} title`,
      description: `${mode} description`,
      questions,
      prompt: first.prompt,
      imageUrl: first.imageUrl,
      hint: first.hint,
      options: first.options,
    },
    answer: { ...first.answer, byQuestionId },
  };
}
