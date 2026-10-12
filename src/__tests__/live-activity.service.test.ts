jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    liveActivityToken: {
      findMany: jest.fn(),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      update: jest.fn(async () => ({})),
      upsert: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../services/apns.service', () => ({
  isApnsConfigured: jest.fn(() => true),
  isDeadToken: jest.fn((r: { status: number; reason: string | null }) => r.status === 410 || r.reason === 'BadDeviceToken'),
  sendLiveActivityPush: jest.fn(async () => ({ status: 200, reason: null, sandbox: false })),
  closeApnsSessions: jest.fn(),
}));

jest.mock('../services/live-fixture-cache.service', () => ({
  readLiveFixtureById: jest.fn(async () => null),
}));

jest.mock('../services/football-data-cache.service', () => ({ footballDataCacheService: {} }));

jest.mock('../services/football-sync-leader.service', () => ({
  withSyncLeaderLease: jest.fn(async (_scope: string, work: () => Promise<unknown>) => ({
    acquired: true,
    result: await work(),
  })),
}));

jest.mock('../services/widget-feed.service', () => ({
  ...jest.requireActual('../services/widget-feed.service'),
  resolveTeamMatch: jest.fn(),
}));

import prisma from '../lib/prisma';
import { sendLiveActivityPush } from '../services/apns.service';
import { readLiveFixtureById } from '../services/live-fixture-cache.service';
import { resolveTeamMatch } from '../services/widget-feed.service';
import { activityState, runStartCycle, runUpdateCycle } from '../services/live-activity.service';

const NOW = Date.UTC(2026, 9, 12, 18, 0, 0);
const NOW_SEC = Math.floor(NOW / 1000);
const tokens = (prisma as any).liveActivityToken;
const send = sendLiveActivityPush as jest.Mock;

function liveFixture(short: string, goals: [number, number], elapsed = 60): any {
  return {
    fixture: { id: 77, date: new Date(NOW - 3600_000).toISOString(), timestamp: NOW_SEC - 3600, status: { short, elapsed } },
    league: { id: 1, name: 'League', logo: null },
    teams: { home: { id: 1, name: 'Home FC', logo: 'h.png' }, away: { id: 2, name: 'Away FC', logo: 'a.png' } },
    goals: { home: goals[0], away: goals[1] },
  };
}

function updateRow(overrides: Record<string, unknown> = {}): any {
  return {
    token: 'aa'.repeat(32),
    kind: 'update',
    deviceId: 'device-1',
    fixtureId: 77,
    teamIds: [],
    language: 'en',
    sandbox: null,
    startedFixtureIds: [],
    lastState: null,
    lastPushAt: null,
    createdAt: new Date(NOW - 60_000),
    updatedAt: new Date(NOW - 60_000),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('activityState', () => {
  it('anchors the running clock so the device can tick the minute itself', () => {
    const state = activityState(
      {
        fixtureId: 1, status: 'live', statusShort: '2H', kickoffTs: 0, elapsed: 60, extra: null,
        home: { id: 1, name: 'H', logo: null }, away: { id: 2, name: 'A', logo: null },
        score: { home: 1, away: 0 }, league: { id: 1, name: 'L', logo: null },
      },
      NOW_SEC,
    );
    expect(state).toEqual({ homeScore: 1, awayScore: 0, status: 'live', minute: 60, clockStart: NOW_SEC - 3600 });
  });
});

describe('runUpdateCycle', () => {
  it('pushes a goal with an alert at high priority', async () => {
    tokens.findMany.mockResolvedValueOnce([updateRow({ lastState: '0-0-live', lastPushAt: new Date(NOW - 30_000) })]);
    (readLiveFixtureById as jest.Mock).mockResolvedValueOnce(liveFixture('2H', [1, 0]));

    await runUpdateCycle(NOW);

    expect(send).toHaveBeenCalledTimes(1);
    const [, aps, options] = send.mock.calls[0];
    expect(aps.event).toBe('update');
    expect(aps['content-state']).toMatchObject({ homeScore: 1, awayScore: 0, status: 'live' });
    expect(aps.alert).toEqual({ title: 'Goal!', body: 'Home FC 1 - 0 Away FC' });
    expect(options.priority).toBe(10);
    expect(tokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastState: '1-0-live' }) }),
    );
  });

  it('stays quiet when nothing changed and the last push is recent', async () => {
    tokens.findMany.mockResolvedValueOnce([updateRow({ lastState: '1-0-live', lastPushAt: new Date(NOW - 30_000) })]);
    (readLiveFixtureById as jest.Mock).mockResolvedValueOnce(liveFixture('2H', [1, 0]));

    await runUpdateCycle(NOW);

    expect(send).not.toHaveBeenCalled();
  });

  it('ends the activity at full time and forgets the token', async () => {
    tokens.findMany.mockResolvedValueOnce([updateRow({ lastState: '2-1-live', lastPushAt: new Date(NOW - 30_000) })]);
    (readLiveFixtureById as jest.Mock).mockResolvedValueOnce(liveFixture('FT', [2, 1], 90));

    await runUpdateCycle(NOW);

    const [, aps] = send.mock.calls[0];
    expect(aps.event).toBe('end');
    expect(aps['dismissal-date']).toBeGreaterThan(NOW_SEC);
    expect(tokens.deleteMany).toHaveBeenCalledWith({ where: { token: 'aa'.repeat(32) } });
  });

  it('drops tokens Apple reports as dead', async () => {
    tokens.findMany.mockResolvedValueOnce([updateRow()]);
    (readLiveFixtureById as jest.Mock).mockResolvedValueOnce(liveFixture('1H', [0, 0], 10));
    send.mockResolvedValueOnce({ status: 410, reason: 'Unregistered', sandbox: false });

    await runUpdateCycle(NOW);

    expect(tokens.deleteMany).toHaveBeenCalledWith({ where: { token: 'aa'.repeat(32) } });
    expect(tokens.update).not.toHaveBeenCalled();
  });
});

describe('runStartCycle', () => {
  const liveTeam = {
    teamId: 1,
    name: 'Home FC',
    logo: 'h.png',
    match: {
      fixtureId: 77, status: 'live', statusShort: '1H', kickoffTs: NOW_SEC - 300, elapsed: 5, extra: null,
      home: { id: 1, name: 'Home FC', logo: 'h.png' }, away: { id: 2, name: 'Away FC', logo: 'a.png' },
      score: { home: 0, away: 0 }, league: { id: 1, name: 'League', logo: null },
    },
  };

  it('opens an activity once when a followed team kicks off', async () => {
    tokens.findMany
      .mockResolvedValueOnce([updateRow({ token: 'bb'.repeat(32), kind: 'start', fixtureId: null, teamIds: [1] })])
      .mockResolvedValueOnce([]);
    (resolveTeamMatch as jest.Mock).mockResolvedValue(liveTeam);

    await runStartCycle(NOW);

    expect(send).toHaveBeenCalledTimes(1);
    const [, aps] = send.mock.calls[0];
    expect(aps.event).toBe('start');
    expect(aps['attributes-type']).toBe('MatchActivityAttributes');
    expect(aps.attributes).toMatchObject({ fixtureId: 77, homeName: 'Home FC', awayName: 'Away FC' });
    expect(tokens.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ startedFixtureIds: [77] }) }),
    );
  });

  it('skips devices that already run an activity for that match', async () => {
    tokens.findMany
      .mockResolvedValueOnce([updateRow({ token: 'bb'.repeat(32), kind: 'start', fixtureId: null, teamIds: [1] })])
      .mockResolvedValueOnce([{ deviceId: 'device-1', fixtureId: 77 }]);
    (resolveTeamMatch as jest.Mock).mockResolvedValue(liveTeam);

    await runStartCycle(NOW);

    expect(send).not.toHaveBeenCalled();
  });
});
