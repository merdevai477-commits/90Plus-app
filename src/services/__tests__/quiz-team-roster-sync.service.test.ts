/**
 * Roster sync is the only thing that puts football players into the database,
 * and the quiz's AI generation refuses to author a round without them. These
 * tests pin the behaviours that let the pool silently stay at zero: an empty
 * squad and a quota-blocked squad looking identical, a TTL that was written but
 * never read, and duplicate/transferred players corrupting the entity dataset.
 */

import type { RosterSyncResult } from '../quiz-team-roster-sync.service';

// ---------------------------------------------------------------------------
// In-memory Prisma double
// ---------------------------------------------------------------------------

interface TeamInfoRow {
  id: number;
  apiTeamId: number;
  teamName: string;
  season: number;
  lastFetched: Date;
  expiresAt: Date;
}
interface TeamPlayerRow {
  id: number;
  teamInfoId: number;
  apiPlayerId: number;
  playerName: string;
  position: string;
  jerseyNumber: number | null;
}
interface PlayerInfoRow {
  id: string;
  playerName: string;
  apiPlayerId: number | null;
  teamId: number | null;
  answer: string;
}

const db = {
  teamInfo: [] as TeamInfoRow[],
  teamPlayer: [] as TeamPlayerRow[],
  playerInfo: [] as PlayerInfoRow[],
  cachedTeam: [] as Array<{ teamId: number; name: string; logo: string | null }>,
  refreshControl: [] as Array<{ key: string; value: string }>,
};
let teamInfoSeq = 1;
let teamPlayerSeq = 1;

function resetDb(): void {
  db.teamInfo = [];
  db.teamPlayer = [];
  db.playerInfo = [];
  db.cachedTeam = [];
  db.refreshControl = [];
  teamInfoSeq = 1;
  teamPlayerSeq = 1;
}

/** Minimal `{ in }` / `{ not }` / `NOT` filter support for the fields we query. */
function matchesScalar(value: unknown, filter: any): boolean {
  if (filter && typeof filter === 'object' && !(filter instanceof Date)) {
    if ('in' in filter) return (filter.in as unknown[]).includes(value);
    if ('not' in filter) return value !== filter.not;
  }
  return value === filter;
}

function teamPlayerMatches(row: TeamPlayerRow, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, filter]) =>
    matchesScalar((row as any)[key], filter),
  );
}

function teamInfoView(row: TeamInfoRow) {
  return {
    id: row.id,
    apiTeamId: row.apiTeamId,
    teamName: row.teamName,
    season: row.season,
    lastFetched: row.lastFetched,
    expiresAt: row.expiresAt,
    _count: { players: db.teamPlayer.filter((p) => p.teamInfoId === row.id).length },
  };
}

const prismaMock = {
  teamInfo: {
    findUnique: jest.fn(async ({ where }: any) => {
      const row = db.teamInfo.find((t) => t.apiTeamId === where.apiTeamId || t.id === where.id);
      return row ? teamInfoView(row) : null;
    }),
    create: jest.fn(async ({ data }: any) => {
      const row: TeamInfoRow = { id: teamInfoSeq++, ...data };
      db.teamInfo.push(row);
      return teamInfoView(row);
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = db.teamInfo.find((t) => t.id === where.id)!;
      Object.assign(row, data);
      return teamInfoView(row);
    }),
  },
  teamPlayer: {
    deleteMany: jest.fn(async ({ where }: any) => {
      const before = db.teamPlayer.length;
      db.teamPlayer = db.teamPlayer.filter((row) => !teamPlayerMatches(row, where));
      return { count: before - db.teamPlayer.length };
    }),
    createMany: jest.fn(async ({ data }: any) => {
      for (const d of data) db.teamPlayer.push({ id: teamPlayerSeq++, ...d });
      return { count: data.length };
    }),
  },
  playerInfo: {
    updateMany: jest.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const row of db.playerInfo) {
        if (!matchesScalar(row.apiPlayerId, where.apiPlayerId)) continue;
        if (where.NOT && row.teamId === where.NOT.teamId) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    }),
    create: jest.fn(),
    createMany: jest.fn(),
    upsert: jest.fn(),
  },
  cachedTeam: {
    findMany: jest.fn(async ({ take }: any) =>
      db.cachedTeam
        .filter((t) => t.logo !== null)
        .sort((a, b) => a.teamId - b.teamId)
        .slice(0, take)
        .map((t) => ({ teamId: t.teamId, name: t.name })),
    ),
  },
  refreshControl: {
    findUnique: jest.fn(async ({ where }: any) =>
      db.refreshControl.find((r) => r.key === where.key) ?? null,
    ),
    upsert: jest.fn(async ({ where, create, update }: any) => {
      const existing = db.refreshControl.find((r) => r.key === where.key);
      if (existing) existing.value = update.value;
      else db.refreshControl.push(create);
      return { key: where.key };
    }),
  },
  // The service passes an array of already-issued promises; awaiting them all
  // reproduces Prisma's sequential execution for this fake.
  $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

// ---------------------------------------------------------------------------
// football.service double
// ---------------------------------------------------------------------------

/** Squads keyed by apiTeamId, as the upstream API would answer. */
let squads: Record<number, any[] | null> = {};
/** Clubs whose squad is in the service's own 7-day cache (served without quota). */
let cachedSquadTeams = new Set<number>();
let quotaExhausted = false;
/** Set when the *response* to a call trips the breaker (last request of the day). */
let tripBreakerOnCall = false;
const getTeamSquad = jest.fn(async (teamId: number) => {
  if (tripBreakerOnCall) quotaExhausted = true;
  // fetchFromApi serves its cache first; only an uncached club is short-circuited
  // to `[]` once the breaker is open.
  const blocked = quotaExhausted && !cachedSquadTeams.has(teamId);
  const players = blocked ? null : squads[teamId];
  return players && players.length ? [{ players }] : [];
});

jest.mock('../football.service', () => ({
  isFootballQuotaExhausted: () => quotaExhausted,
  footballService: {
    getTeamSquad: (teamId: number) => getTeamSquad(teamId),
    // Faithful copy of the real wrapper's quota/empty discrimination.
    getTeamSquadResult: async (teamId: number) => {
      const rows = await getTeamSquad(teamId);
      const players = Array.isArray(rows?.[0]?.players) ? rows[0].players : [];
      if (players.length === 0 && quotaExhausted) return { status: 'unavailable', players: [] };
      return { status: 'success', players };
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  syncTeamRoster,
  syncQuizRostersFromCachedTeams,
} from '../quiz-team-roster-sync.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function squadOf(count: number, startId = 1000): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    name: `Player ${startId + i}`,
    position: 'Midfielder',
    number: i + 1,
  }));
}

beforeEach(() => {
  resetDb();
  squads = {};
  cachedSquadTeams = new Set();
  quotaExhausted = false;
  tripBreakerOnCall = false;
  jest.clearAllMocks();
});

describe('syncTeamRoster', () => {
  test('Case 1 — populates TeamPlayer from a squad when the database is empty', async () => {
    squads[40] = squadOf(3);

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toEqual({ status: 'synced', teamInfoId: 1, playersWritten: 3 });
    expect(db.teamPlayer).toHaveLength(3);
    expect(db.teamPlayer[0]).toMatchObject({
      teamInfoId: 1,
      apiPlayerId: 1000,
      playerName: 'Player 1000',
      position: 'Midfielder',
      jerseyNumber: 1,
    });
    // The 30-day clock starts only now that players actually landed.
    expect(db.teamInfo[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  test('Case 1b — no PlayerInfo rows are invented for squad players', async () => {
    squads[40] = squadOf(3);

    await syncTeamRoster(40, 'Liverpool');

    // PlayerInfo is the chat answer cache, not a player registry: fabricating
    // rows there would mean inventing question/answer content.
    expect(prismaMock.playerInfo.create).not.toHaveBeenCalled();
    expect(prismaMock.playerInfo.createMany).not.toHaveBeenCalled();
    expect(prismaMock.playerInfo.upsert).not.toHaveBeenCalled();
    expect(db.playerInfo).toHaveLength(0);
  });

  test('Case 2 — reruns are idempotent and never duplicate rows', async () => {
    squads[40] = squadOf(3);

    await syncTeamRoster(40, 'Liverpool');
    await syncTeamRoster(40, 'Liverpool', { force: true });

    expect(db.teamPlayer).toHaveLength(3);
    expect(db.teamInfo).toHaveLength(1);
  });

  test('Case 2b — a duplicated player in the API payload is stored once', async () => {
    squads[40] = [...squadOf(2), { id: 1000, name: 'Player 1000', position: 'Midfielder' }];

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toMatchObject({ status: 'synced', playersWritten: 2 });
    expect(db.teamPlayer.map((p) => p.apiPlayerId).sort()).toEqual([1000, 1001]);
  });

  test('Case 2c — an existing PlayerInfo row is relinked, not recreated', async () => {
    db.playerInfo.push({
      id: 'pi-1',
      playerName: 'Player 1000',
      apiPlayerId: 1000,
      teamId: null,
      answer: 'cached answer',
    });
    squads[40] = squadOf(2);

    await syncTeamRoster(40, 'Liverpool');

    expect(db.playerInfo).toHaveLength(1);
    expect(db.playerInfo[0]!.teamId).toBe(1);
    // The cached answer must survive the back-link untouched.
    expect(db.playerInfo[0]!.answer).toBe('cached answer');
  });

  test('Case 3 — a transferred player moves clubs instead of appearing twice', async () => {
    squads[40] = squadOf(2, 1000);
    await syncTeamRoster(40, 'Liverpool');

    // Player 1000 now shows up in Arsenal's squad.
    squads[42] = [{ id: 1000, name: 'Player 1000', position: 'Midfielder', number: 9 }];
    await syncTeamRoster(42, 'Arsenal');

    const rowsFor1000 = db.teamPlayer.filter((p) => p.apiPlayerId === 1000);
    expect(rowsFor1000).toHaveLength(1);
    expect(rowsFor1000[0]!.teamInfoId).toBe(db.teamInfo.find((t) => t.apiTeamId === 42)!.id);
    // Liverpool keeps the player who did not move.
    expect(db.teamPlayer.filter((p) => p.apiPlayerId === 1001)).toHaveLength(1);
  });

  test('Case 4 — quota exhausted reports unavailable and writes nothing', async () => {
    quotaExhausted = true;
    squads[40] = squadOf(3);

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toEqual<RosterSyncResult>({ status: 'unavailable' });
    expect(db.teamPlayer).toHaveLength(0);
    // The placeholder TeamInfo stays expired so it is retried, not cached for 30 days.
    expect(db.teamInfo[0]!.expiresAt.getTime()).toBeLessThan(Date.now());
  });

  test('Case 4c — a squad already in the local cache still syncs while quota is out', async () => {
    quotaExhausted = true;
    squads[40] = squadOf(3);
    cachedSquadTeams.add(40);

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toMatchObject({ status: 'synced', playersWritten: 3 });
    expect(db.teamPlayer).toHaveLength(3);
  });

  test('Case 4b — a call that trips the breaker is unavailable, not an empty squad', async () => {
    tripBreakerOnCall = true;
    squads[40] = [];

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toEqual<RosterSyncResult>({ status: 'unavailable' });
  });

  test('Case 5 — a genuinely empty squad is reported as empty, not quota-blocked', async () => {
    squads[40] = [];

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toEqual({ status: 'empty', teamInfoId: 1 });
    expect(getTeamSquad).toHaveBeenCalledWith(40);
  });

  test('Case 5b — an empty squad does not wipe a previously good snapshot', async () => {
    squads[40] = squadOf(3);
    await syncTeamRoster(40, 'Liverpool');

    squads[40] = [];
    const result = await syncTeamRoster(40, 'Liverpool', { force: true });

    expect(result).toMatchObject({ status: 'empty' });
    expect(db.teamPlayer).toHaveLength(3);
  });

  test('Case 6 — a roster inside the 30-day TTL makes no API call', async () => {
    squads[40] = squadOf(3);
    await syncTeamRoster(40, 'Liverpool');
    getTeamSquad.mockClear();

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toEqual({ status: 'fresh', teamInfoId: 1 });
    expect(getTeamSquad).not.toHaveBeenCalled();
  });

  test('Case 6b — force refresh overrides a fresh TTL', async () => {
    squads[40] = squadOf(3);
    await syncTeamRoster(40, 'Liverpool');
    getTeamSquad.mockClear();

    const result = await syncTeamRoster(40, 'Liverpool', { force: true });

    expect(result).toMatchObject({ status: 'synced' });
    expect(getTeamSquad).toHaveBeenCalledTimes(1);
  });

  test('Case 6c — an unexpired TeamInfo with zero players is NOT treated as fresh', async () => {
    // This is the shape the old code produced: expiry stamped before the fetch,
    // so a quota-blocked club looked cached for 30 days while holding no players.
    db.teamInfo.push({
      id: teamInfoSeq++,
      apiTeamId: 40,
      teamName: 'Liverpool',
      season: 2025,
      lastFetched: new Date(),
      expiresAt: new Date(Date.now() + 29 * DAY),
    });
    squads[40] = squadOf(3);

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(result).toMatchObject({ status: 'synced', playersWritten: 3 });
  });

  test('Case 7 — an expired roster is refreshed from the API', async () => {
    squads[40] = squadOf(3);
    await syncTeamRoster(40, 'Liverpool');

    db.teamInfo[0]!.expiresAt = new Date(Date.now() - HOUR);
    squads[40] = squadOf(4, 2000);
    getTeamSquad.mockClear();

    const result = await syncTeamRoster(40, 'Liverpool');

    expect(getTeamSquad).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'synced', playersWritten: 4 });
    expect(db.teamPlayer.map((p) => p.apiPlayerId).sort()).toEqual([2000, 2001, 2002, 2003]);
  });
});

describe('syncQuizRostersFromCachedTeams', () => {
  beforeEach(() => {
    for (let i = 0; i < 3; i += 1) {
      db.cachedTeam.push({ teamId: 40 + i, name: `Club ${i}`, logo: 'logo.png' });
    }
  });

  test('syncs every cached club and reports the counts', async () => {
    squads[40] = squadOf(3, 1000);
    squads[41] = squadOf(3, 2000);
    squads[42] = squadOf(3, 3000);

    const summary = await syncQuizRostersFromCachedTeams(25);

    expect(summary).toEqual({ synced: 3, fresh: 0, empty: 0, total: 3, quotaBlocked: false });
    expect(db.teamPlayer).toHaveLength(9);
  });

  test('Case 4 — stops on mid-run quota exhaustion and reports quotaBlocked', async () => {
    squads[40] = squadOf(3, 1000);
    squads[41] = squadOf(3, 2000);
    squads[42] = squadOf(3, 3000);

    // The breaker opens on the response to the first club — its squad is real
    // data and must still be written; club 3's must not be requested.
    getTeamSquad.mockImplementationOnce(async (teamId: number) => {
      quotaExhausted = true;
      return [{ players: squads[teamId] ?? [] }];
    });

    const summary = await syncQuizRostersFromCachedTeams(25);

    expect(summary.quotaBlocked).toBe(true);
    expect(summary.synced).toBe(1);
    // Club 1 (real answer) + club 2 (short-circuited, revealing the block), then stop.
    expect(getTeamSquad).toHaveBeenCalledTimes(2);
    // Only real data was written.
    expect(db.teamPlayer).toHaveLength(3);
  });

  test('Case 4b — an already-open breaker stops the run at the first uncached club', async () => {
    quotaExhausted = true;
    squads[40] = squadOf(3, 1000);

    const summary = await syncQuizRostersFromCachedTeams(25);

    expect(summary).toMatchObject({ synced: 0, total: 3, quotaBlocked: true });
    expect(db.teamPlayer).toHaveLength(0);
  });

  test('Case 6 — a second run spends no quota while every roster is fresh', async () => {
    squads[40] = squadOf(3, 1000);
    squads[41] = squadOf(3, 2000);
    squads[42] = squadOf(3, 3000);

    await syncQuizRostersFromCachedTeams(25);
    getTeamSquad.mockClear();

    const summary = await syncQuizRostersFromCachedTeams(25);

    expect(summary).toMatchObject({ synced: 0, fresh: 3, quotaBlocked: false });
    expect(getTeamSquad).not.toHaveBeenCalled();
    expect(db.teamPlayer).toHaveLength(9);
  });
});
