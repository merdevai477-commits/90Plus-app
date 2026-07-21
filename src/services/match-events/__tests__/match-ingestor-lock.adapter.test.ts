import { getRedisClient } from '../../../lib/redis';
import { acquireIngestorLock } from '../match-ingestor-lock.adapter';

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

describe('match ingestor lock ownership', () => {
  const originalEnabled = process.env.MATCH_EVENT_USE_LEADER_LOCK;

  beforeEach(() => {
    process.env.MATCH_EVENT_USE_LEADER_LOCK = 'true';
    mockedGetRedisClient.mockReset();
  });

  afterAll(() => {
    if (originalEnabled == null) delete process.env.MATCH_EVENT_USE_LEADER_LOCK;
    else process.env.MATCH_EVENT_USE_LEADER_LOCK = originalEnabled;
  });

  it('uses a per-acquisition token and atomic compare-delete release', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    };
    mockedGetRedisClient.mockReturnValue(redis as any);

    const first = await acquireIngestorLock(42);
    const second = await acquireIngestorLock(43);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const firstToken = redis.set.mock.calls[0][1];
    const secondToken = redis.set.mock.calls[1][1];
    expect(firstToken).not.toBe(secondToken);

    await first!.release();
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("del"'),
      1,
      'lock:match-ingestor:42',
      firstToken,
    );
    expect((redis as any).get).toBeUndefined();
    expect((redis as any).del).toBeUndefined();
  });
});
