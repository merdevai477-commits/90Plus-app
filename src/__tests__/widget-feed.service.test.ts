jest.mock('../services/football-data-cache.service', () => ({
  footballDataCacheService: {
    getCached365CompetitorMatches: jest.fn(),
    getMatchLineups: jest.fn(),
    getMatchMomentum: jest.fn(),
    getMatchStatistics: jest.fn(),
    getMatchEvents: jest.fn(),
    getFixtureDetailsBundle: jest.fn(async () => null),
    getCached365FixtureForm: jest.fn(async () => ({ data: null })),
    getStandingsParsed: jest.fn(async () => ({ flat: [], groups: [] })),
  },
}));

jest.mock('../services/stadium-image.service', () => ({
  resolveVenueImage: jest.fn(async () => ({ imageUrl: null, isPlaceholder: true })),
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
  clearFeaturedMemory,
  clearMatchInfoCache,
  compressMomentum,
  keepLastFeatured,
  parseWidgetTeamIds,
  pickForm,
  pickHeadToHead,
  pickKeyEvents,
  pickNearestFixture,
  pickRecentGoal,
  toWidgetMatch,
  widgetImageUrl,
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
const eventsMock = footballDataCacheService.getMatchEvents as jest.Mock;
const liveMock = readLiveFixtureById as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearFeaturedMemory();
  clearMatchInfoCache();
  liveMock.mockResolvedValue(null);
  eventsMock.mockResolvedValue([]);
  lineupsMock.mockResolvedValue([]);
  statsMock.mockResolvedValue([]);
  momentumMock.mockResolvedValue({ available: false, duration: 90, series: [], markers: [] });
});

describe('keepLastFeatured', () => {
  const full = {
    fixtureId: 9,
    topPlayers: [{ id: 1, name: 'A', photo: null, rating: 8, side: 'home' as const }],
    momentum: [{ minute: 10, home: 60, away: 40 }],
    lineup: null,
    stats: null,
    events: [{ minute: 10, extra: null, kind: 'goal' as const, side: 'home' as const, player: 'A' }],
    goal: null,
    info: null,
  };
  const empty = { ...full, topPlayers: [], momentum: [], events: [] };

  it('fills sections that went empty from the last good build of the same match and language', () => {
    keepLastFeatured(full, 'en', 1_000);
    expect(keepLastFeatured(empty, 'en', 2_000)).toEqual(full);
    expect(keepLastFeatured(empty, 'ar', 2_000)).toEqual(empty);
  });

  it('forgets a build older than four hours', () => {
    keepLastFeatured(full, 'en', 0);
    expect(keepLastFeatured(empty, 'en', 4 * 60 * 60 * 1000 + 1)).toEqual(empty);
  });
});

describe('match info pickers', () => {
  const match = () => toWidgetMatch(fixture(500, [10, 'Ahly'], [20, 'Zamalek'], 'NS', NOW_SEC + 3600));
  const game = (id: number, daysAgo: number, home: number, away: number, hs: number, as: number) => ({
    id,
    startTime: new Date(NOW - daysAgo * 86_400_000).toISOString(),
    homeCompetitor: { id: home, score: hs },
    awayCompetitor: { id: away, score: as },
  });

  it('builds last-five form oldest first and skips this fixture and unplayed games', () => {
    const games = [
      game(500, 0, 10, 20, -1, -1),
      game(1, 1, 10, 30, 2, 0),
      game(2, 8, 40, 10, 1, 1),
      game(3, 15, 10, 50, 0, 3),
      game(4, 22, 60, 10, 0, 1),
      game(5, 29, 10, 70, 4, 4),
      game(6, 36, 10, 80, 9, 0),
    ];
    expect(pickForm(games, 10, match())).toEqual(['D', 'W', 'L', 'D', 'W']);
  });

  it('orients head-to-head goals to today\'s home side', () => {
    const h2h = pickHeadToHead([game(1, 30, 20, 10, 2, 1), game(2, 90, 10, 20, 3, 0), game(3, 120, 10, 99, 1, 0)], match());
    expect(h2h).toEqual({
      homeWins: 1,
      draws: 0,
      awayWins: 1,
      meetings: [
        { ts: Math.floor((NOW - 30 * 86_400_000) / 1000), homeGoals: 1, awayGoals: 2 },
        { ts: Math.floor((NOW - 90 * 86_400_000) / 1000), homeGoals: 3, awayGoals: 0 },
      ],
    });
  });

  it('asks Wikipedia for a card-sized thumbnail', () => {
    expect(widgetImageUrl('https://x.org/thumb/1/1c/A.jpg/3840px-A.jpg?utm=1')).toBe('https://x.org/thumb/1/1c/A.jpg/960px-A.jpg?utm=1');
    expect(widgetImageUrl(null)).toBeNull();
  });
});

describe('pickRecentGoal', () => {
  const live = (elapsed: number) => {
    const f = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '2H', NOW_SEC - 4000, [1, 0]);
    f.fixture.status.elapsed = elapsed;
    return toWidgetMatch(f);
  };
  const events = [
    { time: { elapsed: 12, extra: null }, team: { id: 20 }, player: { id: 5, name: 'Early' }, type: 'Card', detail: 'Yellow Card' },
    { time: { elapsed: 50, extra: null }, team: { id: 10 }, player: { id: 77, name: 'Scorer' }, type: 'Goal', detail: 'Normal Goal' },
  ];
  const lineups = [{ team: { id: 10 }, startXI: [{ player: { id: 9001, scores365MemberId: 77, name: 'Scorer', photo: 'p.png' } }] }];

  it('leads with a fresh goal and finds the scorer photo through the lineup member id', () => {
    expect(pickRecentGoal(events, lineups, live(52))).toEqual({
      minute: 50,
      extra: null,
      kind: 'goal',
      side: 'home',
      player: 'Scorer',
      photo: 'p.png',
    });
  });

  it('drops the goal once a few match minutes have passed', () => {
    expect(pickRecentGoal(events, lineups, live(55))).toBeNull();
  });
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

  it('puts a live followed-team match ahead of an upcoming favorite', async () => {
    const live = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '1H', NOW_SEC - 1800, [1, 0]);
    const favorite = fixture(200, [30, 'Barcelona'], [40, 'Sevilla'], 'NS', NOW_SEC + 86400);
    matchesMock.mockImplementation(async (id: number) => ({
      data:
        id === 30
          ? { live: [], upcoming: [favorite], finished: [] }
          : { live: [live], upcoming: [], finished: [] },
    }));

    const feed = await buildWidgetFeed([10, 30], 'en', NOW, [200]);

    expect(feed.primaryReason).toBe('live');
    expect(feed.primary).toMatchObject({ fixtureId: 100, status: 'live' });
    expect(feed.featured?.fixtureId).toBe(100);
    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([200]);
  });

  it('keeps a live favorite ahead of another live followed-team match', async () => {
    const followedLive = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '1H', NOW_SEC - 3000, [1, 0]);
    const favoriteLive = fixture(200, [30, 'Barcelona'], [40, 'Sevilla'], '2H', NOW_SEC - 1200, [0, 0]);
    matchesMock.mockImplementation(async (id: number) => ({
      data: { live: [id === 30 ? favoriteLive : followedLive], upcoming: [], finished: [] },
    }));

    const feed = await buildWidgetFeed([10, 30], 'en', NOW, [200]);

    expect(feed.primaryReason).toBe('favorite');
    expect(feed.primary?.fixtureId).toBe(200);
    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([100]);
  });

  it('lists goals and red cards, filling spare rows with yellow cards', async () => {
    const live = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '2H', NOW_SEC - 4000, [2, 1]);
    matchesMock.mockResolvedValue({ data: { live: [live], upcoming: [], finished: [] } });
    const ev = (minute: number, teamId: number, type: string, detail: string, name: string) => ({
      time: { elapsed: minute, extra: null },
      team: { id: teamId },
      player: { name },
      type,
      detail,
    });
    eventsMock.mockResolvedValue([
      ev(5, 20, 'Card', 'Yellow Card', 'Y1'),
      ev(12, 10, 'Goal', 'Normal Goal', 'Scorer'),
      ev(30, 20, 'Goal', 'Penalty', 'Pen'),
      ev(33, 10, 'Goal', 'Missed Penalty', 'Miss'),
      ev(40, 10, 'subst', 'Substitution 1', 'Sub'),
      ev(55, 20, 'Card', 'Red Card', 'Off'),
      ev(60, 10, 'Card', 'Yellow Card', 'Y2'),
      ev(70, 10, 'Goal', 'Own Goal', 'OG'),
      ev(80, 20, 'Card', 'Yellow Card', 'Y3'),
    ]);

    const feed = await buildWidgetFeed([10], 'en', NOW);

    expect(feed.featured?.events.map((e) => [e.minute, e.kind, e.side, e.player])).toEqual([
      [5, 'yellow', 'away', 'Y1'],
      [12, 'goal', 'home', 'Scorer'],
      [30, 'penalty', 'away', 'Pen'],
      [55, 'red', 'away', 'Off'],
      [60, 'yellow', 'home', 'Y2'],
      [70, 'own_goal', 'home', 'OG'],
      [80, 'yellow', 'away', 'Y3'],
    ]);

    const tight = pickKeyEvents(await eventsMock(), feed.primary!, 5);
    expect(tight.map((e) => [e.minute, e.kind])).toEqual([
      [12, 'goal'],
      [30, 'penalty'],
      [55, 'red'],
      [70, 'own_goal'],
      [80, 'yellow'],
    ]);
  });

  it('previews an upcoming primary with venue, referee, table, form and head-to-head', async () => {
    const next = fixture(400, [10, 'Ahly'], [20, 'Zamalek'], 'NS', NOW_SEC + 7200);
    matchesMock.mockResolvedValue({ data: { live: [], upcoming: [next], finished: [] } });
    (footballDataCacheService.getFixtureDetailsBundle as jest.Mock).mockResolvedValue({
      fixture: { fixture: { referee: 'M. Guida' }, league: { season: 2026 } },
      venue: { id: 0, name: 'T&#252;rk Telekom Arena', city: null, image: 'https://x.org/a/3840px-A.jpg' },
    });
    (footballDataCacheService.getStandingsParsed as jest.Mock).mockResolvedValue({
      flat: [
        { rank: 1, team: { id: 10 }, points: 30, all: { played: 12 } },
        { rank: 4, team: { id: 20 }, points: 22, all: { played: 12 } },
      ],
      groups: [],
    });
    const played = (daysAgo: number, hs: number, as: number) => ({
      id: 9000 + daysAgo,
      startTime: new Date(NOW - daysAgo * 86_400_000).toISOString(),
      homeCompetitor: { id: 10, score: hs },
      awayCompetitor: { id: 20, score: as },
    });
    (footballDataCacheService.getCached365FixtureForm as jest.Mock).mockResolvedValue({
      data: { home: { recentGames: [played(7, 2, 0)] }, away: { recentGames: [played(7, 2, 0)] }, meetings: [played(7, 2, 0)] },
    });

    const feed = await buildWidgetFeed([10], 'en', NOW, [400]);

    expect(feed.featured?.info).toEqual({
      venue: 'Türk Telekom Arena',
      city: null,
      venueImage: 'https://x.org/a/960px-A.jpg',
      referee: 'M. Guida',
      home: { rank: 1, points: 30, played: 12, form: ['W'] },
      away: { rank: 4, points: 22, played: 12, form: ['L'] },
      h2h: { homeWins: 1, draws: 0, awayWins: 0, meetings: [{ ts: Math.floor((NOW - 7 * 86_400_000) / 1000), homeGoals: 2, awayGoals: 0 }] },
    });
    expect(feed.featured?.events).toEqual([]);
  });

  it('drops an unresolvable favorite and falls back to the live followed match', async () => {
    const live = fixture(100, [10, 'Ahly'], [20, 'Zamalek'], '2H', NOW_SEC - 4000, [0, 0]);
    matchesMock.mockImplementation(async () => ({ data: { live: [live], upcoming: [], finished: [] } }));

    const feed = await buildWidgetFeed([10], 'en', NOW, [999999]);

    expect(feed.primaryReason).toBe('live');
    expect(feed.primary?.fixtureId).toBe(100);
  });

  it('gives each followed club one card and counts a shared fixture for both clubs', async () => {
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
    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([300]);
  });

  it('shows only the next match of a club that has several upcoming', async () => {
    const soon = fixture(400, [10, 'Ahly'], [50, 'Masry'], 'NS', NOW_SEC + 7200);
    const later = fixture(401, [10, 'Ahly'], [60, 'Pyramids'], 'NS', NOW_SEC + 3 * 86400);
    const other = fixture(402, [30, 'Barcelona'], [70, 'Sevilla'], 'NS', NOW_SEC + 86400);
    matchesMock.mockImplementation(async (id: number) => ({
      data: { live: [], upcoming: id === 10 ? [soon, later] : [other], finished: [] },
    }));

    const feed = await buildWidgetFeed([10, 30], 'en', NOW);

    expect(feed.fixtures.map((match) => match.fixtureId)).toEqual([400, 402]);
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
