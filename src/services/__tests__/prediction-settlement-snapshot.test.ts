/**
 * loadAuthoritativeSettlementFixture source order (A2, A10, E7).
 */

const mockFindUnique = jest.fn();
const mockFetchApi = jest.fn();
const mockFetch365 = jest.fn();
const mockSnap365 = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { cachedFixture: { findUnique: (...a: unknown[]) => mockFindUnique(...a) } },
}));
jest.mock('../football.service', () => ({
  footballService: { fetchFromApi: (...a: unknown[]) => mockFetchApi(...a) },
}));
jest.mock('../scores365-experiment.service', () => ({
  fetchScores365GameById: (...a: unknown[]) => mockFetch365(...a),
  settlementSnapshotFrom365Game: (...a: unknown[]) => mockSnap365(...a),
}));

import {
  isCompleteFinalSnapshot,
  loadAuthoritativeSettlementFixture,
} from '../prediction-settlement-snapshot';

const NATIVE = 4_857_309;
const AF = 1_208_000;

function cacheRow(status: string, home: number | null, away: number | null, pen?: [number, number], extra: object = {}) {
  return {
    status,
    homeScore: home,
    awayScore: away,
    fullData: {
      goals: { home: null, away: null },
      score: { penalty: pen ? { home: pen[0], away: pen[1] } : { home: null, away: null } },
      ...extra,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch365.mockResolvedValue({ id: NATIVE });
});

describe('isCompleteFinalSnapshot', () => {
  it.each([
    [{ status: 'FT', homeScore: 1, awayScore: 0 }, true],
    [{ status: 'FT', homeScore: 1, awayScore: 1, penaltyHome: 4, penaltyAway: 3 }, false],
    [{ status: 'PEN', homeScore: 1, awayScore: 1, penaltyHome: null, penaltyAway: null }, false],
    [{ status: 'PEN', homeScore: 1, awayScore: 1, penaltyHome: 5, penaltyAway: 5 }, false],
    [{ status: 'PEN', homeScore: 1, awayScore: 1, penaltyHome: 4, penaltyAway: 3 }, true],
    [{ status: 'AET', homeScore: -1, awayScore: 2 }, false],
    [{ status: 'NS', homeScore: 0, awayScore: 0 }, false],
  ])('%j → %s', (snap, expected) => {
    expect(isCompleteFinalSnapshot(snap)).toBe(expected);
  });
});

describe('loadAuthoritativeSettlementFixture', () => {
  it('complete cache row → no 365 round-trip', async () => {
    mockFindUnique.mockResolvedValue(cacheRow('FT', 2, 1));
    const r = await loadAuthoritativeSettlementFixture(NATIVE);
    expect(r).toMatchObject({ status: 'FT', homeScore: 2, awayScore: 1 });
    expect(mockFetch365).not.toHaveBeenCalled();
  });

  it('PEN cache row missing the shootout → asks 365 (A10, the 4857309 case)', async () => {
    mockFindUnique.mockResolvedValue(cacheRow('PEN', 1, 1));
    mockSnap365.mockResolvedValue({ status: 'PEN', homeScore: 1, awayScore: 1, penaltyHome: 3, penaltyAway: 4 });
    const r = await loadAuthoritativeSettlementFixture(NATIVE);
    expect(mockFetch365).toHaveBeenCalledWith(NATIVE, { language: 'en' });
    expect(mockSnap365).toHaveBeenCalledWith({ id: NATIVE }, NATIVE);
    expect(r).toMatchObject({ status: 'PEN', penaltyHome: 3, penaltyAway: 4 });
  });

  it('365 also without a tally → keeps the cache row (gate keeps it pending)', async () => {
    mockFindUnique.mockResolvedValue(cacheRow('PEN', 1, 1));
    mockSnap365.mockResolvedValue({ status: 'PEN', homeScore: 1, awayScore: 1, penaltyHome: null, penaltyAway: null });
    const r = await loadAuthoritativeSettlementFixture(NATIVE);
    expect(r).toMatchObject({ status: 'PEN', penaltyHome: null });
  });

  it('stale NS cache loses to 365 CANC (VOID can see it)', async () => {
    mockFindUnique.mockResolvedValue(cacheRow('NS', null, null));
    mockSnap365.mockResolvedValue({ status: 'CANC', homeScore: null, awayScore: null, penaltyHome: null, penaltyAway: null });
    const r = await loadAuthoritativeSettlementFixture(NATIVE);
    expect(r?.status).toBe('CANC');
  });

  it('API-Football id with no 365 mapping never calls 365 with the AF id', async () => {
    mockFetchApi.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(cacheRow('PEN', 1, 1));
    const r = await loadAuthoritativeSettlementFixture(AF);
    expect(mockFetch365).not.toHaveBeenCalled();
    expect(r?.status).toBe('PEN');
  });

  it('API-Football id uses the stored _scores365GameId mapping', async () => {
    mockFetchApi.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue(cacheRow('PEN', 1, 1, undefined, { _scores365GameId: 4_900_123 }));
    mockSnap365.mockResolvedValue({ status: 'PEN', homeScore: 1, awayScore: 1, penaltyHome: 5, penaltyAway: 4 });
    await loadAuthoritativeSettlementFixture(AF);
    expect(mockFetch365).toHaveBeenCalledWith(4_900_123, { language: 'en' });
    expect(mockSnap365.mock.calls[0][1]).toBe(AF);
  });

  it('complete API-Football final short-circuits cache and 365', async () => {
    mockFetchApi.mockResolvedValue([
      { fixture: { status: { short: 'FT' } }, goals: { home: 3, away: 0 }, score: { penalty: { home: null, away: null } } },
    ]);
    const r = await loadAuthoritativeSettlementFixture(AF);
    expect(r).toMatchObject({ status: 'FT', homeScore: 3, awayScore: 0 });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
