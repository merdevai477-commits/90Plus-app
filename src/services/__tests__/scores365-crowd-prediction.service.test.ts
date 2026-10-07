const fetchGame = jest.fn();
const redisGet = jest.fn();
const redisSet = jest.fn();

jest.mock('../scores365-experiment.service', () => ({
  fetchScores365GameById: (...args: unknown[]) => fetchGame(...args),
  getScores365GameIdForFixture: () => null,
  isScores365ExperimentEnabled: () => true,
  SCORES365_LEAGUE_ID_OFFSET: 7_000_000,
}));

jest.mock('../redis-cache.service', () => ({
  redisCacheService: {
    get: (...args: unknown[]) => redisGet(...args),
    set: (...args: unknown[]) => redisSet(...args),
  },
}));

import {
  enrichFixturesWithCrowdPredictions,
  getCrowdPredictionMemorySize,
  resetCrowdPredictionMemory,
  sweepCrowdPredictionMemory,
} from '../scores365-crowd-prediction.service';

const voteGame = {
  promotedPredictions: {
    predictions: [
      {
        type: 1,
        totalVotes: 100,
        options: [
          { num: 1, vote: { percentage: 50 } },
          { num: 2, vote: { percentage: 20 } },
          { num: 3, vote: { percentage: 30 } },
        ],
      },
    ],
  },
};

const upcoming = (id: number) => ({
  fixture: { id, timestamp: Math.floor(Date.now() / 1000) + 3600, status: { short: 'NS' } },
});

describe('crowd prediction cache', () => {
  beforeEach(() => {
    resetCrowdPredictionMemory();
    fetchGame.mockReset();
    redisGet.mockReset().mockResolvedValue(null);
    redisSet.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  it('remembers games without votes so repeat passes do not refetch them', async () => {
    fetchGame.mockResolvedValue({ promotedPredictions: { predictions: [] } });
    await enrichFixturesWithCrowdPredictions([upcoming(4_500_001)]);
    await enrichFixturesWithCrowdPredictions([upcoming(4_500_001)]);
    expect(fetchGame).toHaveBeenCalledTimes(1);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('uses the shared Redis copy before calling 365', async () => {
    redisGet.mockResolvedValue({ homePercent: 60, drawPercent: 10, awayPercent: 30, totalVotes: 9 });
    const [row] = await enrichFixturesWithCrowdPredictions([upcoming(4_500_002)]);
    expect(fetchGame).not.toHaveBeenCalled();
    expect(row.crowdPrediction.homePercent).toBe(60);
  });

  it('attaches and stores a fetched prediction', async () => {
    fetchGame.mockResolvedValue(voteGame);
    const [row] = await enrichFixturesWithCrowdPredictions([upcoming(4_500_003)]);
    expect(row.crowdPrediction).toEqual({ homePercent: 50, drawPercent: 20, awayPercent: 30, totalVotes: 100 });
    expect(redisSet).toHaveBeenCalledWith('365:crowd-pred:4500003', row.crowdPrediction, expect.any(Number));

    const [cached] = await enrichFixturesWithCrowdPredictions([upcoming(4_500_003)], undefined, {
      cacheOnly: true,
    });
    expect(cached.crowdPrediction.homePercent).toBe(50);
  });

  it('treats a failed 365 fetch as a short-lived miss', async () => {
    fetchGame.mockRejectedValue(new Error('timeout'));
    const [row] = await enrichFixturesWithCrowdPredictions([upcoming(4_500_004)]);
    expect(row.crowdPrediction).toBeUndefined();
    await enrichFixturesWithCrowdPredictions([upcoming(4_500_004)]);
    expect(fetchGame).toHaveBeenCalledTimes(1);
  });

  it('sweeps expired entries', async () => {
    jest.useFakeTimers({ now: Date.now() });
    fetchGame.mockResolvedValueOnce({}).mockResolvedValueOnce(voteGame);
    await enrichFixturesWithCrowdPredictions([upcoming(4_500_005), upcoming(4_500_006)]);
    expect(getCrowdPredictionMemorySize()).toBe(2);

    jest.setSystemTime(Date.now() + 6 * 60_000);
    expect(sweepCrowdPredictionMemory()).toBe(1);
    expect(getCrowdPredictionMemorySize()).toBe(1);

    jest.setSystemTime(Date.now() + 30 * 60_000);
    expect(sweepCrowdPredictionMemory()).toBe(1);
    expect(getCrowdPredictionMemorySize()).toBe(0);
  });
});
