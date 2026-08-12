/**
 * REGRESSION — THE SESSION_LOAD_FAILED / 502 LOOP
 *
 * The Questions hub served every mode a 200 whose `content` held no
 * `questions`, then a 502 once that was detected, and the app had nothing to
 * act on either way.
 *
 * The cause was a chain, and each link is pinned here:
 *
 *  1. `ensureDailyChallenges` counted published ROWS. Eight stale rows written
 *     by a retired code path (flat pre-rounds content, `source:
 *     'STATIC_FALLBACK'`) satisfied that count, so the AI generator was never
 *     called.
 *  2. When generation did run and failed, `recycleMostRecentChallenges` copied
 *     those same unplayable rows on to the new day — and its update branch
 *     flipped `status` alone, leaving today's broken content in place.
 *  3. `getQuestionsChallengeSession` then served such a row, after paying for a
 *     full AI batch on every single request.
 *
 * A round is what questions-challenges.round-contract.ts says it is, at EVERY
 * stage: generation, publication, recycling and serving. Anything else is a
 * failure with a name and a reason — never a 200, never published, and never
 * backfilled with canned football content.
 */

import { validRound } from '../../test-utils/questions-rounds';

/* ── in-memory database ── */

interface ChallengeRow {
  id: string;
  type: string;
  language: string;
  refreshDate: Date;
  status: string;
  title: string;
  description: string;
  image: string;
  icon: string;
  difficulty: string;
  xpReward: number;
  refreshTime: string;
  streakContribution: boolean;
  leaderboardEligibility: boolean;
  content: any;
  answer: any;
  source: string;
}

const db = { challenges: [] as ChallengeRow[] };

function matches(row: any, where: any): boolean {
  for (const [key, value] of Object.entries(where ?? {})) {
    if (value === undefined) continue;
    if (value instanceof Date) {
      if (!(row[key] instanceof Date) || row[key].getTime() !== value.getTime()) return false;
      continue;
    }
    if (value && typeof value === 'object' && ('gte' in (value as any) || 'lt' in (value as any))) {
      const time = (row[key] as Date)?.getTime?.() ?? 0;
      if ('gte' in (value as any) && time < (value as any).gte.getTime()) return false;
      if ('lt' in (value as any) && time >= (value as any).lt.getTime()) return false;
      continue;
    }
    if (row[key] !== value) return false;
  }
  return true;
}

const upserted: ChallengeRow[] = [];

const prismaMock: any = {
  $transaction: async (fn: any) => fn(prismaMock),
  dailyQuestionChallenge: {
    count: async ({ where }: any) => db.challenges.filter((row) => matches(row, where)).length,
    findFirst: async ({ where }: any) => db.challenges.find((row) => matches(row, where)) ?? null,
    findMany: async ({ where }: any) => db.challenges.filter((row) => matches(row, where)),
    upsert: async ({ where, create, update }: any) => {
      const key = where.refreshDate_type_language;
      const existing = db.challenges.find(
        (row) =>
          row.refreshDate.getTime() === key.refreshDate.getTime() &&
          row.type === key.type &&
          row.language === key.language,
      );
      if (existing) {
        Object.assign(existing, update);
        upserted.push(existing);
        return existing;
      }
      const row = { id: `new-${upserted.length}`, ...create } as ChallengeRow;
      db.challenges.push(row);
      upserted.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = db.challenges.find((entry) => entry.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
  },
  userQuestionChallenge: {
    findUnique: async () => null,
    findMany: async () => [],
    count: async () => 0,
    aggregate: async () => ({ _sum: { xpEarned: 0 } }),
    upsert: async () => undefined,
    update: async () => undefined,
  },
  loginStreak: { findUnique: async () => ({ current: 0, longest: 0 }) },
  user: { findMany: async () => [] },
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

jest.mock('../../utils/ensureBackendUser', () => ({
  ensureBackendUser: async (clerkUserId: string) => ({ id: `user-${clerkUserId}` }),
}));

jest.mock('../xp.service', () => ({ awardXp: async () => ({ awarded: 0 }) }));

jest.mock('../redis-cache.service', () => ({
  redisCacheService: {
    get: async () => null,
    set: async () => undefined,
    del: async () => undefined,
  },
}));

/** Today's AI daily pack — present by default, so Football Quiz can be built. */
const mockDailyPack = jest.fn(async () =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `pack-q${i + 1}`,
    difficulty: 'MEDIUM' as const,
    question: `Which country hosted the ${2000 + i} World Cup?`,
    hint: null,
    imageUrl: null,
    imageBinding: null,
    options: [
      { key: 'A', text: `Qatar ${i}` },
      { key: 'B', text: `Russia ${i}` },
      { key: 'C', text: `Brazil ${i}` },
      { key: 'D', text: `France ${i}` },
    ],
    correctKey: 'A',
  })),
);
jest.mock('../quiz-daily.service', () => ({ getOrCreateDailyPack: () => mockDailyPack() }));

const mockBuildAiQuestionChallenges = jest.fn(async () => null as any);
jest.mock('../questions-challenges.ai-generator.service', () => ({
  buildAiQuestionChallenges: (...args: unknown[]) => (mockBuildAiQuestionChallenges as any)(...args),
}));

import { getQuestionsChallengeSession } from '../questions-challenges.service';
import { todayPackDate } from '../quiz-generator.service';
import type { QuestionChallengeMode } from '../../types/questions-challenges.types';

/* ── fixtures ── */

const TZ = 'UTC';
const REFRESH_DATE = todayPackDate(TZ);

const ALL_MODES: Array<[string, QuestionChallengeMode]> = [
  ['GUESS_PLAYER', 'guess-player'],
  ['GUESS_CLUB', 'guess-club'],
  ['FOOTBALL_BINGO', 'football-bingo'],
  ['FOOTBALL_GRID', 'football-grid'],
  ['PLAYER_CONNECTIONS', 'player-connections'],
  ['TRANSFER_PUZZLE', 'transfer-puzzle'],
  ['TOP10_CHALLENGE', 'top10-challenge'],
  ['FOOTBALL_QUIZ', 'football-quiz'],
];

function row(overrides: Partial<ChallengeRow> = {}): ChallengeRow {
  const round = validRound('guess-player');
  return {
    id: 'challenge-1',
    type: 'GUESS_PLAYER',
    language: 'en',
    refreshDate: REFRESH_DATE,
    status: 'PUBLISHED',
    title: 'Guess The Player',
    description: 'Guess the player from the clues',
    image: '',
    icon: 'user',
    difficulty: 'MEDIUM',
    xpReward: 90,
    refreshTime: '00:00',
    streakContribution: true,
    leaderboardEligibility: true,
    content: round.content,
    answer: round.answer,
    source: 'AI',
    ...overrides,
  };
}

/** A full, contract-valid published day — all eight modes. */
function playableDay(refreshDate = REFRESH_DATE): ChallengeRow[] {
  return ALL_MODES.map(([type, mode], index) => {
    const round = validRound(mode);
    return row({
      id: `${type.toLowerCase()}-${refreshDate.getTime()}`,
      type,
      refreshDate,
      content: round.content,
      answer: round.answer,
      xpReward: round.questions.reduce((total, question) => total + question.xpReward, 0),
      icon: `icon-${index}`,
    });
  });
}

/**
 * The exact shape found in production: a pre-rounds row whose single question
 * sits directly on `content`, with no `questions` array anywhere.
 */
function legacyFlatRow(): ChallengeRow {
  return row({
    source: 'STATIC_FALLBACK',
    content: {
      hint: 'Played in La Liga',
      title: 'Guess The Player',
      prompt: 'Who is this player ?',
      options: [
        { id: 'a', label: 'Lionel Messi' },
        { id: 'b', label: 'Cristiano Ronaldo' },
      ],
      imageUrl: 'https://images.unsplash.com/photo-1459865264687-595d652de67e',
      description: 'Guess the player from the clues',
      playerFacts: ['Left-footed'],
    },
  });
}

beforeEach(() => {
  db.challenges = [];
  upserted.length = 0;
  mockDailyPack.mockClear();
  mockBuildAiQuestionChallenges.mockClear();
  mockBuildAiQuestionChallenges.mockResolvedValue(null);
});

describe('a round is what the contract says it is', () => {
  it('serves a real round normally', async () => {
    db.challenges = [row()];

    const session = await getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ);

    expect(session.challengeId).toBe('challenge-1');
    expect((session.content as any).questions).toHaveLength(6);
  });

  it('refuses to serve a legacy flat row as a successful session', async () => {
    db.challenges = [legacyFlatRow()];

    // Previously: resolved with `content` holding no questions, which the app
    // mapped to an empty round and reported as SESSION_LOAD_FAILED.
    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();
  });

  it('archives an unplayable published row so it can never be served again', async () => {
    db.challenges = [legacyFlatRow()];

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    expect(db.challenges[0]!.status).toBe('ARCHIVED');
  });

  it('refuses to serve a row whose questions array is empty', async () => {
    db.challenges = [row({ content: { questions: [] }, source: 'AI' })];

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();
  });

  it('refuses to serve a round whose questions break the contract', async () => {
    // Six questions, but the hero image the whole mode is built on is missing.
    const round = validRound('guess-player');
    round.questions.forEach((question) => {
      delete (question as any).imageUrl;
    });

    db.challenges = [row({ content: { ...round.content, questions: round.questions } })];

    // Six questions is not enough to be a round: it is refused, and the row is
    // taken out of circulation rather than served as a 200.
    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();
    expect(db.challenges[0]!.status).toBe('ARCHIVED');
  });

  it('still reports a genuinely missing mode as not-found, not empty', async () => {
    db.challenges = [];

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow(
      'QUESTIONS_CHALLENGE_NOT_FOUND',
    );
  });

  it('serves every mode of a valid published day', async () => {
    db.challenges = playableDay();

    for (const [, mode] of ALL_MODES) {
      const session = await getQuestionsChallengeSession('clerk-1', mode, 'en', TZ);
      expect((session.content as any).questions.length).toBe(6);
      expect(session.type).toBe(mode);
    }
  });
});

describe('a valid published round costs nothing to serve', () => {
  it('does not invoke AI generation or the daily pack when the round is already valid', async () => {
    db.challenges = playableDay();

    const session = await getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ);

    expect((session.content as any).questions).toHaveLength(6);
    // The round in the database is the authority — nothing upstream is touched.
    expect(mockBuildAiQuestionChallenges).not.toHaveBeenCalled();
    expect(mockDailyPack).not.toHaveBeenCalled();
  });

  it('serves a valid mode even while OTHER modes of the day are missing', async () => {
    // Only guess-player is published; the day is incomplete, but this round is
    // playable and must not pay for the rest of the day's generation.
    db.challenges = [row()];

    await getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ);

    expect(mockBuildAiQuestionChallenges).not.toHaveBeenCalled();
  });
});

describe('stale legacy rows no longer suppress AI generation', () => {
  /** Eight unplayable rows — exactly what production had, one per mode. */
  function eightLegacyRows(refreshDate = REFRESH_DATE): ChallengeRow[] {
    return ALL_MODES.map(([type], index) => ({
      ...legacyFlatRow(),
      id: `legacy-${index}-${refreshDate.getTime()}`,
      type,
      refreshDate,
    }));
  }

  it('attempts generation even though eight rows are already published', async () => {
    db.challenges = eightLegacyRows();

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    // The bare-count gate returned early here and never called the AI.
    expect(mockBuildAiQuestionChallenges).toHaveBeenCalled();
  });

  it('does not recycle canned legacy rows on to a new day', async () => {
    // Yesterday's rows are canned; today has nothing.
    const yesterday = new Date(REFRESH_DATE);
    yesterday.setDate(yesterday.getDate() - 1);
    db.challenges = eightLegacyRows(yesterday);

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    // Recycling these forward is what kept the broken state alive for days.
    expect(upserted.some((entry) => entry.source === 'STATIC_FALLBACK')).toBe(false);
    expect(upserted.some((entry) => entry.type === 'GUESS_PLAYER')).toBe(false);
  });

  it('publishes Football Quiz even when the AI modes fail', async () => {
    // The AI batch throws (starved entity pool) but the daily pack is fine.
    db.challenges = [];

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    const footballQuiz = upserted.find((entry) => entry.type === 'FOOTBALL_QUIZ');
    expect(footballQuiz).toBeDefined();
    expect(footballQuiz!.content.questions.length).toBe(6);
    // Its questions are the AI pack's, never an authored bank.
    expect(footballQuiz!.source).toBe('AI');
  });

  it('does not publish Football Quiz when the daily pack is unavailable', async () => {
    mockDailyPack.mockResolvedValueOnce([] as never);
    db.challenges = [];

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    expect(upserted.find((entry) => entry.type === 'FOOTBALL_QUIZ')).toBeUndefined();
  });

  it('does not publish a short Football Quiz round rather than a full one', async () => {
    // Four pack questions is not a six-question round; the card is skipped.
    mockDailyPack.mockImplementationOnce(async () =>
      Array.from({ length: 4 }, (_, i) => ({
        id: `pack-q${i + 1}`,
        difficulty: 'MEDIUM' as const,
        question: `Short pack question ${i}`,
        hint: null,
        imageUrl: null,
        imageBinding: null,
        options: [
          { key: 'A', text: `A${i}` },
          { key: 'B', text: `B${i}` },
          { key: 'C', text: `C${i}` },
          { key: 'D', text: `D${i}` },
        ],
        correctKey: 'A',
      })),
    );
    db.challenges = [];

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    expect(upserted.find((entry) => entry.type === 'FOOTBALL_QUIZ')).toBeUndefined();
  });
});

describe('a mode that fails never takes a mode that succeeded down with it', () => {
  /** What the generator returns when only some modes could be authored. */
  function aiChallenge(mode: QuestionChallengeMode): any {
    const round = validRound(mode);
    return {
      mode,
      difficulty: 'MEDIUM',
      xpReward: round.questions.reduce((total, question) => total + question.xpReward, 0),
      title: `${mode} title`,
      description: `${mode} description`,
      image: '',
      icon: 'user',
      content: round.content,
      answer: round.answer,
      metadata: {
        refreshTime: '00:00',
        streakContribution: true,
        leaderboardEligibility: true,
        localized: true,
        source: 'AI',
        model: 'test-model',
      },
    };
  }

  it('publishes the modes the AI could author and serves them', async () => {
    // guess-club found no honest round today; guess-player did. The old code
    // discarded BOTH, which is how the hub ended up with nothing to serve.
    mockBuildAiQuestionChallenges.mockResolvedValue([aiChallenge('guess-player')] as any);
    db.challenges = [];

    const session = await getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ);

    expect((session.content as any).questions).toHaveLength(6);
    expect(upserted.some((entry) => entry.type === 'GUESS_PLAYER')).toBe(true);
    // The mode that failed is absent, not padded out.
    expect(upserted.some((entry) => entry.type === 'GUESS_CLUB')).toBe(false);
  });

  it('refuses to publish a generated round that fails the contract', async () => {
    const broken = aiChallenge('guess-player');
    broken.content.questions = broken.content.questions.map((question: any) => ({
      ...question,
      options: question.options.slice(0, 2),
    }));
    mockBuildAiQuestionChallenges.mockResolvedValue([broken] as any);
    db.challenges = [];

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    expect(upserted.some((entry) => entry.type === 'GUESS_PLAYER')).toBe(false);
  });
});

describe('the fallback tier is held to the same contract', () => {
  const yesterday = new Date(REFRESH_DATE);
  yesterday.setDate(yesterday.getDate() - 1);

  it('recycles a genuinely playable previous day and serves it as a 200', async () => {
    db.challenges = playableDay(yesterday);

    const session = await getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ);

    expect((session.content as any).questions).toHaveLength(6);
    expect(session.refreshDate).toBe(
      `${REFRESH_DATE.getUTCFullYear()}-${String(REFRESH_DATE.getUTCMonth() + 1).padStart(2, '0')}-${String(
        REFRESH_DATE.getUTCDate(),
      ).padStart(2, '0')}`,
    );
  });

  it('refuses to recycle a previous round that would fail the contract', async () => {
    // Yesterday's rounds have questions, but their answers point at options
    // that do not exist — playable-looking, not actually playable.
    db.challenges = playableDay(yesterday).map((entry) => {
      const content = JSON.parse(JSON.stringify(entry.content));
      for (const question of content.questions) question.answer = { correctIds: ['zzz'] };
      return { ...entry, content };
    });

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    expect(upserted.some((entry) => entry.type === 'GUESS_PLAYER')).toBe(false);
  });

  it('replaces today’s broken row instead of merely re-publishing it', async () => {
    // Today holds the unplayable STATIC_FALLBACK row; yesterday is real.
    db.challenges = [legacyFlatRow(), ...playableDay(yesterday)];

    const session = await getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ);

    // The recycle update branch used to flip `status` alone, leaving the broken
    // content in place — the session then failed on a "successful" recycle.
    expect((session.content as any).questions).toHaveLength(6);
    expect(session.content).not.toHaveProperty('playerFacts');
  });

  it('never publishes a canned STATIC_FALLBACK round', async () => {
    db.challenges = eightLegacy();

    await expect(getQuestionsChallengeSession('clerk-1', 'guess-player', 'en', TZ)).rejects.toThrow();

    for (const entry of upserted) {
      expect(entry.source).not.toBe('STATIC_FALLBACK');
      expect(Array.isArray(entry.content?.questions) && entry.content.questions.length > 0).toBe(true);
    }
  });

  function eightLegacy(): ChallengeRow[] {
    return ALL_MODES.map(([type], index) => ({
      ...legacyFlatRow(),
      id: `legacy-${index}`,
      type,
      refreshDate: yesterday,
    }));
  }
});
