jest.mock('../services/football-data-cache.service', () => ({
  footballDataCacheService: {
    getCached365CompetitorMatches: jest.fn(),
    getMatchLineups: jest.fn(),
    getMatchMomentum: jest.fn(),
    getMatchStatistics: jest.fn(),
  },
}));

jest.mock('../services/live-fixture-cache.service', () => ({
  readLiveFixtureById: jest.fn(async () => null),
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: { cachedFixture: { findUnique: jest.fn(async () => null) } },
}));

jest.mock('../services/match-cache.service', () => ({
  matchCacheService: { convertDbMatchToApiFormat: jest.fn(() => null) },
}));

import { footballDataCacheService } from '../services/football-data-cache.service';
import { readLiveFixtureById } from '../services/live-fixture-cache.service';
import {
  buildWidgetFeed,
  compressMomentum,
  parseWidgetTeamIds,
  pickNearestFixture,
} from '../services/widget-feed.service';

const NOW = Date.UTC(2026, 9, 12, 18, 0, 0);
const NOW_SEC = Math.floor(NOW / 1000);

function fixture(
  id: number,
  home: [number, string],
  away: [number, string],
  short: string,
  kickoffSec: number,
  goals: [number | null, number | null] = [null, null],
): any {
  return {
    fixture: {
      id,
      date: new Date(kickoffSec * 1000).toISOString(),
      timestamp: kickoffSec,
      status: { short, long: short, elapsed: short === 'NS' ? null : 35 },
    },
    league: { id: 1, name: 'League', logo: 'l.png' },
    teams: {
      home: { id: home[0], name: home[1], logo: `${home[0]}.png` },
      away: { id: away[0], name: away[1], logo: `${away[0]}.png` },
    },
    goals: { home: goals[0], away: goals[1] },
  };
}

const matchesMock = footballDataCacheService.getCached365CompetitorMatches as jest.Mock;
const lineupsMock = footballDataCacheService.getMatchLineups as jest.Mock;
const momentumMock = footballDataCacheService.getMatchMomentum as jest.Mock;
const statsMock = footballDataCacheService.getMatchStatistics as jest.Mock;
const liveMock = readLiveFixtureById as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  liveMock.mockResolvedValue(null);
  lineupsMock.mockResolvedValue([]);
  statsMock.mockResolvedValue([]);
  momentumMock.mockResolvedValue({ available: false, duration: 90, series: [], markers: [] });
});

describe('parseWidgetTeamIds', () => {
  it('keeps unique positive ids and caps the list', () => {
    expect(parseWidgetTeamIds('5, 7,5,abc,-1,0')).toEqual([5, 7]);
    expect(parseWidgetTeamIds('1,2,3,4,5,6,7,8,9,10')).toHaveLength(8);
    expect(parseWidgetTeamIds(undefined)).toEqual([]);
  });
});

describe('pickNearestFixture', () => {
  it('prefers live, then a recent finish, then the nearest upcoming match', () => {
    const live = fixture(1, [10, 'A'], [20, 'B'], '2H', NOW_SEC - 3600);
    const recentFt = fixture(2, [10, 'A'], [30, 'C'], 'FT', NOW_SEC - 2 * 3600);
    const oldFt = fixture(3, [10, 'A'], [40, 'D'], 'FT', NOW_SEC - 48 * 3600);
    const later = fixture(4, [10, 'A'], [50, 'E'], 'NS', NOW_SEC + 5 * 86400);
    const sooner = fixture(5, [10, 'A'], [60, 'F'], 'NS', NOW_SEC + 86400);

    expect(pickNearestFixture({ live: [live], upcoming: [later], finished: [] }, NOW_SEC)).toBe(live);
    expect(
      pickNearestFixture({ live: [], upcoming: [later, sooner], finished: [recentFt] }, NOW_SEC),
    ).toBe(recentFt);
    expect(
      pickNearestFixture({ live: [], upcoming: [later, sooner], finished: [oldFt] }, NOW_SEC),
    ).toBe(sooner);
  });
});

describe('compressMomentum', () => {
  it('averages the series into at most the requested buckets', () => {
    const series = Array.from({ length: 90 }, (_, i) => ({ minute: i + 1, home: 10, away: 30 }));
    const out = compressMomentum(series, 12);
    expect(out.length).toBeLessThanOrEqual(12);
    expect(out[0]).toEqual({ minute: 8, home: 10, away: 30 });
    expect(out[out.length - 1].minute).toBe(90);
  });
});

describe('buildWidgetFeed', () => {
  it('orders live first, dedupes shared fixtures, overlays live score and builds the featured card', async () => {
    const derby = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '1H', NOW_SEC - 1800, [0, 0]);
    const barca = fixture(200, [30, 'Barcelona'], [40, 'Sevilla'], 'NS', NOW_SEC + 86400);

    matchesMock.mockImplementation(async (id: number) => ({
      data:
        id === 30
          ? { live: [], upcoming: [barca], finished: [] }
          : { live: [derby], upcoming: [], finished: [] },
    }));
    liveMock.mockImplementation(async (id: number) =>
      id === 100
        ? { fixture: { id: 100, status: { short: 'HT', long: 'Halftime', elapsed: 45 } }, goals: { home: 2, away: 1 } }
        : null,
    );
    lineupsMock.mockResolvedValue([
      {
        team: { id: 10 },
        startXI: [
          { player: { id: 1, name: 'Home Star', rating: 8.4 } },
          { player: { id: 2, name: 'Home Ok', rating: 6.1 } },
        ],
        substitutes: [{ player: { id: 3, name: 'Bench', rating: null } }],
      },
      { team: { id: 20 }, startXI: [{ player: { id: 4, name: 'Away Star', rating: '7.9' } }], substitutes: [] },
    ]);
    momentumMock.mockResolvedValue({
      available: true,
      duration: 90,
      series: [{ minute: 1, home: 20, away: 10 }],
      markers: [],
    });

    const feed = await buildWidgetFeed([30, 10, 20], 'ar', NOW);

    expect(feed.hasLive).toBe(true);
    expect(feed.teams.map((t) => t.teamId)).toEqual([10, 30]);
    expect(feed.teams[0]).toMatchObject({ name: 'Ahly', logo: '10.png' });
    expect(feed.teams[0].match).toMatchObject({ status: 'ht', score: { home: 2, away: 1 }, elapsed: 45 });
    expect(feed.teams[1].match).toMatchObject({ status: 'upcoming', score: null });

    expect(feed.featured?.fixtureId).toBe(100);
    expect(feed.featured?.topPlayers.map((p) => [p.name, p.side])).toEqual([
      ['Home Star', 'home'],
      ['Away Star', 'away'],
      ['Home Ok', 'home'],
    ]);
    expect(feed.featured?.momentum).toEqual([{ minute: 1, home: 20, away: 10 }]);
    expect(feed.primary).toMatchObject({ fixtureId: 100, status: 'ht' });
    expect(feed.primaryReason).toBe('live');
    expect(feed.featured?.lineup).toBeNull();
    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([200]);
  });

  it('keeps a favorite match ahead of a live followed-team match', async () => {
    const live = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '1H', NOW_SEC - 1800, [1, 0]);
    const favorite = fixture(200, [30, 'Barcelona'], [40, 'Sevilla'], 'NS', NOW_SEC + 86400);
    matchesMock.mockImplementation(async (id: number) => ({
      data:
        id === 30
          ? { live: [], upcoming: [favorite], finished: [] }
          : { live: [live], upcoming: [], finished: [] },
    }));

    const feed = await buildWidgetFeed([10, 30], 'en', NOW, [200]);

    expect(feed.primaryReason).toBe('favorite');
    expect(feed.primary).toMatchObject({ fixtureId: 200, status: 'upcoming', score: null });
    expect(feed.featured).toBeNull();
    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([100]);
  });

  it('drops an unresolvable favorite and falls back to the live followed match', async () => {
    const live = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '2H', NOW_SEC - 4000, [0, 0]);
    matchesMock.mockImplementation(async () => ({ data: { live: [live], upcoming: [], finished: [] } }));

    const feed = await buildWidgetFeed([10], 'en', NOW, [999999]);

    expect(feed.primaryReason).toBe('live');
    expect(feed.primary?.fixtureId).toBe(100);
  });

  it('lists one fixture when two followed teams share it', async () => {
    const shared = fixture(300, [10, 'Ahly'], [20, 'Zamalek'], 'NS', NOW_SEC + 7200);
    const later = fixture(301, [10, 'Ahly'], [40, 'Pyramids'], 'NS', NOW_SEC + 86400);
    matchesMock.mockImplementation(async (id: number) => ({
      data: {
        live: [],
        upcoming: id === 10 ? [shared, later] : [shared],
        finished: [],
      },
    }));

    const feed = await buildWidgetFeed([10, 20], 'en', NOW);

    expect(feed.primary).toBeNull();
    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([300, 301]);
  });

  it('drops a long-postponed fixture so the next kickoff stays first', async () => {
    const postponed = fixture(1, [10, 'Ahly'], [20, 'Ismaily'], 'PST', NOW_SEC - 200 * 86400);
    const next = fixture(2, [30, 'Galatasaray'], [40, 'Barcelona'], 'NS', NOW_SEC + 86400);
    matchesMock.mockImplementation(async (id: number) => ({
      data: {
        live: [],
        upcoming: id === 10 ? [postponed] : [next],
        finished: [],
      },
    }));

    const feed = await buildWidgetFeed([10, 30], 'en', NOW);

    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([2]);
  });

  it('omits an unconfirmed short lineup and keeps a confirmed one with real stats', async () => {
    const live = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '1H', NOW_SEC - 1800, [0, 0]);
    matchesMock.mockResolvedValue({ data: { live: [live], upcoming: [], finished: [] } });
    const starter = (id: number, name: string) => ({ player: { id, name, grid: '2:1', pos: 'M' } });
    lineupsMock.mockResolvedValue([
      {
        team: { id: 10 },
        formation: '4-3-3',
        _lineupsConfirmed: true,
        startXI: Array.from({ length: 11 }, (_, i) => starter(i + 1, `H${i}`)),
        substitutes: [],
      },
      {
        team: { id: 20 },
        formation: '4-4-2',
        _lineupsConfirmed: true,
        startXI: Array.from({ length: 11 }, (_, i) => starter(i + 20, `A${i}`)),
        substitutes: [],
      },
    ]);
    statsMock.mockResolvedValue([
      {
        team: { id: 10 },
        statistics: [
          { type: 'Ball Possession', value: '61%' },
          { type: 'Total Shots', value: 8 },
          { type: 'Shots on Goal', value: 3 },
        ],
      },
      {
        team: { id: 20 },
        statistics: [
          { type: 'Ball Possession', value: '39%' },
          { type: 'Total Shots', value: 4 },
          { type: 'Shots on Goal', value: 1 },
        ],
      },
    ]);

    const feed = await buildWidgetFeed([10], 'en', NOW);

    expect(feed.featured?.lineup).toMatchObject({ homeFormation: '4-3-3', awayFormation: '4-4-2' });
    expect(feed.featured?.lineup?.home).toHaveLength(11);
    expect(feed.featured?.lineup?.home[0].rating).toBeNull();
    expect(feed.featured?.stats).toMatchObject({
      possession: { home: 61, away: 39 },
      shots: { home: 8, away: 4 },
      shotsOn: { home: 3, away: 1 },
      corners: null,
      xg: null,
    });
  });

  it('keeps a team row with no match when the upstream call fails', async () => {
    matchesMock.mockRejectedValue(new Error('upstream down'));
    const feed = await buildWidgetFeed([99], 'en', NOW);
    expect(feed).toMatchObject({ hasLive: false, featured: null });
    expect(feed.teams).toEqual([{ teamId: 99, name: '', logo: null, match: null }]);
  });
});
