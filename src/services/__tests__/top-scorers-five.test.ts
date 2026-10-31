/**
 * Top Scorers Five — scoring rules, accumulation, idempotent fixture
 * processing, one pick per league per gameweek, and the pick deadline.
 *
 * Prisma is mocked with a tiny in-memory store that enforces the same unique
 * keys as the real tables, so duplicate handling is exercised, not assumed.
 */

import { Prisma, type TopScorersFiveFixture, type TopScorersFiveGameweek } from '@prisma/client';

type PerformanceRow = {
  gameweekId: string;
  playerId: string;
  fixtureId: number;
  goals: number;
  assists: number;
  points: number;
  participation?: string;
};
type SelectionRow = {
  id: string;
  userId: string;
  gameweekId: string;
  leagueKey: string;
  playerId: string;
  confirmedAt: Date | null;
  updatedAt: Date;
};
type SelectionKey = { userId_gameweekId_leagueKey: { userId: string; gameweekId: string; leagueKey: string } };

const findSelection = (key: { userId: string; gameweekId: string; leagueKey: string }) =>
  db.selections.find((s) => s.userId === key.userId && s.gameweekId === key.gameweekId && s.leagueKey === key.leagueKey);

const db = {
  performances: [] as PerformanceRow[],
  selections: [] as SelectionRow[],
  pool: [] as Array<{ id: string; externalPlayerId: number; teamId: number }>,
  players: new Map<string, Record<string, unknown>>(),
  /** The gameweek every lookup resolves to (the "current" one). */
  gameweek: null as TopScorersFiveGameweek | null,
  /** Earlier gameweeks, for the lineup carry-over. */
  weeks: [] as TopScorersFiveGameweek[],
};

type CachedFixtureRow = { fixtureId?: number; homeTeamId: number; awayTeamId: number; matchDate: Date; status: string };
type WeekWhere = { leagueKey: string; startAt: { lt: Date; gte?: Date }; lineupCarriedAt?: { not: null } };

const earlierWeeks = (where: WeekWhere) =>
  db.weeks.filter(
    (w) =>
      w.leagueKey === where.leagueKey &&
      w.startAt < where.startAt.lt &&
      (!where.startAt.gte || w.startAt >= where.startAt.gte) &&
      (!where.lineupCarriedAt || w.lineupCarriedAt != null),
  );

const prismaMock = {
  user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
  cachedFixture: {
    findFirst: jest.fn(async () => null),
    findMany: jest.fn(async (): Promise<CachedFixtureRow[]> => []),
    count: jest.fn(async () => 1),
  },
  topScorersFiveGameweek: {
    findUnique: jest.fn(async () => db.gameweek),
    findUniqueOrThrow: jest.fn(async () => db.gameweek),
    findFirst: jest.fn(async ({ where }: { where: WeekWhere }) =>
      earlierWeeks(where).sort((a, b) => b.startAt.getTime() - a.startAt.getTime())[0] ?? null,
    ),
    findMany: jest.fn(async ({ where }: { where: WeekWhere }) => earlierWeeks(where)),
    updateMany: jest.fn(
      async ({ where, data }: { where: { id: string; lineupCarriedAt: null }; data: { lineupCarriedAt: Date } }) => {
        const gw = db.gameweek;
        if (!gw || gw.id !== where.id || gw.lineupCarriedAt != null) return { count: 0 };
        Object.assign(gw, data);
        return { count: 1 };
      },
    ),
    create: jest.fn(),
    update: jest.fn(),
  },
  topScorersFivePlayer: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => db.players.get(where.id) ?? null),
    findMany: jest.fn(async () => db.pool.map(({ id, externalPlayerId }) => ({ id, externalPlayerId }))),
  },
  topScorersFiveFixture: { update: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
  topScorersFivePerformance: {
    createMany: jest.fn(async ({ data, skipDuplicates }: { data: PerformanceRow[]; skipDuplicates?: boolean }) => {
      let count = 0;
      for (const row of data) {
        const clash = db.performances.some(
          (p) => p.gameweekId === row.gameweekId && p.playerId === row.playerId && p.fixtureId === row.fixtureId,
        );
        if (clash) {
          if (!skipDuplicates) throw new Error('P2002 unique violation');
          continue;
        }
        db.performances.push({ ...row });
        count += 1;
      }
      return { count };
    }),
    findMany: jest.fn(async () => []),
    groupBy: jest.fn(async () => []),
  },
  topScorersFiveSelection: {
    findUnique: jest.fn(async ({ where }: { where: SelectionKey }) => {
      const row = findSelection(where.userId_gameweekId_leagueKey);
      return row ? { ...row, player: db.players.get(row.playerId) } : null;
    }),
    create: jest.fn(async ({ data }: { data: Omit<SelectionRow, 'id' | 'updatedAt'> }) => {
      if (findSelection(data)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
      }
      const row = { id: `sel-${db.selections.length + 1}`, ...data, updatedAt: new Date() };
      db.selections.push(row);
      return row;
    }),
    updateMany: jest.fn(
      async ({ where, data }: { where: Omit<SelectionRow, 'id' | 'updatedAt' | 'playerId'>; data: Partial<SelectionRow> }) => {
        const row = findSelection(where);
        if (!row || (where.confirmedAt === null && row.confirmedAt !== null)) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    ),
    deleteMany: jest.fn(async ({ where }: { where: Omit<SelectionRow, 'id' | 'updatedAt' | 'playerId'> }) => {
      const before = db.selections.length;
      db.selections = db.selections.filter(
        (s) => !(findSelection(where) === s && (where.confirmedAt !== null || s.confirmedAt === null)),
      );
      return { count: before - db.selections.length };
    }),
    findMany: jest.fn(
      async ({ where }: { where: { gameweekId: string | { in: string[] }; leagueKey?: { in: string[] } } }) =>
        db.selections
          .filter((s) =>
            typeof where.gameweekId === 'string' ? s.gameweekId === where.gameweekId : where.gameweekId.in.includes(s.gameweekId),
          )
          .filter((s) => !where.leagueKey || where.leagueKey.in.includes(s.leagueKey))
          .map((s) => ({ ...s, player: db.players.get(s.playerId) })),
    ),
    createMany: jest.fn(
      async ({ data, skipDuplicates }: { data: Array<Pick<SelectionRow, 'userId' | 'gameweekId' | 'leagueKey' | 'playerId'>>; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const row of data) {
          if (findSelection(row)) {
            if (!skipDuplicates) throw new Error('P2002 unique violation');
            continue;
          }
          db.selections.push({ id: `sel-${db.selections.length + 1}`, ...row, confirmedAt: null, updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    ),
  },
  $transaction: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../threeSixFiveScores.service', () => ({
  threeSixFiveScoresService: {
    getCompetitorStats: jest.fn(async () => ({ data: null })),
    syncCompetitionFixtures: jest.fn(async () => 0),
  },
}));
jest.mock('../scores365-experiment.service', () => ({
  classifyScores365MatchStatus: jest.fn(),
  fetchScores365GameById: jest.fn(),
}));

import {
  combineTsfPickStates,
  computeTsfPoints,
  extractTsfStatsFrom365Game,
  isTsfFixtureKickedOff,
  isTsfFixtureNotStarted,
  isTsfGameweekOpen,
  isTsfLeaguePickingOpen,
  isTsfSelectionLocked,
  nextTsfGameweekStatus,
  sumTsfPerformances,
  tsfGameweekWindow,
  tsfParticipationFrom365Game,
  tsfParticipationOf,
  tsfPickState,
  tsfUpcomingWindow,
} from '../top-scorers-five-scoring';
import {
  clearTsfSelection,
  ensureTsfGameweek,
  getTsfSelection,
  saveTsfSelection,
  scoreTsfPicks,
  TopScorersFiveError,
} from '../top-scorers-five.service';
import { processTsfFixture, type TsfProcessingDeps } from '../top-scorers-five-processing.service';

const NOW = new Date('2026-10-10T20:00:00.000Z');

function gameweek(overrides: Partial<TopScorersFiveGameweek> = {}): TopScorersFiveGameweek {
  return {
    id: 'gw-1',
    leagueKey: 'laliga',
    weekKey: '2026-10-06',
    startAt: new Date('2026-10-06T00:00:00.000Z'),
    endAt: new Date('2026-10-13T00:00:00.000Z'),
    lockAt: new Date('2026-10-09T19:00:00.000Z'),
    status: 'LIVE',
    completedAt: null,
    lineupCarriedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fixture(overrides: Partial<TopScorersFiveFixture> = {}): TopScorersFiveFixture {
  return {
    id: 'fx-1',
    gameweekId: 'gw-1',
    fixtureId: 4_500_001,
    homeTeamId: 131,
    awayTeamId: 132,
    homeTeamName: 'Real Madrid',
    awayTeamName: 'Barcelona',
    kickoffAt: new Date('2026-10-10T16:00:00.000Z'),
    status: 'FT',
    processedAt: null,
    failureCount: 0,
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Member 11 → athlete 1001 (Mbappé), 12 → 1002 (Vinícius), 21 → 2001 (Lewandowski). */
const CLASICO = {
  members: [
    { id: 11, athleteId: 1001 },
    { id: 12, athleteId: 1002 },
    { id: 21, athleteId: 2001 },
  ],
  events: [
    { playerId: 11, extraPlayers: [12], eventType: { id: 1, subTypeName: 'Field Goal' } },
    { playerId: 11, extraPlayers: [], eventType: { id: 1, subTypeName: 'Penalty' } },
    { playerId: 21, extraPlayers: [], eventType: { id: 1, subTypeName: 'Own Goal' } },
    { playerId: 12, extraPlayers: [], eventType: { id: 2, subTypeName: 'Yellow Card' } },
  ],
};

function deps(game: unknown = CLASICO, status = 'FT'): TsfProcessingDeps & { fetchGame: jest.Mock } {
  return {
    now: () => NOW,
    fetchGame: jest.fn(async () => game as never),
    classifyStatus: () => status,
    listDayFixtures: async () => [],
  };
}

beforeEach(() => {
  db.performances = [];
  db.selections = [];
  db.pool = [
    { id: 'p-mbappe', externalPlayerId: 1001, teamId: 131 },
    { id: 'p-vini', externalPlayerId: 1002, teamId: 131 },
    { id: 'p-lewa', externalPlayerId: 2001, teamId: 132 },
  ];
  db.players = new Map<string, Record<string, unknown>>(
    (
      [
        ['p-mbappe', 131],
        ['p-vini', 131],
        ['p-lewa', 132],
        ['p-yamal', 131],
      ] as const
    ).map(([id, teamId]) => [
      id,
      {
        id,
        leagueKey: 'laliga',
        active: true,
        externalPlayerId: 1,
        nameAr: id,
        nameEn: id,
        clubNameAr: 'x',
        clubNameEn: 'x',
        teamId,
        photoUrl: null,
        position: 'CF',
      },
    ]),
  );
  db.gameweek = null;
  db.weeks = [];
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (arg: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
  );
  // Default: both clubs still have a not-started fixture in the window.
  prismaMock.cachedFixture.findMany.mockImplementation(async () => [
    {
      homeTeamId: 131,
      awayTeamId: 999,
      matchDate: new Date(NOW.getTime() + 3600_000),
      status: 'NS',
    },
    {
      homeTeamId: 132,
      awayTeamId: 998,
      matchDate: new Date(NOW.getTime() + 7200_000),
      status: 'NS',
    },
  ]);
});

describe('points', () => {
  it.each([
    [{ goals: 1, assists: 0 }, 3],
    [{ goals: 0, assists: 1 }, 1],
    [{ goals: 1, assists: 1 }, 4],
    [{ goals: 2, assists: 1 }, 7],
    [{ goals: 0, assists: 0 }, 0],
  ])('%o scores %i', (line, points) => {
    expect(computeTsfPoints(line)).toBe(points);
  });
});

describe('365Scores game → goals and assists', () => {
  it('maps member ids to athletes, counts penalties, ignores own goals and non-goal events', () => {
    const stats = extractTsfStatsFrom365Game(CLASICO);
    expect(stats.get(1001)).toEqual({ goals: 2, assists: 0 });
    expect(stats.get(1002)).toEqual({ goals: 0, assists: 1 });
    expect(stats.has(2001)).toBe(false);
  });

  it('does not credit a scorer with an assist on his own goal', () => {
    const stats = extractTsfStatsFrom365Game({
      members: [{ id: 11, athleteId: 1001 }],
      events: [{ playerId: 11, extraPlayers: [11], eventType: { id: 1 } }],
    });
    expect(stats.get(1001)).toEqual({ goals: 1, assists: 0 });
  });
});

describe('accumulation', () => {
  it('adds a player\'s fixtures together', () => {
    const rows = [
      { goals: 1, assists: 1, points: computeTsfPoints({ goals: 1, assists: 1 }) },
      { goals: 2, assists: 1, points: computeTsfPoints({ goals: 2, assists: 1 }) },
    ];
    expect(sumTsfPerformances(rows)).toEqual({ goals: 3, assists: 2, points: 11 });
  });

  it('sums each user\'s picks across gameweeks and leagues', () => {
    const points = new Map([
      ['gw-1:p-mbappe', 7],
      ['gw-2:p-mbappe', 4],
      ['gw-1:p-lewa', 3],
    ]);
    const totals = scoreTsfPicks(
      [
        { userId: 'u1', gameweekId: 'gw-1', playerId: 'p-mbappe', leagueKey: 'laliga' },
        { userId: 'u1', gameweekId: 'gw-2', playerId: 'p-mbappe', leagueKey: 'laliga' },
        { userId: 'u2', gameweekId: 'gw-1', playerId: 'p-lewa', leagueKey: 'laliga' },
        { userId: 'u3', gameweekId: 'gw-1', playerId: 'p-yamal', leagueKey: 'laliga' },
      ],
      points,
    );
    expect(totals.get('u1')).toBe(11);
    expect(totals.get('u2')).toBe(3);
    expect(totals.get('u3')).toBe(0);
  });
});

describe('fixture processing', () => {
  it('writes one row per pool player in the game with the right points', async () => {
    const result = await processTsfFixture(gameweek(), fixture(), deps());
    expect(result).toEqual({ outcome: 'scored', rows: 3 });
    const byPlayer = Object.fromEntries(db.performances.map((p) => [p.playerId, p]));
    expect(byPlayer['p-mbappe']).toMatchObject({ goals: 2, assists: 0, points: 6 });
    expect(byPlayer['p-vini']).toMatchObject({ goals: 0, assists: 1, points: 1 });
    expect(byPlayer['p-lewa']).toMatchObject({ goals: 0, assists: 0, points: 0 });
    expect(prismaMock.topScorersFiveFixture.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processedAt: NOW, status: 'FT' }) }),
    );
  });

  it('accumulates two different fixtures for the same player', async () => {
    await processTsfFixture(gameweek(), fixture(), deps());
    const second = {
      members: [{ id: 31, athleteId: 1001 }],
      events: [{ playerId: 31, extraPlayers: [], eventType: { id: 1 } }],
    };
    await processTsfFixture(gameweek(), fixture({ id: 'fx-2', fixtureId: 4_500_002 }), deps(second));
    const mbappe = db.performances.filter((p) => p.playerId === 'p-mbappe');
    expect(mbappe).toHaveLength(2);
    expect(sumTsfPerformances(mbappe).points).toBe(9);
  });

  it('never reads or scores a processed fixture again', async () => {
    const d = deps();
    const result = await processTsfFixture(gameweek(), fixture({ processedAt: NOW }), d);
    expect(result.outcome).toBe('already_processed');
    expect(d.fetchGame).not.toHaveBeenCalled();
    expect(prismaMock.topScorersFivePerformance.createMany).not.toHaveBeenCalled();
  });

  it('does not duplicate points when the same fixture is processed twice', async () => {
    // Two overlapping runs that both saw the fixture as unprocessed.
    await processTsfFixture(gameweek(), fixture(), deps());
    const again = await processTsfFixture(gameweek(), fixture(), deps());
    expect(again).toEqual({ outcome: 'scored', rows: 0 });
    expect(db.performances).toHaveLength(3);
    expect(sumTsfPerformances(db.performances.filter((p) => p.playerId === 'p-mbappe')).points).toBe(6);
    expect(prismaMock.topScorersFivePerformance.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('gives no points before the final whistle', async () => {
    const live = await processTsfFixture(gameweek(), fixture({ status: 'LIVE', kickoffAt: new Date(NOW.getTime() - 30 * 60_000) }), deps());
    expect(live.outcome).toBe('in_progress');

    const stillPlaying = await processTsfFixture(
      gameweek(),
      fixture({ status: 'LIVE', kickoffAt: new Date(NOW.getTime() - 3 * 3600_000) }),
      deps(CLASICO, 'LIVE'),
    );
    expect(stillPlaying.outcome).toBe('in_progress');
    expect(db.performances).toHaveLength(0);
  });

  it('closes cancelled fixtures without points and leaves postponed ones open', async () => {
    expect((await processTsfFixture(gameweek(), fixture({ status: 'CANC' }), deps())).outcome).toBe('voided');
    expect((await processTsfFixture(gameweek(), fixture({ status: 'NS', kickoffAt: new Date(NOW.getTime() - 3 * 3600_000) }), deps(CLASICO, 'PST'))).outcome).toBe('postponed');
    expect(db.performances).toHaveLength(0);
  });
});

describe('fixture processing — participation', () => {
  const LINEUP_GAME = {
    members: [
      { id: 11, athleteId: 1001 },
      { id: 12, athleteId: 1002 },
      { id: 13, athleteId: 1003 },
      { id: 14, athleteId: 1004 },
    ],
    homeCompetitor: {
      lineups: { members: [{ id: 11, status: 1 }, { id: 12, status: 2 }, { id: 13, status: 2 }, { id: 14, status: 3 }] },
    },
    awayCompetitor: { lineups: { members: [] } },
    events: [
      { playerId: 11, extraPlayers: [], eventType: { id: 1 } },
      { playerId: 99, extraPlayers: [12], eventType: { id: 1000, name: 'Substitution' } },
    ],
  };

  it('reads started, came on, unused bench, unavailable and absent from the final lineups', () => {
    const p = tsfParticipationFrom365Game(LINEUP_GAME);
    expect(tsfParticipationOf(1001, p)).toBe('STARTED');
    expect(tsfParticipationOf(1002, p)).toBe('SUBBED_ON');
    expect(tsfParticipationOf(1003, p)).toBe('BENCH');
    expect(tsfParticipationOf(1004, p)).toBe('UNAVAILABLE');
    expect(tsfParticipationOf(2001, p)).toBe('NOT_IN_SQUAD');
    expect(tsfParticipationOf(1001, tsfParticipationFrom365Game({ members: [], events: [] }))).toBe('UNKNOWN');
  });

  it('stores participation and gives a player who did not play 0 points although his club played', async () => {
    db.pool = [
      { id: 'p-mbappe', externalPlayerId: 1001, teamId: 131 },
      { id: 'p-bench', externalPlayerId: 1003, teamId: 131 },
      { id: 'p-out', externalPlayerId: 1004, teamId: 131 },
    ];
    await processTsfFixture(gameweek(), fixture(), deps(LINEUP_GAME));
    const byPlayer = Object.fromEntries(db.performances.map((p) => [p.playerId, p]));
    expect(byPlayer['p-mbappe']).toMatchObject({ goals: 1, points: 3, participation: 'STARTED' });
    expect(byPlayer['p-bench']).toMatchObject({ goals: 0, assists: 0, points: 0, participation: 'BENCH' });
    expect(byPlayer['p-out']).toMatchObject({ points: 0, participation: 'UNAVAILABLE' });
  });
});

describe('selection — confirm is final', () => {
  const openWeek = () => gameweek({ status: 'OPEN', lockAt: new Date(NOW.getTime() + 3600_000) });

  it('confirms the pick and reports it locked', async () => {
    db.gameweek = openWeek();
    const saved = await saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW);
    expect(db.selections).toHaveLength(1);
    expect(db.selections[0]).toMatchObject({ userId: 'user-1', gameweekId: 'gw-1', leagueKey: 'laliga', playerId: 'p-mbappe', confirmedAt: NOW });
    expect(saved.selection).toMatchObject({ confirmed: true, locked: true });
    expect(saved.state).toBe('CONFIRMED');
  });

  it('refuses another player after confirming with GAMEWEEK_PICK_LOCKED; the same player again is a no-op', async () => {
    db.gameweek = openWeek();
    await saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW);
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW)).rejects.toMatchObject({ code: 'GAMEWEEK_PICK_LOCKED' });
    expect(db.selections[0].playerId).toBe('p-mbappe');
    const again = await saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW);
    expect(again.selection?.player.id).toBe('p-mbappe');
  });

  it('refuses to remove a confirmed pick', async () => {
    db.gameweek = openWeek();
    await saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW);
    await expect(clearTsfSelection('clerk-1', 'laliga', NOW)).rejects.toMatchObject({ code: 'GAMEWEEK_PICK_LOCKED' });
    expect(db.selections).toHaveLength(1);
  });

  it('lets an unconfirmed pick be replaced once, then locks it', async () => {
    db.gameweek = openWeek();
    db.selections.push({ id: 'sel-1', userId: 'user-1', gameweekId: 'gw-1', leagueKey: 'laliga', playerId: 'p-vini', confirmedAt: null, updatedAt: NOW });
    const replaced = await saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW);
    expect(replaced.selection).toMatchObject({ confirmed: true });
    expect(db.selections).toEqual([expect.objectContaining({ playerId: 'p-lewa', confirmedAt: NOW })]);
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW)).rejects.toMatchObject({ code: 'GAMEWEEK_PICK_LOCKED' });
  });

  it('lets only one of two racing confirms win', async () => {
    db.gameweek = openWeek();
    const results = await Promise.allSettled([
      saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW),
      saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected?.reason).toMatchObject({ code: 'GAMEWEEK_PICK_LOCKED' });
    expect(db.selections).toHaveLength(1);
  });

  it('still allows a pick after the league lockAt when that player\'s match has not started', async () => {
    db.gameweek = gameweek({ status: 'LOCKED', lockAt: new Date(NOW.getTime() - 60_000) });
    const saved = await saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW);
    expect(saved.selection?.player.id).toBe('p-lewa');
    expect(db.selections).toHaveLength(1);
  });

  it('refuses a player whose club match has already started, even while others remain open', async () => {
    db.gameweek = gameweek({ status: 'LIVE', lockAt: new Date(NOW.getTime() - 60_000) });
    prismaMock.cachedFixture.findMany.mockImplementation(async () => [
      {
        homeTeamId: 131,
        awayTeamId: 999,
        matchDate: new Date(NOW.getTime() + 3600_000),
        status: 'NS',
      },
    ]);
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW)).rejects.toMatchObject({
      code: 'GAMEWEEK_LOCKED',
    });
    const saved = await saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW);
    expect(saved.selection?.player.id).toBe('p-mbappe');
  });

  it('refuses any pick once the gameweek window has ended', async () => {
    db.gameweek = gameweek({
      status: 'LIVE',
      lockAt: new Date(NOW.getTime() - 60_000),
      endAt: new Date(NOW.getTime() - 1),
    });
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW)).rejects.toMatchObject({
      code: 'GAMEWEEK_LOCKED',
    });
    expect(prismaMock.topScorersFiveSelection.create).not.toHaveBeenCalled();
  });

  it('rejects players outside the eligible list or not linked to match data', async () => {
    db.gameweek = gameweek({ status: 'OPEN', lockAt: new Date(NOW.getTime() + 3600_000) });
    await expect(saveTsfSelection('clerk-1', 'laliga', 'nobody', 'en', NOW)).rejects.toMatchObject({ code: 'PLAYER_NOT_FOUND' });
    db.players.set('p-unlinked', { ...db.players.get('p-yamal'), id: 'p-unlinked', externalPlayerId: null });
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-unlinked', 'en', NOW)).rejects.toMatchObject({ code: 'PLAYER_UNRESOLVED' });
    db.players.set('p-other', { ...db.players.get('p-yamal'), id: 'p-other', leagueKey: 'pl' });
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-other', 'en', NOW)).rejects.toMatchObject({ code: 'PLAYER_NOT_ELIGIBLE' });
    await expect(saveTsfSelection('clerk-1', 'eredivisie', 'p-mbappe', 'en', NOW)).rejects.toMatchObject({ code: 'LEAGUE_NOT_SUPPORTED' });
  });
});

describe('lineup carry-over — a pick stays until the user changes it', () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  /** A week starting `startsIn` ms from `from`, with lineups not carried in yet. */
  const week = (id: string, startsIn: number, overrides: Partial<TopScorersFiveGameweek> = {}, from = NOW.getTime()) =>
    gameweek({
      id,
      weekKey: id,
      startAt: new Date(from + startsIn),
      endAt: new Date(from + startsIn + 7 * DAY),
      lockAt: new Date(from + startsIn + 7 * DAY),
      status: 'OPEN',
      lineupCarriedAt: null,
      ...overrides,
    });
  const pick = (userId: string, gameweekId: string, leagueKey: string, playerId: string): SelectionRow => ({
    id: `${userId}-${gameweekId}-${leagueKey}`,
    userId,
    gameweekId,
    leagueKey,
    playerId,
    confirmedAt: NOW,
    updatedAt: NOW,
  });
  const lineup = (gameweekId: string) =>
    db.selections
      .filter((s) => s.gameweekId === gameweekId)
      .map(({ userId, leagueKey, playerId, confirmedAt }) => ({ userId, leagueKey, playerId, confirmedAt }))
      .sort((a, b) => `${a.userId}:${a.leagueKey}`.localeCompare(`${b.userId}:${b.leagueKey}`));

  it('shows last week\'s player in the new gameweek, unconfirmed and still changeable', async () => {
    const now = Date.now();
    db.weeks = [week('gw-1', -8 * DAY, { status: 'COMPLETED' }, now)];
    db.selections.push(pick('user-1', 'gw-1', 'laliga', 'p-vini'));
    db.gameweek = week('gw-2', -HOUR, { lockAt: new Date(now + DAY) }, now);
    prismaMock.cachedFixture.findMany.mockImplementation(async () => [
      { fixtureId: 1, homeTeamId: 131, awayTeamId: 999, matchDate: new Date(now + DAY), status: 'NS' },
      { fixtureId: 2, homeTeamId: 132, awayTeamId: 998, matchDate: new Date(now + DAY), status: 'NS' },
    ]);

    const result = await getTsfSelection('clerk-1', 'laliga', 'en');
    expect(result).toMatchObject({
      gameweek: { id: 'gw-2' },
      state: 'PICKING',
      selection: { player: { id: 'p-vini' }, confirmed: false, locked: false },
    });
    expect(lineup('gw-2')).toEqual([{ userId: 'user-1', leagueKey: 'laliga', playerId: 'p-vini', confirmedAt: null }]);
    expect(db.gameweek?.lineupCarriedAt).toBeInstanceOf(Date);
  });

  it('takes each slot\'s latest pick, and skips inactive players and clubs that already kicked off', async () => {
    db.weeks = [week('gw-a', -14 * DAY), week('gw-b', -7 * DAY)];
    db.selections.push(
      pick('user-1', 'gw-a', 'laliga', 'p-mbappe'),
      pick('user-2', 'gw-a', 'laliga', 'p-mbappe'),
      pick('user-2', 'gw-b', 'laliga', 'p-vini'),
      pick('user-3', 'gw-b', 'laliga', 'p-yamal'),
      pick('user-4', 'gw-b', 'laliga', 'p-lewa'),
    );
    db.players.set('p-yamal', { ...db.players.get('p-yamal'), active: false });
    db.gameweek = week('gw-c', -HOUR, { lockAt: new Date(NOW.getTime() + HOUR) });
    prismaMock.cachedFixture.findMany.mockImplementation(async () => [
      { fixtureId: 1, homeTeamId: 131, awayTeamId: 999, matchDate: new Date(NOW.getTime() + HOUR), status: 'NS' },
      { fixtureId: 2, homeTeamId: 132, awayTeamId: 998, matchDate: new Date(NOW.getTime() - HOUR / 2), status: '1H' },
    ]);

    await ensureTsfGameweek('laliga', NOW);
    expect(lineup('gw-c')).toEqual([
      { userId: 'user-1', leagueKey: 'laliga', playerId: 'p-mbappe', confirmedAt: null },
      { userId: 'user-2', leagueKey: 'laliga', playerId: 'p-vini', confirmedAt: null },
    ]);
  });

  it('carries once per gameweek, and a pick the user removed stays removed next week', async () => {
    db.weeks = [week('gw-1', -8 * DAY)];
    db.selections.push(pick('user-1', 'gw-1', 'laliga', 'p-vini'));
    const gw2 = week('gw-2', -HOUR, { lockAt: new Date(NOW.getTime() + DAY) });
    db.gameweek = gw2;

    await clearTsfSelection('clerk-1', 'laliga', NOW);
    expect(lineup('gw-2')).toEqual([]);
    await ensureTsfGameweek('laliga', NOW);
    expect(lineup('gw-2')).toEqual([]);

    db.weeks.push(gw2);
    db.gameweek = week('gw-3', 6 * DAY);
    await ensureTsfGameweek('laliga', NOW);
    expect(lineup('gw-3')).toEqual([]);
  });

  it('keeps an Egypt attacker in one slot only when he moved between slots', async () => {
    db.weeks = [week('gw-a', -14 * DAY, { leagueKey: 'egypt' }), week('gw-b', -7 * DAY, { leagueKey: 'egypt' })];
    db.selections.push(
      pick('user-1', 'gw-a', 'egypt1', 'p-mbappe'),
      pick('user-1', 'gw-a', 'egypt2', 'p-vini'),
      pick('user-1', 'gw-b', 'egypt2', 'p-mbappe'),
      pick('user-1', 'gw-b', 'egypt3', 'p-lewa'),
    );
    db.gameweek = week('gw-c', -HOUR, { leagueKey: 'egypt', lockAt: new Date(NOW.getTime() + DAY) });

    await ensureTsfGameweek('egypt1', NOW);
    expect(lineup('gw-c')).toEqual([
      { userId: 'user-1', leagueKey: 'egypt2', playerId: 'p-mbappe', confirmedAt: null },
      { userId: 'user-1', leagueKey: 'egypt3', playerId: 'p-lewa', confirmedAt: null },
    ]);
  });

  it('never copies into a gameweek that has already kicked off', async () => {
    db.weeks = [week('gw-1', -8 * DAY)];
    db.selections.push(pick('user-1', 'gw-1', 'laliga', 'p-vini'));
    db.gameweek = week('gw-2', -DAY, { lockAt: new Date(NOW.getTime() - HOUR), status: 'LIVE' });

    await ensureTsfGameweek('laliga', NOW);
    expect(lineup('gw-2')).toEqual([]);
    expect(db.gameweek?.lineupCarriedAt).toBeNull();
  });

  it('locks a carried pick once his club kicks off: no swap, no removal', async () => {
    db.gameweek = week('gw-2', -DAY, { lockAt: new Date(NOW.getTime() - HOUR), status: 'LIVE', lineupCarriedAt: NOW });
    db.selections.push({ ...pick('user-1', 'gw-2', 'laliga', 'p-vini'), confirmedAt: null });
    prismaMock.cachedFixture.findMany.mockImplementation(async () => [
      { fixtureId: 1, homeTeamId: 131, awayTeamId: 999, matchDate: new Date(NOW.getTime() - HOUR / 2), status: '1H' },
      { fixtureId: 2, homeTeamId: 132, awayTeamId: 998, matchDate: new Date(NOW.getTime() + 2 * HOUR), status: 'NS' },
    ]);

    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW)).rejects.toMatchObject({ code: 'GAMEWEEK_PICK_LOCKED' });
    await expect(clearTsfSelection('clerk-1', 'laliga', NOW)).rejects.toMatchObject({ code: 'GAMEWEEK_PICK_LOCKED' });
    const same = await saveTsfSelection('clerk-1', 'laliga', 'p-vini', 'en', NOW);
    expect(same.selection).toMatchObject({ player: { id: 'p-vini' }, confirmed: false, locked: true });
    expect(lineup('gw-2')).toEqual([{ userId: 'user-1', leagueKey: 'laliga', playerId: 'p-vini', confirmedAt: null }]);
  });

  it('locks an unconfirmed pick from its first kickoff; postponed matches do not count', () => {
    const live = { lockAt: NOW, endAt: new Date(NOW.getTime() + DAY), status: 'LIVE' as const };
    const later = { kickoffAt: new Date(NOW.getTime() + 60_000), status: 'NS' };
    expect(isTsfSelectionLocked({ confirmedAt: null }, live, NOW, [later])).toBe(false);
    expect(isTsfSelectionLocked({ confirmedAt: null }, live, NOW, [later, { kickoffAt: NOW, status: 'NS' }])).toBe(true);
    expect(isTsfSelectionLocked({ confirmedAt: null }, live, NOW, [{ ...later, status: '1H' }])).toBe(true);
    expect(isTsfSelectionLocked({ confirmedAt: NOW }, live, NOW, [later])).toBe(true);
    expect(isTsfFixtureKickedOff({ kickoffAt: new Date(NOW.getTime() - 60_000), status: 'PST' }, NOW)).toBe(false);
    expect(isTsfFixtureKickedOff({ kickoffAt: new Date(NOW.getTime() - 60_000), status: 'CANC' }, NOW)).toBe(false);
  });
});

describe('gameweek window and lifecycle', () => {
  it('runs Tuesday to Tuesday in UTC', () => {
    const w = tsfGameweekWindow(new Date('2026-10-12T22:00:00.000Z')); // Monday
    expect(w.weekKey).toBe('2026-10-06');
    expect(w.endAt.toISOString()).toBe('2026-10-13T00:00:00.000Z');
    expect(tsfGameweekWindow(new Date('2026-10-13T00:00:00.000Z')).weekKey).toBe('2026-10-13');
  });

  it('moves OPEN → LOCKED → LIVE → CALCULATING and never backwards', () => {
    const base = {
      lockAt: new Date('2026-10-09T19:00:00.000Z'),
      endAt: new Date('2026-10-13T00:00:00.000Z'),
      anyStarted: false,
      allSettled: false,
    };
    expect(nextTsfGameweekStatus('OPEN', { ...base, now: new Date('2026-10-08T00:00:00.000Z') })).toBe('OPEN');
    expect(nextTsfGameweekStatus('OPEN', { ...base, now: new Date('2026-10-09T19:00:00.000Z') })).toBe('LOCKED');
    expect(nextTsfGameweekStatus('LOCKED', { ...base, anyStarted: true, now: new Date('2026-10-09T20:00:00.000Z') })).toBe('LIVE');
    expect(nextTsfGameweekStatus('LIVE', { ...base, anyStarted: true, now: new Date('2026-10-13T01:00:00.000Z') })).toBe('LIVE');
    expect(nextTsfGameweekStatus('LIVE', { ...base, allSettled: true, now: new Date('2026-10-13T01:00:00.000Z') })).toBe('CALCULATING');
    expect(nextTsfGameweekStatus('LIVE', { ...base, now: new Date('2026-10-08T00:00:00.000Z') })).toBe('LIVE');
  });

  it('computes the upcoming window as the next 7 days from now', () => {
    const { from, to } = tsfUpcomingWindow(NOW);
    expect(from).toEqual(NOW);
    expect(to.getTime() - from.getTime()).toBe(7 * 86_400_000);
  });

  it('starts the same player at 0 when picked again next gameweek — points never carry over', () => {
    const points = new Map([['gw-1:p-vini', 7]]);
    const picks = [
      { userId: 'u1', gameweekId: 'gw-1', playerId: 'p-vini', leagueKey: 'laliga' },
      { userId: 'u1', gameweekId: 'gw-2', playerId: 'p-vini', leagueKey: 'laliga' },
    ];
    expect(scoreTsfPicks(picks.slice(1), points).get('u1')).toBe(0);
    expect(scoreTsfPicks(picks, points).get('u1')).toBe(7);
  });

  it('allows edits only while OPEN and before the deadline', () => {
    const lockAt = new Date(NOW.getTime() + 1);
    expect(isTsfGameweekOpen({ status: 'OPEN', lockAt }, NOW)).toBe(true);
    expect(isTsfGameweekOpen({ status: 'OPEN', lockAt: NOW }, NOW)).toBe(false);
    expect(isTsfGameweekOpen({ status: 'LOCKED', lockAt }, NOW)).toBe(false);
  });

  it('keeps league picking open through LOCKED/LIVE until the window ends', () => {
    const endAt = new Date(NOW.getTime() + 86_400_000);
    expect(isTsfLeaguePickingOpen({ status: 'LOCKED', endAt }, NOW)).toBe(true);
    expect(isTsfLeaguePickingOpen({ status: 'LIVE', endAt }, NOW)).toBe(true);
    expect(isTsfLeaguePickingOpen({ status: 'CALCULATING', endAt }, NOW)).toBe(false);
    expect(isTsfLeaguePickingOpen({ status: 'LIVE', endAt: NOW }, NOW)).toBe(false);
  });

  it('treats a fixture as pickable only before kickoff', () => {
    const kickoffAt = new Date(NOW.getTime() + 60_000);
    expect(isTsfFixtureNotStarted({ kickoffAt, status: 'NS' }, NOW)).toBe(true);
    expect(isTsfFixtureNotStarted({ kickoffAt: NOW, status: 'NS' }, NOW)).toBe(false);
    expect(isTsfFixtureNotStarted({ kickoffAt, status: 'LIVE' }, NOW)).toBe(false);
    expect(isTsfFixtureNotStarted({ kickoffAt, status: 'FT' }, NOW)).toBe(false);
  });
});

describe('pick state', () => {
  const END = new Date('2026-10-13T00:00:00.000Z');
  const past = (hours: number) => new Date(NOW.getTime() - hours * 3600_000);
  const later = (hours: number) => new Date(NOW.getTime() + hours * 3600_000);
  const state = (fixtures: Parameters<typeof tsfPickState>[0]['fixtures'], extra: Partial<Parameters<typeof tsfPickState>[0]> = {}) =>
    tsfPickState({ picked: true, locked: true, now: NOW, windowEnd: END, fixtures, ...extra });

  it('is PICKING with no pick or an unconfirmed pick in an open week', () => {
    expect(state([], { picked: false })).toBe('PICKING');
    expect(state([], { locked: false })).toBe('PICKING');
  });

  it('is CONFIRMED until the first relevant match kicks off', () => {
    expect(state([{ kickoffAt: later(20), status: 'NS', processed: false }])).toBe('CONFIRMED');
  });

  it('waits for every relevant match — two matches, one still to come', () => {
    expect(state([
      { kickoffAt: past(30), status: 'FT', processed: true },
      { kickoffAt: later(20), status: 'NS', processed: false },
    ])).toBe('WAITING_FOR_MATCHES');
  });

  it('is CALCULATING when every match is over but stats are not all stored, COMPLETED when they are', () => {
    expect(state([
      { kickoffAt: past(30), status: 'FT', processed: true },
      { kickoffAt: past(3), status: 'FT', processed: false },
    ])).toBe('CALCULATING');
    expect(state([
      { kickoffAt: past(30), status: 'FT', processed: true },
      { kickoffAt: past(3), status: 'CANC', processed: true },
    ])).toBe('COMPLETED');
  });

  it('ignores a postponed match and closes a week with no match at its end', () => {
    expect(state([
      { kickoffAt: past(30), status: 'FT', processed: true },
      { kickoffAt: past(5), status: 'PST', processed: false },
    ])).toBe('COMPLETED');
    expect(state([])).toBe('CONFIRMED');
    expect(state([], { now: END })).toBe('COMPLETED');
  });

  it('is final for the user only once every pick is — four done, one waiting', () => {
    expect(combineTsfPickStates(['COMPLETED', 'COMPLETED', 'COMPLETED', 'WAITING_FOR_MATCHES', 'COMPLETED'])).toBe('WAITING_FOR_MATCHES');
    expect(combineTsfPickStates(['COMPLETED', 'CALCULATING'])).toBe('CALCULATING');
    expect(combineTsfPickStates(['COMPLETED', 'COMPLETED'])).toBe('COMPLETED');
    expect(combineTsfPickStates([])).toBe('PICKING');
  });
});
