import { getRedisClient } from '../../lib/redis';
import {
  FOOTBALL_365_LIVE_MATCHES_KEY,
  FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX,
} from '../../utils/football-cache-keys.util';
import { FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX } from '../live-fixture-cache.service';
import {
  isTerminalLatched,
  readLiveFixtureById,
  readLiveFixturesList,
  writeTerminalFixtureSnapshot,
} from '../live-fixture-cache.service';
import { matchCacheService } from '../match-cache.service';
import prisma from '../../lib/prisma';
import { sync365SyntheticLiveSnapshots } from '../scores365-experiment.service';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: { findMany: jest.fn() },
    favoriteMatch: { findMany: jest.fn() },
  },
}));

jest.mock('../football-sync-leader.service', () => ({
  withSyncLeaderLease: jest.fn(async (_scope: string, work: (ctx: {
    signal: AbortSignal;
    isLost: () => boolean;
  }) => Promise<number>) => {
    const controller = new AbortController();
    return {
      acquired: true,
      value: await work({ signal: controller.signal, isLost: () => false }),
    };
  }),
}));

jest.mock('../match-cache.service', () => ({
  LIVE_STATUSES: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'],
  FINISHED_STATUSES: ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'],
  TERMINAL_LATCH_STATUSES: ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'],
  matchCacheService: {
    convertDbMatchToApiFormat: jest.fn((row: {
      fixtureId: number;
      status: string;
      elapsed: number | null;
      leagueId: number;
      matchDate: string;
      homeTeamName: string;
      awayTeamName: string;
      homeScore: number;
      awayScore: number;
    }) => ({
      fixture: {
        id: row.fixtureId,
        referee: null,
        timezone: 'UTC',
        date: row.matchDate,
        timestamp: 0,
        periods: { first: null, second: null },
        status: { short: row.status, long: 'Second Half', elapsed: row.elapsed, extra: null },
        venue: { id: null, name: null, city: null },
      },
      league: {
        id: row.leagueId,
        name: 'League',
        country: 'Spain',
        logo: '',
        flag: null,
        season: 2026,
        round: '',
      },
      teams: {
        home: { id: 11, name: row.homeTeamName, logo: '', winner: null },
        away: { id: 22, name: row.awayTeamName, logo: '', winner: null },
      },
      goals: { home: row.homeScore, away: row.awayScore },
      score: {
        halftime: { home: null, away: null },
        fulltime: { home: row.homeScore, away: row.awayScore },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    })),
    upsertFixtures: jest.fn(async () => 0),
  },
}));

jest.mock('../synthetic-goals.service', () => ({
  reconcileSyntheticGoals: jest.fn(async () => undefined),
}));

jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: {
    getMatchLineups: jest.fn(async () => null),
    getMatchStatistics: jest.fn(async () => null),
    getMatchEvents: jest.fn(async () => null),
    invalidateFixtureDetailCaches: jest.fn(async () => undefined),
  },
}));

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;
const mockedPrisma = prisma as unknown as {
  cachedFixture: { findMany: jest.Mock };
  favoriteMatch: { findMany: jest.Mock };
};

type ScriptedResponse =
  | { kind: 'http'; status: number; body?: unknown; badJson?: boolean }
  | { kind: 'throw'; message: string };

function redisHarness(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const ttls = new Map<string, number>();
  const drop = (key: string) => {
    values.delete(key);
    ttls.delete(key);
  };
  const pipeline = () => ({
    setex: jest.fn((key: string, ttl: number, value: string) => {
      values.set(key, value);
      ttls.set(key, ttl);
    }),
    del: jest.fn((key: string) => {
      drop(key);
    }),
    exec: jest.fn(async () => []),
  });
  return {
    values,
    ttls,
    client: {
      get: jest.fn(async (key: string) => values.get(key) ?? null),
      set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
        const nx = args.includes('NX');
        if (nx && values.has(key)) return null;
        values.set(key, value);
        const exAt = args.indexOf('EX');
        if (exAt >= 0 && typeof args[exAt + 1] === 'number') {
          ttls.set(key, args[exAt + 1] as number);
        }
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        drop(key);
        return 1;
      }),
      pipeline: jest.fn(pipeline),
    },
  };
}

function liveRow(id: number) {
  return {
    fixture: { id, status: { short: '2H', long: 'Second Half', elapsed: 80, extra: null } },
    league: { id: 7_000_007, name: 'League', country: 'Spain', logo: '', flag: null, season: 2026, round: '' },
    teams: {
      home: { id: 11, name: 'Home FC', logo: '', winner: null },
      away: { id: 22, name: 'Away FC', logo: '', winner: null },
    },
    goals: { home: 0, away: 0 },
    provider: '365',
  };
}

function dbRow(id: number) {
  return {
    fixtureId: id,
    status: '2H',
    elapsed: 80,
    leagueId: 7_000_007,
    matchDate: new Date().toISOString(),
    homeTeamName: 'Home FC',
    awayTeamName: 'Away FC',
    homeScore: 0,
    awayScore: 0,
  };
}

function liveGame(id: number, minute: number, statusText: string) {
  return {
    id,
    statusGroup: 3,
    statusText,
    gameTime: minute,
    gameTimeDisplay: `${minute}'`,
    startTime: new Date(Date.now() - minute * 60_000).toISOString(),
    homeCompetitor: { id: 501, name: 'Home FC', score: 1 },
    awayCompetitor: { id: 502, name: 'Away FC', score: 0 },
    competitionId: 11,
  };
}

function finishedGame(id: number) {
  return {
    ...liveGame(id, 90, 'Ended'),
    statusGroup: 4,
    shortStatusText: 'FT',
    gameTimeDisplay: 'FT',
    homeCompetitor: { id: 501, name: 'Home FC', score: 2 },
    awayCompetitor: { id: 502, name: 'Away FC', score: 1 },
  };
}

describe('365 synthetic refresh does not invent FT from a null game', () => {
  const originalExperiment = process.env.SCORES365_EXPERIMENT_ENABLED;
  const scripts = new Map<number, ScriptedResponse>();
  let redis: ReturnType<typeof redisHarness>;

  beforeEach(() => {
    process.env.SCORES365_EXPERIMENT_ENABLED = 'true';
    scripts.clear();
    redis = redisHarness();
    mockedGetRedisClient.mockReset();
    mockedGetRedisClient.mockReturnValue(redis.client as never);
    mockedPrisma.favoriteMatch.findMany.mockReset();
    mockedPrisma.favoriteMatch.findMany.mockResolvedValue([]);
    mockedPrisma.cachedFixture.findMany.mockReset();
    mockedPrisma.cachedFixture.findMany.mockImplementation(async (args: {
      where?: { fixtureId?: { in?: number[] } };
    }) => (args?.where?.fixtureId?.in ?? []).map((id) => dbRow(id)));
    (matchCacheService.upsertFixtures as jest.Mock).mockClear();
    global.fetch = jest.fn(async (input: string | URL) => {
      const url = String(input);
      if (!url.includes('/web/game/')) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      const id = Number(new URL(url).searchParams.get('gameId'));
      const script = scripts.get(id);
      if (!script || script.kind === 'throw') {
        throw new Error(script?.kind === 'throw' ? script.message : `unscripted game ${id}`);
      }
      return {
        ok: script.status >= 200 && script.status < 300,
        status: script.status,
        json: async () => {
          if (script.badJson) throw new SyntaxError('Unexpected token');
          return script.body ?? {};
        },
      };
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    if (originalExperiment == null) delete process.env.SCORES365_EXPERIMENT_ENABLED;
    else process.env.SCORES365_EXPERIMENT_ENABLED = originalExperiment;
  });

  function seedLive(id: number) {
    redis.values.set(FOOTBALL_365_LIVE_MATCHES_KEY, JSON.stringify([liveRow(id)]));
  }

  async function refresh(id: number): Promise<number> {
    return sync365SyntheticLiveSnapshots({ language: 'en', gameIds: [id] });
  }

  function expectStillLive(id: number) {
    const list = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as Array<{
      fixture: { id: number; status: { short: string } };
    }>;
    expect(list.map((row) => row.fixture.id)).toEqual([id]);
    expect(list[0]?.fixture.status.short).toBe('2H');
    expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`)).toBe(false);
    expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX}${id}`)).toBe(false);
    expect(matchCacheService.upsertFixtures).not.toHaveBeenCalled();
  }

  it('keeps the last live row when game-by-id returns HTTP 404', async () => {
    const id = 4_751_201;
    seedLive(id);
    scripts.set(id, { kind: 'http', status: 404, body: {} });

    await expect(refresh(id)).resolves.toBe(0);

    expectStillLive(id);
    await expect(isTerminalLatched(id)).resolves.toBe(false);
    await expect(readLiveFixtureById(id)).resolves.toMatchObject({
      fixture: { id, status: { short: '2H' } },
    });
  });

  it('keeps the last live row when game-by-id returns HTTP 200 with an empty game', async () => {
    const id = 4_751_202;
    seedLive(id);
    scripts.set(id, { kind: 'http', status: 200, body: { game: null } });

    await expect(refresh(id)).resolves.toBe(0);

    expectStillLive(id);
    await expect(isTerminalLatched(id)).resolves.toBe(false);
  });

  it('keeps the last live row when game-by-id returns malformed or inconclusive data', async () => {
    const malformedId = 4_751_203;
    const inconclusiveId = 4_751_209;
    seedLive(malformedId);
    scripts.set(malformedId, { kind: 'http', status: 200, badJson: true });

    await expect(refresh(malformedId)).resolves.toBe(0);
    expectStillLive(malformedId);

    redis.values.set(FOOTBALL_365_LIVE_MATCHES_KEY, JSON.stringify([liveRow(inconclusiveId)]));
    scripts.set(inconclusiveId, { kind: 'http', status: 500, body: { error: 'upstream' } });

    await expect(refresh(inconclusiveId)).resolves.toBe(0);
    expectStillLive(inconclusiveId);
    await expect(isTerminalLatched(malformedId)).resolves.toBe(false);
    await expect(isTerminalLatched(inconclusiveId)).resolves.toBe(false);
  });

  it('does not produce FT when the game-by-id request fails on the network', async () => {
    const id = 4_751_204;
    seedLive(id);
    scripts.set(id, { kind: 'throw', message: 'network down' });

    await expect(refresh(id)).resolves.toBe(0);

    expectStillLive(id);
    await expect(isTerminalLatched(id)).resolves.toBe(false);
  });

  it('still finalizes an explicit finished game payload immediately', async () => {
    const id = 4_751_205;
    seedLive(id);
    scripts.set(id, { kind: 'http', status: 200, body: { game: finishedGame(id) } });

    await expect(refresh(id)).resolves.toBe(1);

    const tomb = redis.values.get(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`);
    expect(tomb).toBeTruthy();
    expect(JSON.parse(tomb!).fixture.status.short).toBe('FT');
    expect(JSON.parse(tomb!)._authoritativeTerminal).toBeUndefined();
    expect(redis.ttls.get(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`)).toBe(600);
    const list = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as Array<{
      fixture: { id: number };
    }>;
    expect(list.map((row) => row.fixture.id)).not.toContain(id);
    await expect(isTerminalLatched(id)).resolves.toBe(true);
    expect(redis.ttls.get(`${FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX}${id}`)).toBe(24 * 60 * 60);
  });

  it('still writes a 24-hour authoritative FT when details confirm the finish', async () => {
    const id = 4_751_210;
    seedLive(id);
    const finished = {
      ...liveRow(id),
      fixture: { id, status: { short: 'FT', long: 'Match Finished', elapsed: 90, extra: null } },
      goals: { home: 2, away: 1 },
    };

    await writeTerminalFixtureSnapshot(finished as never, '365', { authoritative: true });

    const tomb = redis.values.get(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`);
    expect(JSON.parse(tomb!)._authoritativeTerminal).toBe(true);
    expect(JSON.parse(tomb!).fixture.status.short).toBe('FT');
    expect(redis.ttls.get(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`)).toBe(24 * 60 * 60);
    await expect(isTerminalLatched(id)).resolves.toBe(true);
    await expect(readLiveFixturesList()).resolves.toEqual([]);
  });

  it('applies a later valid live payload after an inconclusive refresh', async () => {
    const id = 4_751_206;
    seedLive(id);
    scripts.set(id, { kind: 'http', status: 404, body: {} });
    await expect(refresh(id)).resolves.toBe(0);
    expectStillLive(id);

    scripts.set(id, { kind: 'http', status: 200, body: { game: liveGame(id, 88, '2nd Half') } });
    await expect(refresh(id)).resolves.toBe(1);

    const list = JSON.parse(redis.values.get(FOOTBALL_365_LIVE_MATCHES_KEY) ?? '[]') as Array<{
      fixture: { id: number; status: { short: string; elapsed: number } };
      goals: { home: number; away: number };
    }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.fixture.status.short).toBe('2H');
    expect(list[0]?.fixture.status.elapsed).toBe(88);
    expect(list[0]?.goals).toEqual({ home: 1, away: 0 });
    expect(redis.values.has(`${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`)).toBe(false);
    await expect(isTerminalLatched(id)).resolves.toBe(false);
  });

  it('does not let an older live game payload overwrite an authoritative tombstone', async () => {
    const id = 4_751_207;
    const tombKey = `${FOOTBALL_FIXTURE_TERMINAL_KEY_PREFIX}${id}`;
    const latchKey = `${FOOTBALL_FIXTURE_TERMINAL_LATCHED_KEY_PREFIX}${id}`;
    const tomb = JSON.stringify({
      ...liveRow(id),
      fixture: { id, status: { short: 'FT', long: 'Match Finished', elapsed: 90, extra: null } },
      goals: { home: 2, away: 1 },
      _authoritativeTerminal: true,
    });
    redis.values.set(tombKey, tomb);
    redis.values.set(latchKey, '1');
    redis.ttls.set(latchKey, 24 * 60 * 60);
    seedLive(id);
    scripts.set(id, { kind: 'http', status: 200, body: { game: liveGame(id, 12, '1st Half') } });

    await expect(refresh(id)).resolves.toBe(1);

    expect(redis.values.get(tombKey)).toBe(tomb);
    expect(redis.values.get(latchKey)).toBe('1');
    await expect(isTerminalLatched(id)).resolves.toBe(true);
    await expect(readLiveFixtureById(id)).resolves.toMatchObject({
      fixture: { id, status: { short: 'FT' } },
    });
    await expect(readLiveFixturesList()).resolves.toEqual([]);
  });

  it('does nothing to the live row when the synthetic refresher is disabled', async () => {
    const id = 4_751_208;
    seedLive(id);
    process.env.SCORES365_EXPERIMENT_ENABLED = 'false';
    scripts.set(id, { kind: 'http', status: 404, body: {} });

    await expect(refresh(id)).resolves.toBe(0);

    expect(global.fetch).not.toHaveBeenCalled();
    expectStillLive(id);
    expect(mockedPrisma.cachedFixture.findMany).not.toHaveBeenCalled();
  });
});
