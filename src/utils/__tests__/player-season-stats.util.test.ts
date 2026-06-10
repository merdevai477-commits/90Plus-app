import {
  aggregateSeasonStats,
  isSeasonMeaningful,
  isUclSeasonMeaningful,
  selectBestSeasonStats,
  selectBestUclSeasonStats,
} from '../player-season-stats.util';

function makeRow(appearances: number, minutes: number, leagueId = 39) {
  return {
    player: { name: 'Test Player' },
    statistics: [
      {
        league: { id: leagueId, name: 'Test League' },
        team: { name: 'Test FC' },
        games: { appearances, minutes },
        goals: { total: 0, assists: 0 },
        cards: { yellow: 0, red: 0 },
      },
    ],
  };
}

describe('player season stats util', () => {
  test('aggregateSeasonStats sums across competitions', () => {
    const row = {
      statistics: [
        { league: { id: 39 }, games: { appearances: 2, minutes: 90 } },
        { league: { id: 2 }, games: { appearances: 1, minutes: 44 } },
      ],
    };
    expect(aggregateSeasonStats(row)).toEqual({ appearances: 3, minutes: 134 });
  });

  test('isSeasonMeaningful accepts 3+ apps or 180+ minutes', () => {
    expect(isSeasonMeaningful(makeRow(3, 10))).toBe(true);
    expect(isSeasonMeaningful(makeRow(1, 180))).toBe(true);
    expect(isSeasonMeaningful(makeRow(1, 44))).toBe(false);
  });

  test('selectBestSeasonStats prefers meaningful current season', async () => {
    const current = makeRow(51, 3000);
    const fetch = jest.fn(async (year: number) => (year === 2026 ? current : null));

    const result = await selectBestSeasonStats(fetch, 2026);
    expect(result?.seasonYear).toBe(2026);
    expect(result?.status).toBe('current_in_progress');
  });

  test('selectBestSeasonStats falls back to previous completed season', async () => {
    const thinCurrent = makeRow(1, 44);
    const fullPrevious = makeRow(19, 2000);
    const fetch = jest.fn(async (year: number) => {
      if (year === 2026) return thinCurrent;
      if (year === 2025) return fullPrevious;
      return null;
    });

    const result = await selectBestSeasonStats(fetch, 2026);
    expect(result?.seasonYear).toBe(2025);
    expect(result?.status).toBe('latest_completed');
  });

  test('selectBestSeasonStats returns thin current when both thin', async () => {
    const thin = makeRow(1, 20);
    const fetch = jest.fn(async (year: number) => (year === 2026 ? thin : null));

    const result = await selectBestSeasonStats(fetch, 2026);
    expect(result?.seasonYear).toBe(2026);
    expect(result?.status).toBe('current_in_progress');
  });

  test('isUclSeasonMeaningful only counts UCL league', () => {
    const row = {
      statistics: [
        { league: { id: 39 }, games: { appearances: 20, minutes: 1500 } },
        { league: { id: 2 }, games: { appearances: 2, minutes: 120 } },
      ],
    };
    expect(isUclSeasonMeaningful(row)).toBe(false);
    expect(isUclSeasonMeaningful(makeRow(12, 900, 2))).toBe(true);
  });

  test('selectBestUclSeasonStats falls back to previous UCL season', async () => {
    const thinUcl = { league: { id: 2 }, games: { appearances: 2, minutes: 120 } };
    const fullUcl = { league: { id: 2 }, games: { appearances: 12, minutes: 900 } };
    const fetch = jest.fn(async (year: number) => {
      if (year === 2026) return thinUcl;
      if (year === 2025) return fullUcl;
      return null;
    });

    const result = await selectBestUclSeasonStats(fetch, 2026);
    expect(result?.seasonYear).toBe(2025);
    expect(result?.status).toBe('latest_completed');
  });
});
