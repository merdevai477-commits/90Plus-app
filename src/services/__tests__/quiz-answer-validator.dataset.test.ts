import {
  createPackValidationContext,
  isTimeSensitiveQuestionText,
  validateQuestionAgainstDataset,
} from '../quiz-answer-validator.service';
import { parseAiQuizResponse } from '../quiz-generator.service';
import type { QuizEntitySlice } from '../../types/quiz-entity.types';
import type { StoredQuizQuestion } from '../../types/quiz.types';

const slice: QuizEntitySlice = {
  players: [
    {
      id: 'player:1',
      name: 'Mohamed Salah',
      apiPlayerId: 1,
      position: 'Attacker',
      jerseyNumber: 11,
      teamId: 40,
      teamName: 'Liverpool',
      nationality: 'Egypt',
      country: 'England',
      age: 32,
    },
    {
      id: 'player:2',
      name: 'Darwin Nunez',
      apiPlayerId: 2,
      position: 'Attacker',
      jerseyNumber: 9,
      teamId: 40,
      teamName: 'Liverpool',
      nationality: 'Uruguay',
      country: 'England',
    },
    {
      id: 'player:3',
      name: 'Luis Diaz',
      apiPlayerId: 3,
      position: 'Attacker',
      jerseyNumber: 7,
      teamId: 40,
      teamName: 'Liverpool',
      nationality: 'Colombia',
      country: 'England',
    },
    {
      id: 'player:4',
      name: 'Cody Gakpo',
      apiPlayerId: 4,
      position: 'Attacker',
      jerseyNumber: 18,
      teamId: 40,
      teamName: 'Liverpool',
      nationality: 'Netherlands',
      country: 'England',
    },
  ],
  clubs: [
    { id: 'team:40', name: 'Liverpool', apiTeamId: 40, logoUrl: 'https://logo/liverpool.png' },
    { id: 'team:50', name: 'Manchester City', apiTeamId: 50, logoUrl: 'https://logo/city.png' },
    { id: 'team:33', name: 'Manchester United', apiTeamId: 33, logoUrl: 'https://logo/united.png' },
    { id: 'team:42', name: 'Arsenal', apiTeamId: 42, logoUrl: 'https://logo/arsenal.png' },
  ],
  stadiums: [
    {
      id: 'venue:40',
      name: 'Anfield',
      teamName: 'Liverpool',
      apiTeamId: 40,
      imageUrl: 'https://venue/anfield.png',
    },
  ],
};

function baseQuestion(overrides: Partial<StoredQuizQuestion> = {}): StoredQuizQuestion {
  return {
    id: 'daily-2026-06-10-en-1',
    question:
      'Egyptian attacker wearing number 11 for Liverpool — who is he?',
    type: 'guess_player',
    options: [
      { key: 'A', text: 'Mohamed Salah' },
      { key: 'B', text: 'Darwin Nunez' },
      { key: 'C', text: 'Luis Diaz' },
      { key: 'D', text: 'Cody Gakpo' },
    ],
    correctKey: 'A',
    difficulty: 'EASY',
    imageBinding: {
      entityId: 'player:1',
      kind: 'player',
      entityName: 'Mohamed Salah',
      teamName: 'Liverpool',
    },
    ...overrides,
  };
}

describe('quiz-answer-validator dataset rules', () => {
  test('rejects confidence below 90', () => {
    const ctx = createPackValidationContext();
    const result = validateQuestionAgainstDataset(baseQuestion(), slice, ctx, 89);
    expect(result).toBeNull();
  });

  test('accepts confidence 90 and dataset-backed question', () => {
    const ctx = createPackValidationContext();
    const result = validateQuestionAgainstDataset(baseQuestion(), slice, ctx, 95);
    expect(result).not.toBeNull();
    expect(result?.imageBinding?.apiId).toBe(1);
  });

  test('rejects distractor outside dataset', () => {
    const ctx = createPackValidationContext();
    const q = baseQuestion({
      options: [
        { key: 'A', text: 'Mohamed Salah' },
        { key: 'B', text: 'Darwin Nunez' },
        { key: 'C', text: 'Luis Diaz' },
        { key: 'D', text: 'Unknown Player' },
      ],
    });
    expect(validateQuestionAgainstDataset(q, slice, ctx, 95)).toBeNull();
  });

  test('rejects duplicate correct-answer entity in pack', () => {
    const ctx = createPackValidationContext();
    const first = validateQuestionAgainstDataset(baseQuestion(), slice, ctx, 95);
    expect(first).not.toBeNull();

    const second = validateQuestionAgainstDataset(
      baseQuestion({ id: 'daily-2026-06-10-en-2' }),
      slice,
      ctx,
      95,
    );
    expect(second).toBeNull();
  });

  test('flags time-sensitive standings question', () => {
    expect(isTimeSensitiveQuestionText('Who is current top scorer in the league?', false)).toBe(true);
    expect(isTimeSensitiveQuestionText('Which club was founded in 1892?', false)).toBe(false);
  });
});

describe('parseAiQuizResponse', () => {
  test('returns INSUFFICIENT_DATA without salvaging partial questions', () => {
    const raw = JSON.stringify({
      questions: [{ question: 'partial' }],
      status: 'INSUFFICIENT_DATA',
    });
    const parsed = parseAiQuizResponse(raw);
    expect(parsed.status).toBe('INSUFFICIENT_DATA');
    expect(parsed.questions).toEqual([]);
  });

  test('parses valid question array', () => {
    const raw = JSON.stringify({
      questions: [{ question: 'Test?', confidence: 95 }],
      status: 'OK',
    });
    const parsed = parseAiQuizResponse(raw);
    expect(parsed.questions).toHaveLength(1);
  });
});
