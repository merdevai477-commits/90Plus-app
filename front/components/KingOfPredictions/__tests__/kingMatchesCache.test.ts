jest.mock('../../../services/predictions.service', () => ({
  PredictionsService: {
    getKingMatches: jest.fn(),
  },
}));
jest.mock('../../Matches/leagueApiUtils', () => ({
  mapFixturesToMatches: (rows: { fixture?: { id?: number } }[]) =>
    rows.map((row) => ({ id: row.fixture?.id })),
}));
jest.mock('../../../data/leagues', () => ({ LEAGUES: [] }));

import { PredictionsService } from '../../../services/predictions.service';
import { clearKingMatchesCache, fetchKingMatches } from '../shared';

const getKingMatches = PredictionsService.getKingMatches as jest.Mock;

describe('king match cache', () => {
  beforeEach(() => {
    clearKingMatchesCache();
    getKingMatches.mockReset();
  });

  it('reuses a fresh day without another request', async () => {
    getKingMatches.mockResolvedValue({
      fixtures: [{ fixture: { id: 7 } }],
      calendar: null,
    });

    const first = await fetchKingMatches('2026-11-20');
    const second = await fetchKingMatches('2026-11-20');

    expect(second.matches).toEqual(first.matches);
    expect(getKingMatches).toHaveBeenCalledTimes(1);
  });

  it('shares one request while the first is still in flight', async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    getKingMatches.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = fetchKingMatches('2026-11-20');
    const second = fetchKingMatches('2026-11-20');
    resolveFetch({ fixtures: [{ fixture: { id: 7 } }], calendar: null });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { matches: [{ id: 7 }], calendar: null },
      { matches: [{ id: 7 }], calendar: null },
    ]);
    expect(getKingMatches).toHaveBeenCalledTimes(1);
  });

  it('keeps the last list when a forced reload fails', async () => {
    getKingMatches.mockResolvedValueOnce({
      fixtures: [{ fixture: { id: 7 } }],
      calendar: null,
    });
    await fetchKingMatches('2026-11-20');
    getKingMatches.mockRejectedValueOnce(new Error('offline'));

    await expect(fetchKingMatches('2026-11-20', { force: true })).resolves.toEqual({
      matches: [{ id: 7 }],
      calendar: null,
    });
    expect(getKingMatches).toHaveBeenLastCalledWith('2026-11-20', { fresh: true });
  });
});
