/**
 * settlementSnapshotFrom365Game — shared classifier + alignment (A2, A4).
 */

const mockFindUnique = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
    },
  },
}));

import { settlementSnapshotFrom365Game } from '../scores365-experiment.service';

type Game = Parameters<typeof settlementSnapshotFrom365Game>[0];

const AF_ID = 1_208_000;

function dbRow(homeName: string, awayName: string) {
  return {
    id: 'row',
    fixtureId: AF_ID,
    leagueId: 233,
    leagueName: 'Egypt Cup',
    leagueLogo: '',
    leagueCountry: 'Egypt',
    leagueSeason: 2026,
    leagueRound: 'Final',
    homeTeamId: 10,
    homeTeamName: homeName,
    homeTeamLogo: '',
    awayTeamId: 20,
    awayTeamName: awayName,
    awayTeamLogo: '',
    homeScore: null,
    awayScore: null,
    homeHalftimeScore: null,
    awayHalftimeScore: null,
    matchDate: new Date('2026-10-29T18:00:00Z'),
    matchTimestamp: 0,
    status: 'NS',
    statusLong: 'Not Started',
    elapsed: null,
    venue: null,
    referee: null,
    fullData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 4_900_777,
    sportId: 1,
    competitionId: 552,
    statusGroup: 4,
    statusText: 'After Penalties',
    shortStatusText: 'AP',
    gameTime: 120,
    startTime: '2026-10-29T18:00:00.000Z',
    homeCompetitor: { id: 8100, name: 'Zamalek', score: 2, penaltyScore: 4 },
    awayCompetitor: { id: 8200, name: 'Pyramids', score: 2, penaltyScore: 3 },
    ...overrides,
  } as Game;
}

beforeEach(() => mockFindUnique.mockReset());

describe('settlementSnapshotFrom365Game', () => {
  it('maps 365 home/away onto a swapped DB fixture, incl. shootout (A4)', async () => {
    mockFindUnique.mockResolvedValue(dbRow('Pyramids', 'Zamalek'));
    const snap = await settlementSnapshotFrom365Game(game({
      homeCompetitor: { id: 8100, name: 'Zamalek', score: 1, penaltyScore: 4 },
      awayCompetitor: { id: 8200, name: 'Pyramids', score: 0, penaltyScore: 3 },
    } as Partial<Game>), AF_ID);
    expect(snap).toEqual({ status: 'PEN', homeScore: 0, awayScore: 1, penaltyHome: 3, penaltyAway: 4 });
  });

  it('direct alignment keeps sides', async () => {
    mockFindUnique.mockResolvedValue(dbRow('Zamalek', 'Pyramids'));
    const snap = await settlementSnapshotFrom365Game(game(), AF_ID);
    expect(snap).toEqual({ status: 'PEN', homeScore: 2, awayScore: 2, penaltyHome: 4, penaltyAway: 3 });
  });

  it('mapped fixture whose teams do not match → null (no guessed alignment)', async () => {
    mockFindUnique.mockResolvedValue(dbRow('Al Ahly', 'Ismaily'));
    await expect(settlementSnapshotFrom365Game(game(), AF_ID)).resolves.toBeNull();
  });

  it('stuck live clock (statusGroup 3, 90+15) is not settleable (A2)', async () => {
    mockFindUnique.mockResolvedValue(dbRow('Zamalek', 'Pyramids'));
    const snap = await settlementSnapshotFrom365Game(game({
      statusGroup: 3,
      statusText: '2nd Half',
      shortStatusText: '',
      gameTime: 105,
      gameTimeDisplay: "90+15'",
      homeCompetitor: { id: 8100, name: 'Zamalek', score: 2 },
      awayCompetitor: { id: 8200, name: 'Pyramids', score: 1 },
    } as Partial<Game>), AF_ID);
    expect(snap?.status).toBe('LIVE');
  });

  it('finished after extra time → AET with the post-ET goals', async () => {
    mockFindUnique.mockResolvedValue(dbRow('Zamalek', 'Pyramids'));
    const snap = await settlementSnapshotFrom365Game(game({
      statusText: 'After Extra Time',
      shortStatusText: 'AET',
      homeCompetitor: { id: 8100, name: 'Zamalek', score: 3 },
      awayCompetitor: { id: 8200, name: 'Pyramids', score: 2 },
    } as Partial<Game>), AF_ID);
    expect(snap).toEqual({ status: 'AET', homeScore: 3, awayScore: 2, penaltyHome: null, penaltyAway: null });
  });

  it('cancelled game keeps CANC and null scores', async () => {
    mockFindUnique.mockResolvedValue(dbRow('Zamalek', 'Pyramids'));
    const snap = await settlementSnapshotFrom365Game(game({
      statusText: 'Cancelled',
      shortStatusText: 'Canc',
      homeCompetitor: { id: 8100, name: 'Zamalek', score: -1 },
      awayCompetitor: { id: 8200, name: 'Pyramids', score: -1 },
    } as Partial<Game>), AF_ID);
    expect(snap).toMatchObject({ status: 'CANC', homeScore: null, awayScore: null });
  });
});
