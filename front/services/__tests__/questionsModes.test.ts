/**
 * THE APP-SIDE MAPPER
 *
 * Turns the challenge row the API serves into the round the screen plays. Its
 * whole job is to move real data across without losing or inventing anything,
 * so these tests are mostly about what must survive the trip — every image, in
 * particular, since the screen has no artwork fallback behind them any more.
 */

import { mapSessionToRound, QuestionsModesService } from '../questionsModes';

type SessionData = Parameters<typeof mapSessionToRound>[0];

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    difficulty: 'EASY',
    xpReward: 10,
    prompt: 'Who is this player?',
    hint: 'He wears 10',
    imageUrl: 'https://imagecache.365scores.com/salah.png',
    entity: {
      kind: 'player',
      id: 'player:1',
      name: 'Mohamed Salah',
      imageUrl: 'https://imagecache.365scores.com/salah.png',
    },
    evidence: [{ id: 'e1', text: 'Country: Egypt', label: 'Country', value: 'Egypt', icon: 'globe' }],
    options: [
      { id: 'a', label: 'Mohamed Salah' },
      { id: 'b', label: 'Sadio Mane' },
      { id: 'c', label: 'Riyad Mahrez' },
      { id: 'd', label: 'Hakim Ziyech' },
    ],
    answer: { correctIds: ['a'] },
    ...overrides,
  };
}

function session(type: string, questions: unknown[]): SessionData {
  return {
    challengeId: 'challenge-1',
    type: type as SessionData['type'],
    title: 'Guess The Player',
    description: 'Guess the player from the clues',
    image: '',
    icon: 'user',
    difficulty: 'EASY',
    xpReward: 90,
    refreshDate: '2026-06-10',
    refreshTime: '00:00',
    completionState: 'available',
    completionPercentage: 0,
    unlockState: true,
    streakContribution: true,
    leaderboardEligibility: true,
    content: { title: 't', description: 'd', prompt: 'p', questions },
    attempts: 0,
    completed: false,
    score: 0,
    elapsedTime: 0,
  };
}

describe('mapSessionToRound', () => {
  test('maps every question in the round, in order', () => {
    const questions = Array.from({ length: 6 }, (_, i) =>
      question({ id: `q${i + 1}`, prompt: `Question ${i + 1}` }),
    );

    const round = mapSessionToRound(session('guess-player', questions));

    expect(round).toHaveLength(6);
    expect(round.map((entry) => entry.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
    expect(round.map((entry) => entry.prompt)).toEqual(questions.map((entry) => entry.prompt));
  });

  test('keeps the per-question image and the entity it was resolved for', () => {
    const [mapped] = mapSessionToRound(session('guess-player', [question()]));

    expect(mapped!.imageUrl).toBe('https://imagecache.365scores.com/salah.png');
    expect(mapped!.entity).toEqual({
      kind: 'player',
      id: 'player:1',
      name: 'Mohamed Salah',
      imageUrl: 'https://imagecache.365scores.com/salah.png',
    });
  });

  test('does not borrow the challenge-level image when a question has none', () => {
    const data = session('guess-player', [question({ imageUrl: undefined, entity: undefined })]);
    data.image = 'https://example.com/mode-card.png';

    const [mapped] = mapSessionToRound(data);

    // A blank hero is honest; the card's artwork is not this question's picture.
    expect(mapped!.imageUrl).toBeUndefined();
  });

  test('treats an empty image string as no image', () => {
    const [mapped] = mapSessionToRound(session('guess-player', [question({ imageUrl: '   ' })]));
    expect(mapped!.imageUrl).toBeUndefined();
  });

  test('carries options with their labels, crests and example lines', () => {
    const [mapped] = mapSessionToRound(
      session('transfer-puzzle', [
        question({
          options: [
            { id: 'a', label: 'Napoli', imageUrl: 'https://crest/492.png', example: 'Serie A' },
            { id: 'b', label: 'Sevilla', imageUrl: 'https://crest/536.png' },
            { id: 'c', label: 'Ajax', imageUrl: 'https://crest/194.png' },
            { id: 'd', label: 'Roma', imageUrl: 'https://crest/497.png' },
          ],
          transferTimeline: [
            { id: 't1', label: 'Ajax', year: '2019', imageUrl: 'https://crest/194.png' },
            { id: 't2', label: '?', hidden: true },
          ],
        }),
      ]),
    );

    expect(mapped!.type).toBe('transfer');
    expect(mapped!.options!.map((option) => option.imageUrl)).toEqual([
      'https://crest/492.png',
      'https://crest/536.png',
      'https://crest/194.png',
      'https://crest/497.png',
    ]);
    expect(mapped!.options![0]!.example).toBe('Serie A');
    expect(mapped!.transferChain).toEqual([
      { id: 't1', label: 'Ajax', imageUrl: 'https://crest/194.png', unknown: false },
      { id: 't2', label: '?', imageUrl: undefined, unknown: true },
    ]);
  });

  test('maps a Top 10 question as ten empty slots and no answer', () => {
    const [mapped] = mapSessionToRound(
      session('top10-challenge', [
        // A live Top 10 question carries its framing and NOTHING else: the
        // base fixture's mcq answer is dropped on purpose here.
        question({
          answer: undefined,
          options: undefined,
          top10: { slots: 10, categoryLabel: 'the Premier League', seasonLabel: '2010' },
        }),
      ]),
    );

    expect(mapped!.type).toBe('top10');
    expect(mapped!.top10).toEqual({
      slots: 10,
      categoryLabel: 'the Premier League',
      seasonLabel: '2010',
    });
    // The names are the answer — a live question must arrive without them.
    expect(mapped!.correctAnswers).toEqual([]);
  });

  test('keeps the grid board, its crests and the cell being asked for', () => {
    const [mapped] = mapSessionToRound(
      session('football-grid', [
        question({
          rows: ['Liverpool', 'Arsenal', 'Chelsea'],
          columns: ['Champions League', 'Premier League', 'World Cup'],
          rowImages: ['https://crest/40.png', 'https://crest/42.png', 'https://crest/49.png'],
          gridCell: { row: 1, column: 2 },
          options: [
            { id: 'a', label: 'Player A', imageUrl: 'https://p/1.png' },
            { id: 'b', label: 'Player B', imageUrl: 'https://p/2.png' },
            { id: 'c', label: 'Player C', imageUrl: 'https://p/3.png' },
            { id: 'd', label: 'Player D', imageUrl: 'https://p/4.png' },
          ],
        }),
      ]),
    );

    expect(mapped!.type).toBe('grid');
    expect(mapped!.rowHeaders).toEqual(['Liverpool', 'Arsenal', 'Chelsea']);
    expect(mapped!.colHeaders).toEqual(['Champions League', 'Premier League', 'World Cup']);
    expect(mapped!.rowHeaderImages).toHaveLength(3);
    expect(mapped!.gridCell).toEqual({ row: 1, column: 2 });
    // Four real players to place, each with a portrait.
    expect(mapped!.options).toHaveLength(4);
    expect(mapped!.options!.every((option) => option.imageUrl?.startsWith('https://'))).toBe(true);
  });

  test('keeps every bingo cell crest', () => {
    const board = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 3 }, (_, col) => ({
        id: `r${row}-c${col}`,
        label: `Club ${row * 3 + col}`,
        imageUrl: `https://crest/${row * 3 + col}.png`,
        kind: 'club',
      })),
    );

    const [mapped] = mapSessionToRound(
      session('football-bingo', [
        question({ bingoBoard: board, answer: { correctIds: ['r0-c0', 'r1-c1', 'r2-c2'] } }),
      ]),
    );

    expect(mapped!.type).toBe('bingo');
    expect(mapped!.board!.flat()).toHaveLength(9);
    expect(mapped!.board!.flat().every((cell) => cell.imageUrl?.startsWith('https://'))).toBe(true);
  });

  test('keeps a portrait per connections player', () => {
    const [mapped] = mapSessionToRound(
      session('player-connections', [
        question({
          players: [
            { id: 'p1', name: 'A', imageUrl: 'https://p/a.png' },
            { id: 'p2', name: 'B', imageUrl: 'https://p/b.png' },
            { id: 'p3', name: 'C', imageUrl: 'https://p/c.png' },
            { id: 'p4', name: 'D', imageUrl: 'https://p/d.png' },
          ],
        }),
      ]),
    );

    expect(mapped!.type).toBe('connections');
    expect(mapped!.connectionPlayers).toHaveLength(4);
    expect(new Set(mapped!.connectionPlayers!.map((player) => player.imageUrl)).size).toBe(4);
  });

  test('maps evidence rows the screen can draw', () => {
    const [mapped] = mapSessionToRound(session('guess-club', [question()]));

    expect(mapped!.evidence).toEqual([
      { id: 'e1', text: 'Country: Egypt', label: 'Country', value: 'Egypt', icon: 'globe' },
    ]);
  });

  test('returns an empty round rather than padding a missing one', () => {
    const data = session('guess-player', []);
    expect(mapSessionToRound(data)).toEqual([]);

    (data.content as Record<string, unknown>).questions = undefined;
    expect(mapSessionToRound(data)).toEqual([]);
  });

  test('survives a malformed question without throwing', () => {
    const round = mapSessionToRound(
      session('guess-player', [{ id: 'q1' }, { prompt: 'no id' }, {}]),
    );

    expect(round).toHaveLength(3);
    expect(round[0]!.correctAnswers).toEqual([]);
    expect(round[1]!.id).toBe('q2');
    expect(round[2]!.options).toEqual([]);
  });
});

describe('QuestionsModesService', () => {
  const token = 'token';
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /** Enough of a Response for safeJsonParse: headers, clone() and text(). */
  function mockFetch(status: number, body: unknown) {
    const makeResponse = (): any => {
      const response = {
        ok: status >= 200 && status < 300,
        status,
        statusText: '',
        headers: { get: () => null },
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: () => makeResponse(),
      };
      return response;
    };
    const fetchMock = jest.fn(async () => makeResponse());
    global.fetch = fetchMock as never;
    return fetchMock;
  }

  test('createSession plays the whole round the API published', async () => {
    const questions = Array.from({ length: 6 }, (_, i) => question({ id: `q${i + 1}` }));
    mockFetch(200, { status: 'SUCCESS', data: session('guess-player', questions) });

    const result = await QuestionsModesService.createSession(token, 'guess-player', 'en');

    expect(result.questions).toHaveLength(6);
    expect(result.totalQuestions).toBe(6);
    expect(result.mode.totalQuestions).toBe(6);
  });

  test('submitAnswer tells the API which question was answered', async () => {
    const fetchMock = mockFetch(200, { status: 'SUCCESS', data: { isCorrect: true } });

    await QuestionsModesService.submitAnswer(token, 'guess-player', {
      challengeId: 'challenge-1',
      questionId: 'q4',
      selectedIds: ['a'],
      elapsedTime: 3,
      language: 'en',
    });

    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expect(body.questionId).toBe('q4');
    expect(body.challengeId).toBe('challenge-1');
  });

  test('getCrowdStats passes the question through and returns the real split', async () => {
    const fetchMock = mockFetch(200, {
      status: 'SUCCESS',
      data: {
        challengeId: 'challenge-1',
        questionId: 'q2',
        available: true,
        sampleSize: 12,
        percentages: { a: 50, b: 25, c: 25 },
      },
    });

    const stats = await QuestionsModesService.getCrowdStats(token, 'guess-player', {
      challengeId: 'challenge-1',
      questionId: 'q2',
      language: 'en',
    });

    expect((fetchMock.mock.calls[0] as any[])[0]).toContain('questionId=q2');
    expect(stats.available).toBe(true);
    expect(stats.percentages).toEqual({ a: 50, b: 25, c: 25 });
  });

  test('getCrowdStats reports unavailable rather than inventing a split on failure', async () => {
    mockFetch(500, { status: 'ERROR' });

    const stats = await QuestionsModesService.getCrowdStats(token, 'guess-player', {
      challengeId: 'challenge-1',
      questionId: 'q2',
      language: 'en',
    });

    expect(stats.available).toBe(false);
    expect(stats.percentages).toEqual({});
  });

  test('createSession surfaces an auth failure instead of returning a stub round', async () => {
    mockFetch(401, { status: 'ERROR' });

    await expect(QuestionsModesService.createSession(token, 'guess-player', 'en')).rejects.toThrow(
      'AUTH_REQUIRED',
    );
  });

  test('createSession surfaces a server failure instead of returning a stub round', async () => {
    mockFetch(500, { status: 'ERROR' });

    await expect(QuestionsModesService.createSession(token, 'guess-player', 'en')).rejects.toThrow(
      'API_ERROR_500',
    );
  });
});
