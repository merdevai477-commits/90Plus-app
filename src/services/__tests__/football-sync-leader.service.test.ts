import { getRedisClient } from '../../lib/redis';
import {
  acquireSyncLeaderLease,
  withSyncLeaderLease,
} from '../football-sync-leader.service';

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;

describe('football sync leader leases', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedGetRedisClient.mockReset();
  });

  it('uses the same unique token for atomic renewal and release', async () => {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    };
    mockedGetRedisClient.mockReturnValue(redis as any);

    const lease = await acquireSyncLeaderLease('catalog', 45);
    expect(lease).not.toBeNull();
    await expect(lease!.renew()).resolves.toBe(true);
    await lease!.release();

    expect(redis.set).toHaveBeenCalledWith(
      'football:sync:leader:catalog',
      lease!.token,
      'EX',
      45,
      'NX',
    );
    expect(redis.eval.mock.calls[0]).toEqual([
      expect.stringContaining('expire'),
      1,
      'football:sync:leader:catalog',
      lease!.token,
      '45',
    ]);
    expect(redis.eval.mock.calls[1]).toEqual([
      expect.stringContaining('del'),
      1,
      'football:sync:leader:catalog',
      lease!.token,
    ]);
  });

  it('does not run work when another process owns the lease', async () => {
    mockedGetRedisClient.mockReturnValue({
      set: jest.fn().mockResolvedValue(null),
    } as any);
    const work = jest.fn(async () => 123);

    await expect(withSyncLeaderLease('busy', work)).resolves.toEqual({
      acquired: false,
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('heartbeats long work and releases after completion', async () => {
    jest.useFakeTimers();
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    };
    mockedGetRedisClient.mockReturnValue(redis as any);

    let finish!: () => void;
    const work = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const running = withSyncLeaderLease('long-job', () => work, {
      ttlSec: 6,
      heartbeatMs: 1_000,
    });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2_100);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('expire'),
      1,
      'football:sync:leader:long-job',
      expect.any(String),
      '6',
    );

    finish();
    await expect(running).resolves.toEqual({ acquired: true, value: undefined });
    expect(redis.eval).toHaveBeenLastCalledWith(
      expect.stringContaining('del'),
      1,
      'football:sync:leader:long-job',
      expect.any(String),
    );
  });

  it('aborts work and reports loss when heartbeat ownership is lost', async () => {
    jest.useFakeTimers();
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
    };
    mockedGetRedisClient.mockReturnValue(redis as any);

    const running = withSyncLeaderLease(
      'lost-job',
      ({ signal }) =>
        new Promise<boolean>((resolve) => {
          signal.addEventListener('abort', () => resolve(signal.aborted), { once: true });
        }),
      { ttlSec: 6, heartbeatMs: 1_000 },
    );

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_100);
    await expect(running).resolves.toEqual({ acquired: true, value: true, lost: true });
  });

  it('fails closed without Redis when configured, but preserves dev fallback', async () => {
    mockedGetRedisClient.mockReturnValue(null);

    await expect(
      acquireSyncLeaderLease('production-job', 30, { failClosed: true }),
    ).resolves.toBeNull();
    await expect(
      acquireSyncLeaderLease('dev-job', 30, { failClosed: false }),
    ).resolves.toEqual(expect.objectContaining({ scope: 'dev-job' }));
  });
});
