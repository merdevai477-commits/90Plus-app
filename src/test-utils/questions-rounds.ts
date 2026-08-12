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

import { ROUND_QUESTION_COUNT } from '../constants/quiz.constants';
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

    case 'football-grid':
      return {
        ...base,
        entity: { kind: 'player', id: `player:${index}`, name: `Player ${index}` },
        rows: ['Club A', 'Club B', 'Club C'],
        columns: ['England', 'Spain', 'Italy'],
        rowImages: [CREST(index), CREST(index + 50), CREST(index + 100)],
        columnImages: [undefined, undefined, undefined],
        validationRules: [base.prompt],
        answer: { correctIds: ['r1-c2'] },
      };

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

    case 'top10-challenge': {
      const options = Array.from({ length: 5 }, (_, slot) => ({
        id: String(slot + 1),
        label: `Scorer ${index}-${slot}`,
        imageUrl: PORTRAIT(index * 20 + slot),
      }));
      return {
        ...base,
        entity: { kind: 'league', id: `league:${index}`, name: `League ${index}` },
        options,
        orderedAnswers: options.slice(0, 3),
        acceptedAnswers: ['1', '2', '3'],
        scoring: { exact: 10, partial: 5 },
        answer: { orderedIds: ['1', '2', '3'] },
      };
    }

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

/** A full contract-valid round: `content` + the round-level `answer` map. */
export function validRound(
  mode: QuestionChallengeMode,
  count = ROUND_QUESTION_COUNT,
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
