import {
  buildRecentFormSide,
  pickLastFinishedGames,
  uniqueRecentGameIds,
} from '../recent-form-averages';
import type { Scores365TeamStatsPayload } from '../scores365-team-stats';

describe('recent-form-averages', () => {
  const games = [
    {
      id: 11,
      statusGroup: 4,
      homeCompetitor: { id: 1, score: 2 },
      awayCompetitor: { id: 9, score: 1 },
    },
    {
      id: 12,
      statusGroup: 4,
      homeCompetitor: { id: 8, score: 0 },
      awayCompetitor: { id: 1, score: 0 },
    },
    {
      id: 13,
      statusGroup: 4,
      homeCompetitor: { id: 1, score: 3 },
      awayCompetitor: { id: 7, score: 2 },
    },
    {
      id: 14,
      statusGroup: 4,
      homeCompetitor: { id: 6, score: 4 },
      awayCompetitor: { id: 1, score: 1 },
    },
    {
      id: 15,
      statusGroup: 2,
      homeCompetitor: { id: 1, score: undefined },
      awayCompetitor: { id: 5, score: undefined },
    },
  ];

  it('takes the last 4 finished games and skips scheduled ones', () => {
    const picked = pickLastFinishedGames(games, 4);
    expect(picked.map((g) => g.id)).toEqual([11, 12, 13, 14]);
  });

  it('averages goals and trends from scores only when stats are missing', () => {
    const side = buildRecentFormSide(games, 1, 'Home FC', new Map(), 4);
    expect(side.games).toBe(4);
    expect(side.averages.goalsFor).toBeCloseTo((2 + 0 + 3 + 1) / 4);
    expect(side.averages.goalsAgainst).toBeCloseTo((1 + 0 + 2 + 4) / 4);
    expect(side.averages.shots).toBeNull();
    expect(side.averages.xg).toBeNull();
    expect(side.trends.wins).toEqual({ count: 2, pct: 50 });
    expect(side.trends.btts).toEqual({ count: 3, pct: 75 });
    expect(side.trends.over25).toEqual({ count: 3, pct: 75 });
    expect(side.trends.winOrDraw).toEqual({ count: 3, pct: 75 });
    expect(side.trends.cleanSheets).toEqual({ count: 1, pct: 25 });
  });

  it('averages 365 team stats and uses opponent xG as xGA', () => {
    const payload = (homeId: number, awayId: number): Scores365TeamStatsPayload => ({
      statistics: [
        { id: 3, name: 'Total Shots', competitorId: homeId, value: 10 },
        { id: 3, name: 'Total Shots', competitorId: awayId, value: 6 },
        { id: 76, name: 'Expected Goals', competitorId: homeId, value: 1.6 },
        { id: 76, name: 'Expected Goals', competitorId: awayId, value: 0.8 },
        { id: 1, name: 'Yellow Cards', competitorId: homeId, value: 2 },
        { id: 1, name: 'Yellow Cards', competitorId: awayId, value: 1 },
      ],
    });
    const statsByGame = new Map<number, Scores365TeamStatsPayload | null>([
      [11, payload(1, 9)],
      [12, payload(8, 1)],
    ]);
    const side = buildRecentFormSide(games.slice(0, 2), 1, 'Home FC', statsByGame, 4);
    expect(side.averages.shots).toBeCloseTo((10 + 6) / 2);
    expect(side.averages.xg).toBeCloseTo((1.6 + 0.8) / 2);
    expect(side.averages.xga).toBeCloseTo((0.8 + 1.6) / 2);
    expect(side.averages.cards).toBeCloseTo((2 + 1) / 2);
  });

  it('dedupes overlapping recent game ids', () => {
    expect(uniqueRecentGameIds(games.slice(0, 2), [games[1], games[2]], 8)).toEqual([11, 12, 13]);
  });
});
