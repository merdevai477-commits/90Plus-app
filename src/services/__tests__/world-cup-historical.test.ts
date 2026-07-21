const prismaMock = {
  cachedFixture: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  },
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { isWorldCupHistoricalOnlyMode } from '../../config/world-cup-only-mode.config';
import { isHistoricalHttpDbOnlyEnabled } from '../../config/football-reliability-rollout.config';
import {
  ensureScores365GameMapping,
  persistScores365FixtureMetadata,
  readPersistedScores365GameId,
} from '../scores365-experiment.service';

describe('World Cup historical durability', () => {
  const originalHistorical = process.env.WORLD_CUP_HISTORICAL_ONLY;
  const originalHttpDbOnly = process.env.FOOTBALL_HISTORICAL_HTTP_DB_ONLY;
  const originalExperiment = process.env.SCORES365_EXPERIMENT_ENABLED;

  afterEach(() => {
    if (originalHistorical == null) delete process.env.WORLD_CUP_HISTORICAL_ONLY;
    else process.env.WORLD_CUP_HISTORICAL_ONLY = originalHistorical;
    if (originalHttpDbOnly == null) delete process.env.FOOTBALL_HISTORICAL_HTTP_DB_ONLY;
    else process.env.FOOTBALL_HISTORICAL_HTTP_DB_ONLY = originalHttpDbOnly;
    if (originalExperiment == null) delete process.env.SCORES365_EXPERIMENT_ENABLED;
    else process.env.SCORES365_EXPERIMENT_ENABLED = originalExperiment;
    jest.clearAllMocks();
  });

  it.each(['true', '1'])('enables historical-only mode for %s', (value) => {
    process.env.WORLD_CUP_HISTORICAL_ONLY = value;
    expect(isWorldCupHistoricalOnlyMode()).toBe(true);
  });

  it('does not globally force uncached historical HTTP reads empty by default', () => {
    delete process.env.FOOTBALL_HISTORICAL_HTTP_DB_ONLY;
    expect(isHistoricalHttpDbOnlyEnabled()).toBe(false);
  });

  it('reads a durable fixture-to-365 mapping after an in-process cache miss', async () => {
    process.env.SCORES365_EXPERIMENT_ENABLED = 'true';
    prismaMock.cachedFixture.findUnique.mockResolvedValue({
      status: 'FT',
      leagueId: 1,
      homeTeamName: 'Argentina',
      awayTeamName: 'France',
      matchDate: new Date('2022-12-18T15:00:00.000Z'),
      matchTimestamp: 1671375600,
      fullData: { _scores365GameId: 4_567_890 },
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(ensureScores365GameMapping(1_234_567)).resolves.toBe(4_567_890);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readPersistedScores365GameId({ _scores365GameId: '4567890' })).toBe(4_567_890);

    fetchSpy.mockRestore();
  });

  it('backfills fixture mapping and LMT metadata without replacing fullData', async () => {
    prismaMock.cachedFixture.findMany.mockResolvedValue([
      {
        fixtureId: 123,
        fullData: { events: [{ id: 'goal-1' }], _source: 'api-football' },
      },
    ]);

    await expect(
      persistScores365FixtureMetadata([
        {
          fixtureId: 123,
          game: {
            id: 456,
            widgets: [
              {
                provider: 'SportRadarLMT',
                partnerId: 'sr:match:456',
                widgetType: 'LMT',
                widgetRatio: 1.6,
              },
            ],
          } as any,
        },
      ]),
    ).resolves.toBe(1);

    expect(prismaMock.cachedFixture.update).toHaveBeenCalledWith({
      where: { fixtureId: 123 },
      data: {
        fullData: expect.objectContaining({
          events: [{ id: 'goal-1' }],
          _source: 'api-football',
          _scores365GameId: 456,
          _lmt: expect.objectContaining({
            partnerId: 'sr:match:456',
            provider: 'SportRadarLMT',
          }),
        }),
      },
    });
  });
});
