import { withSyncLeaderLease } from '../football-sync-leader.service';
import {
  getSyntheticLiveRefreshCoordinatorState,
  sync365SyntheticLiveSnapshots,
} from '../scores365-experiment.service';

jest.mock('../football-sync-leader.service', () => ({
  withSyncLeaderLease: jest.fn(),
}));

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../match-cache.service', () => ({
  matchCacheService: {},
}));

const mockedLease = withSyncLeaderLease as jest.MockedFunction<typeof withSyncLeaderLease>;

describe('365 synthetic live refresh coordination', () => {
  const originalExperiment = process.env.SCORES365_EXPERIMENT_ENABLED;

  afterEach(() => {
    if (originalExperiment == null) delete process.env.SCORES365_EXPERIMENT_ENABLED;
    else process.env.SCORES365_EXPERIMENT_ENABLED = originalExperiment;
  });

  it('unions and drains IDs that arrive during an active refresh', async () => {
    process.env.SCORES365_EXPERIMENT_ENABLED = 'false';
    let begin!: () => void;
    const gate = new Promise<void>((resolve) => {
      begin = resolve;
    });
    mockedLease.mockImplementationOnce(async (_scope, work) => {
      await gate;
      const controller = new AbortController();
      return {
        acquired: true,
        value: await work({ signal: controller.signal, isLost: () => false }),
      };
    });

    const allscoresRefresh = sync365SyntheticLiveSnapshots({
      language: 'en',
      gameIds: [123],
    });
    const cronRefresh = sync365SyntheticLiveSnapshots({ language: 'en', gameIds: [456] });

    expect(cronRefresh).toBe(allscoresRefresh);
    expect(getSyntheticLiveRefreshCoordinatorState('en').pendingGameIds.sort()).toEqual([123, 456]);
    expect(mockedLease).toHaveBeenCalledTimes(1);
    expect(mockedLease).toHaveBeenCalledWith(
      '365-synthetic-live:en',
      expect.any(Function),
      { ttlSec: 60 },
    );

    begin();
    await expect(allscoresRefresh).resolves.toBe(0);
    expect(getSyntheticLiveRefreshCoordinatorState('en')).toMatchObject({
      pendingGameIds: [],
      fullScanPending: false,
      favoriteScanPending: false,
      inFlight: false,
    });
  });
});
