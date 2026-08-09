/**
 * PER-QUESTION GRADING, XP AND "ASK THE CROWD"
 *
 * A round is several questions on one challenge row, so grading has to know
 * WHICH question an answer is for, pay out that question's own XP, and only
 * call the round complete when all of it has been answered. "Ask the crowd"
 * then reads those same stored submissions back — it is the only source of the
 * percentages, and it reports itself unavailable rather than inventing one.
 */

import { ROUND_QUESTION_COUNT } from '../../constants/quiz.constants';
import type { QuestionChallengeQuestion } from '../../types/questions-challenges.types';

/* ── in-memory database ── */

interface ChallengeRow {
  id: string;
  type: string;
  language: string;
  refreshDate: Date;
  status: string;
  xpReward: number;
  streakContribution: boolean;
  content: any;
  answer: any;
}

interface ProgressRow {
  userId: string;
  challengeId: string;
  completed: boolean;
  score: number;
  elapsedTime: number;
  xpEarned: number;
  attempts: number;
  completionPercentage: number;
  unlocked: boolean;
  hintUsed: boolean;
  answeredPayload: any;
  completedAt: Date | null;
}

const db = {
  challenges: [] as ChallengeRow[],
  progress: [] as ProgressRow[],
  streak: { current: 0, longest: 0 },
};

function matches(row: any, where: any): boolean {
  for (const [key, value] of Object.entries(where ?? {})) {
    if (value === undefined) continue;
    if (key === 'userId' && value && typeof value === 'object' && 'not' in (value as any)) {
      if (row.userId === (value as any).not) return false;
      continue;
    }
    if (value instanceof Date) {
      if (!(row[key] instanceof Date) || row[key].getTime() !== value.getTime()) return false;
      continue;
    }
    if (value && typeof value === 'object' && 'gt' in (value as any)) {
      if (!((row[key] ?? 0) > (value as any).gt)) return false;
      continue;
    }
    if (row[key] !== value) return false;
  }
  return true;
}

const prismaMock: any = {
  $transaction: async (fn: any) => fn(prismaMock),
  dailyQuestionChallenge: {
    count: async ({ where }: any) => db.challenges.filter((row) => matches(row, where)).length,
    findFirst: async ({ where }: any) => db.challenges.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where }: any) => db.challenges.filter((row) => matches(row, where)),
    upsert: async () => undefined,
  },
  userQuestionChallenge: {
    findUnique: async ({ where }: any) => {
      const key = where.userId_challengeId;
      const row = db.progress.find(
        (entry) => entry.userId === key.userId && entry.challengeId === key.challengeId,
      );
      // A snapshot, like Prisma returns — a later upsert in the same
      // transaction must not retroactively change what the read saw.
      return row ? { ...row, answeredPayload: JSON.parse(JSON.stringify(row.answeredPayload ?? {})) } : null;
    },
    findMany: async ({ where }: any) => db.progress.filter((row) => matches(row, where)),
    count: async ({ where }: any) => db.progress.filter((row) => matches(row, where)).length,
    aggregate: async ({ where }: any) => ({
      _sum: {
        xpEarned: db.progress
          .filter((row) => matches(row, where))
          .reduce((total, row) => total + row.xpEarned, 0),
      },
    }),
    upsert: async ({ where, create, update }: any) => {
      const key = where.userId_challengeId;
      const existing = db.progress.find(
        (row) => row.userId === key.userId && row.challengeId === key.challengeId,
      );
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      const row = { ...create } as ProgressRow;
      db.progress.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const key = where.userId_challengeId;
      const row = db.progress.find(
        (entry) => entry.userId === key.userId && entry.challengeId === key.challengeId,
      )!;
      for (const [field, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && 'increment' in (value as any)) {
          (row as any)[field] = ((row as any)[field] ?? 0) + (value as any).increment;
        } else {
          (row as any)[field] = value;
        }
      }
      return row;
    },
  },
  loginStreak: { findUnique: async () => db.streak },
  user: { findMany: async () => [] },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

jest.mock('../../utils/ensureBackendUser', () => ({
  ensureBackendUser: async (clerkUserId: string) => ({ id: `user-${clerkUserId}` }),
}));

const awardedKeys: string[] = [];
const mockAwardXp = jest.fn(async ({ amount, idempotencyKey }: any) => {
  if (awardedKeys.includes(idempotencyKey)) return { awarded: 0 };
  awardedKeys.push(idempotencyKey);
  return { awarded: amount };
});
jest.mock('../xp.service', () => ({ awardXp: (...args: unknown[]) => (mockAwardXp as any)(...args) }));

jest.mock('../redis-cache.service', () => ({
  redisCacheService: {
    get: async () => null,
    set: async () => undefined,
    del: async () => undefined,
  },
}));

jest.mock('../quiz-daily.service', () => ({ getOrCreateDailyPack: async () => [] }));

const mockBuildAiQuestionChallenges = jest.fn(async () => null);
jest.mock('../questions-challenges.ai-generator.service', () => ({
  buildAiQuestionChallenges: (...args: unknown[]) => (mockBuildAiQuestionChallenges as any)(...args),
}));

import {
  getQuestionCrowdStats,
  getQuestionsModesForUser,
  submitQuestionsChallengeAnswer,
} from '../questions-challenges.service';
import { todayPackDate } from '../quiz-generator.service';

/* ── fixtures ── */

const CHALLENGE_ID = 'challenge-guess-player';
const DIFFICULTY_XP = { EASY: 10, MEDIUM: 15, HARD: 20 } as const;

function question(index: number): QuestionChallengeQuestion {
  const difficulty = (['EASY', 'MEDIUM', 'HARD'] as const)[index % 3]!;
  return {
    id: `q${index + 1}`,
    difficulty,
    xpReward: DIFFICULTY_XP[difficulty],
    prompt: `Who is player ${index + 1}?`,
    imageUrl: `https://imagecache.365scores.com/p${index}.png`,
    hint: `hint ${index + 1}`,
    entity: {
      kind: 'player',
      id: `player:${index}`,
      name: `Player ${index}`,
      imageUrl: `https://imagecache.365scores.com/p${index}.png`,
    },
    evidence: [{ id: 'e1', text: 'Country: England', label: 'Country', value: 'England' }],
    options: [
      { id: 'a', label: `Player ${index}` },
      { id: 'b', label: `Player ${index + 100}` },
      { id: 'c', label: `Player ${index + 200}` },
      { id: 'd', label: `Player ${index + 300}` },
    ],
    // 'a' is correct on every question here, purely to keep the tests readable.
    answer: { correctIds: ['a'] },
  };
}

function seedDatabase() {
  db.challenges = [];
  db.progress = [];
  db.streak = { current: 0, longest: 0 };
  awardedKeys.length = 0;

  const refreshDate = todayPackDate('UTC');
  const questions = Array.from({ length: ROUND_QUESTION_COUNT }, (_, i) => question(i));
  const byQuestionId: Record<string, unknown> = {};
  for (const entry of questions) byQuestionId[entry.id] = entry.answer;

  // Eight published rows so ensureDailyChallenges short-circuits instead of
  // trying to generate.
  const modes = [
    'GUESS_PLAYER',
    'GUESS_CLUB',
    'FOOTBALL_BINGO',
    'FOOTBALL_GRID',
    'PLAYER_CONNECTIONS',
    'TRANSFER_PUZZLE',
    'TOP10_CHALLENGE',
    'FOOTBALL_QUIZ',
  ];
  db.challenges = modes.map((type, index) => ({
    id: type === 'GUESS_PLAYER' ? CHALLENGE_ID : `challenge-${index}`,
    type,
    language: 'en',
    refreshDate,
    status: 'PUBLISHED',
    xpReward: questions.reduce((total, entry) => total + entry.xpReward, 0),
    streakContribution: true,
    content: { title: 't', description: 'd', prompt: questions[0]!.prompt, questions },
    answer: { ...questions[0]!.answer, byQuestionId },
  }));
}

async function answer(questionId: string, selectedIds: string[], user = 'u1') {
  return submitQuestionsChallengeAnswer(
    user,
    'guess-player',
    { challengeId: CHALLENGE_ID, questionId, selectedIds, elapsedTime: 5, language: 'en' },
    'UTC',
  );
}

describe('per-question grading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedDatabase();
  });

  test('grades the question the client names, not always the first one', async () => {
    const right = await answer('q4', ['a']);
    expect(right.questionId).toBe('q4');
    expect(right.isCorrect).toBe(true);

    const wrong = await answer('q5', ['b']);
    expect(wrong.questionId).toBe('q5');
    expect(wrong.isCorrect).toBe(false);
  });

  test('rejects a question id that is not in this round', async () => {
    await expect(answer('q99', ['a'])).rejects.toThrow('QUESTIONS_CHALLENGE_QUESTION_NOT_FOUND');
  });

  test('falls back to the first question for a client that sends no questionId', async () => {
    const result = await submitQuestionsChallengeAnswer(
      'u1',
      'guess-player',
      { challengeId: CHALLENGE_ID, selectedIds: ['a'], elapsedTime: 1, language: 'en' },
      'UTC',
    );
    expect(result.questionId).toBe('q1');
    expect(result.isCorrect).toBe(true);
  });

  test('score counts correct questions, not submissions', async () => {
    await answer('q1', ['a']);
    await answer('q2', ['b']);
    const third = await answer('q3', ['a']);

    expect(third.score).toBe(2);
  });

  test('progress tracks how much of the round has been answered', async () => {
    const first = await answer('q1', ['a']);
    expect(first.completed).toBe(false);
    expect(first.completionPercentage).toBe(Math.round((1 / ROUND_QUESTION_COUNT) * 100));

    for (let i = 2; i <= ROUND_QUESTION_COUNT; i += 1) {
      await answer(`q${i}`, ['a']);
    }
    const progress = db.progress[0]!;
    expect(progress.completed).toBe(true);
    expect(progress.completionPercentage).toBe(100);
    expect(progress.score).toBe(ROUND_QUESTION_COUNT);
  });

  test('the round is not complete just because one question was right', async () => {
    const result = await answer('q1', ['a']);
    expect(result.completed).toBe(false);
  });

  test('re-answering a question never downgrades a correct answer', async () => {
    await answer('q1', ['a']);
    await answer('q1', ['b']);

    expect(db.progress[0]!.score).toBe(1);
  });
});

describe('XP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedDatabase();
  });

  test("pays the question's own difficulty value, not a flat number", async () => {
    // q1 is EASY (10), q2 MEDIUM (15), q3 HARD (20).
    await answer('q1', ['a']);
    expect(mockAwardXp.mock.calls[0]![0].amount).toBe(10);

    await answer('q2', ['a']);
    expect(mockAwardXp.mock.calls[1]![0].amount).toBe(15);

    await answer('q3', ['a']);
    expect(mockAwardXp.mock.calls[2]![0].amount).toBe(20);
  });

  test('pays nothing for a wrong answer', async () => {
    const result = await answer('q1', ['b']);
    expect(result.totalXpAwarded).toBe(0);
    expect(mockAwardXp).not.toHaveBeenCalled();
  });

  test('does not pay twice for the same question', async () => {
    const first = await answer('q1', ['a']);
    const second = await answer('q1', ['a']);

    expect(first.totalXpAwarded).toBeGreaterThan(0);
    expect(second.totalXpAwarded).toBe(0);
  });

  test('keys idempotency per question, so two questions do not collide', async () => {
    await answer('q1', ['a']);
    await answer('q2', ['a']);

    const keys = mockAwardXp.mock.calls.map((call) => call[0].idempotencyKey);
    expect(keys[0]).toContain('.q1.');
    expect(keys[1]).toContain('.q2.');
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('adds a completion bonus once, when the last question lands', async () => {
    for (let i = 1; i < ROUND_QUESTION_COUNT; i += 1) {
      const partial = await answer(`q${i}`, ['a']);
      expect(partial.bonusXp).toBe(0);
    }
    const last = await answer(`q${ROUND_QUESTION_COUNT}`, ['a']);
    expect(last.bonusXp).toBe(10);

    // Answering again does not re-award it.
    const again = await answer('q1', ['b']);
    expect(again.bonusXp).toBe(0);
  });

  test('applies the streak multiplier to the question value', async () => {
    db.streak = { current: 4, longest: 9 };
    const result = await answer('q3', ['a']); // HARD → 20
    expect(result.streakBonus).toBe(Math.round(20 * 4 * 0.05));
  });
});

describe('the hub footer counters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedDatabase();
  });

  test('come from the user’s own rows and today’s real rewards, not a table', async () => {
    await answer('q1', ['a']);

    const modes = await getQuestionsModesForUser('u1', 'en', 'UTC');

    // One challenge attempted…
    expect(modes.summary.answeredCount).toBe(1);
    // …XP earned is what the grader actually awarded on this row…
    expect(modes.summary.xpEarnedTotal).toBe(db.progress[0]!.xpEarned);
    expect(modes.summary.xpEarnedTotal).toBeGreaterThan(0);
    // …and today's pool is the sum of the published rounds' rewards.
    expect(modes.summary.xpAvailableToday).toBe(
      db.challenges.reduce((total, row) => total + row.xpReward, 0),
    );
  });

  test('report zero rather than a plausible number for a user who has not played', async () => {
    const modes = await getQuestionsModesForUser('fresh-user', 'en', 'UTC');
    expect(modes.summary.answeredCount).toBe(0);
    expect(modes.summary.xpEarnedTotal).toBe(0);
  });
});

describe('ask the crowd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedDatabase();
  });

  async function seedOtherAnswers(picks: string[]) {
    for (let i = 0; i < picks.length; i += 1) {
      await answer('q1', [picks[i]!], `other-${i}`);
    }
  }

  test('reports the real split of what other players picked', async () => {
    // 5 players: 3 picked b, 2 picked c. Nobody picked the correct answer.
    await seedOtherAnswers(['b', 'b', 'b', 'c', 'c']);

    const stats = await getQuestionCrowdStats(
      'u1',
      'guess-player',
      { challengeId: CHALLENGE_ID, questionId: 'q1', language: 'en' },
      'UTC',
    );

    expect(stats.available).toBe(true);
    expect(stats.sampleSize).toBe(5);
    expect(stats.percentages).toEqual({ b: 60, c: 40 });
    // The correct answer gets no weight of its own.
    expect(stats.percentages.a).toBeUndefined();
  });

  test('excludes the asking player’s own answer', async () => {
    await seedOtherAnswers(['b', 'b', 'b', 'b', 'b']);
    await answer('q1', ['a'], 'u1');

    const stats = await getQuestionCrowdStats(
      'u1',
      'guess-player',
      { challengeId: CHALLENGE_ID, questionId: 'q1', language: 'en' },
      'UTC',
    );

    expect(stats.sampleSize).toBe(5);
    expect(stats.percentages).toEqual({ b: 100 });
  });

  test('is unavailable — never fabricated — below the sample threshold', async () => {
    await seedOtherAnswers(['b', 'c']);

    const stats = await getQuestionCrowdStats(
      'u1',
      'guess-player',
      { challengeId: CHALLENGE_ID, questionId: 'q1', language: 'en' },
      'UTC',
    );

    expect(stats.available).toBe(false);
    expect(stats.sampleSize).toBe(2);
    expect(stats.percentages).toEqual({});
  });

  test('is unavailable when nobody has answered at all', async () => {
    const stats = await getQuestionCrowdStats(
      'u1',
      'guess-player',
      { challengeId: CHALLENGE_ID, questionId: 'q1', language: 'en' },
      'UTC',
    );

    expect(stats.available).toBe(false);
    expect(stats.sampleSize).toBe(0);
  });

  test('counts each question separately', async () => {
    await seedOtherAnswers(['b', 'b', 'b', 'b', 'b']);
    for (let i = 0; i < 5; i += 1) {
      await answer('q2', ['d'], `other-${i}`);
    }

    const first = await getQuestionCrowdStats(
      'u1',
      'guess-player',
      { challengeId: CHALLENGE_ID, questionId: 'q1', language: 'en' },
      'UTC',
    );
    const second = await getQuestionCrowdStats(
      'u1',
      'guess-player',
      { challengeId: CHALLENGE_ID, questionId: 'q2', language: 'en' },
      'UTC',
    );

    expect(first.percentages).toEqual({ b: 100 });
    expect(second.percentages).toEqual({ d: 100 });
  });

  test('rejects a challenge that is not published today', async () => {
    await expect(
      getQuestionCrowdStats(
        'u1',
        'guess-player',
        { challengeId: 'not-a-challenge', questionId: 'q1', language: 'en' },
        'UTC',
      ),
    ).rejects.toThrow('QUESTIONS_CHALLENGE_NOT_FOUND');
  });
});
