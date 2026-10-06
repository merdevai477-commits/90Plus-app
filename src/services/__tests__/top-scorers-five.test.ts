/**
 * Top Scorers Five — scoring rules, accumulation, idempotent fixture
 * processing, one pick per league per gameweek, and the pick deadline.
 *
 * Prisma is mocked with a tiny in-memory store that enforces the same unique
 * keys as the real tables, so duplicate handling is exercised, not assumed.
 */

import type { TopScorersFiveFixture, TopScorersFiveGameweek } from '@prisma/client';

type PerformanceRow = {
  gameweekId: string;
  playerId: string;
  fixtureId: number;
  goals: number;
  assists: number;
  points: number;
};
type SelectionRow = { id: string; userId: string; gameweekId: string; leagueKey: string; playerId: string; updatedAt: Date };

const db = {
  performances: [] as PerformanceRow[],
  selections: [] as SelectionRow[],
  pool: [] as Array<{ id: string; externalPlayerId: number; teamId: number }>,
  players: new Map<string, Record<string, unknown>>(),
  gameweek: null as TopScorersFiveGameweek | null,
};

const prismaMock = {
  user: { findFirst: jest.fn(async () => ({ id: 'user-1' })) },
  cachedFixture: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
  topScorersFiveGameweek: {
    findUnique: jest.fn(async () => db.gameweek),
    findUniqueOrThrow: jest.fn(async () => db.gameweek),
    findFirst: jest.fn(async () => null),
    create: jest.fn(),
    update: jest.fn(),
  },
  topScorersFivePlayer: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => db.players.get(where.id) ?? null),
    findMany: jest.fn(async () => db.pool.map(({ id, externalPlayerId }) => ({ id, externalPlayerId }))),
  },
  topScorersFiveFixture: { update: jest.fn(async () => ({})) },
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
    upsert: jest.fn(
      async ({ where, create, update }: {
        where: { userId_gameweekId_leagueKey: { userId: string; gameweekId: string; leagueKey: string } };
        create: Omit<SelectionRow, 'id' | 'updatedAt'>;
        update: { playerId: string };
      }) => {
        const key = where.userId_gameweekId_leagueKey;
        let row = db.selections.find(
          (s) => s.userId === key.userId && s.gameweekId === key.gameweekId && s.leagueKey === key.leagueKey,
        );
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
        } else {
          row = { id: `sel-${db.selections.length + 1}`, ...create, updatedAt: new Date() };
          db.selections.push(row);
        }
        return { ...row, player: db.players.get(row.playerId) };
      },
    ),
  },
  $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../threeSixFiveScores.service', () => ({
  threeSixFiveScoresService: { getCompetitorStats: jest.fn(async () => ({ data: null })) },
}));
jest.mock('../scores365-experiment.service', () => ({
  classifyScores365MatchStatus: jest.fn(),
  fetchScores365GameById: jest.fn(),
}));

import {
  computeTsfPoints,
  extractTsfStatsFrom365Game,
  isTsfGameweekOpen,
  nextTsfGameweekStatus,
  sumTsfPerformances,
  tsfGameweekWindow,
} from '../top-scorers-five-scoring';
import { saveTsfSelection, scoreTsfPicks, TopScorersFiveError } from '../top-scorers-five.service';
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
  db.players = new Map(
    ['p-mbappe', 'p-vini', 'p-lewa', 'p-yamal'].map((id) => [
      id,
      {
        id, leagueKey: 'laliga', active: true, externalPlayerId: 1, nameAr: id, nameEn: id,
        clubNameAr: 'x', clubNameEn: 'x', teamId: 131, photoUrl: null, position: 'CF',
      },
    ]),
  );
  db.gameweek = null;
  jest.clearAllMocks();
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

describe('selection', () => {
  it('keeps one pick per user, gameweek and league — a second pick replaces the first', async () => {
    db.gameweek = gameweek({ status: 'OPEN', lockAt: new Date(NOW.getTime() + 3600_000) });
    await saveTsfSelection('clerk-1', 'laliga', 'p-mbappe', 'en', NOW);
    const changed = await saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW);
    expect(db.selections).toHaveLength(1);
    expect(db.selections[0]).toMatchObject({ userId: 'user-1', gameweekId: 'gw-1', leagueKey: 'laliga', playerId: 'p-lewa' });
    expect(changed.selection?.player.id).toBe('p-lewa');
  });

  it('refuses to change a pick once the gameweek is locked', async () => {
    db.gameweek = gameweek({ status: 'OPEN', lockAt: new Date(NOW.getTime() - 60_000) });
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW)).rejects.toMatchObject({
      code: 'GAMEWEEK_LOCKED',
    });
    db.gameweek = gameweek({ status: 'LIVE', lockAt: new Date(NOW.getTime() + 3600_000) });
    await expect(saveTsfSelection('clerk-1', 'laliga', 'p-lewa', 'en', NOW)).rejects.toBeInstanceOf(TopScorersFiveError);
    expect(prismaMock.topScorersFiveSelection.upsert).not.toHaveBeenCalled();
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

  it('allows edits only while OPEN and before the deadline', () => {
    const lockAt = new Date(NOW.getTime() + 1);
    expect(isTsfGameweekOpen({ status: 'OPEN', lockAt }, NOW)).toBe(true);
    expect(isTsfGameweekOpen({ status: 'OPEN', lockAt: NOW }, NOW)).toBe(false);
    expect(isTsfGameweekOpen({ status: 'LOCKED', lockAt }, NOW)).toBe(false);
  });
});
