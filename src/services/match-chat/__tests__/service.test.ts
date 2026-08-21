const redisStore = new Map<string, string>();

jest.mock('../../../lib/redis', () => ({
  getRedisClient: () => ({
    get: async (key: string) => redisStore.get(key) ?? null,
    set: async (key: string, value: string, ...rest: unknown[]) => {
      if (rest.includes('NX') && redisStore.has(key)) return null;
      redisStore.set(key, value);
      return 'OK';
    },
    incr: async () => 1,
    expire: async () => 1,
    pexpire: async () => 1,
    eval: async () => [1, 'OK', 2],
    lpush: async () => 1,
    ltrim: async () => 'OK',
    lrange: async () => [],
    sadd: async () => 1,
    srem: async () => 1,
    scard: async () => 0,
    del: async (key: string) => {
      redisStore.delete(key);
      return 1;
    },
  }),
  isRedisConnected: () => true,
  initializeRedis: () => null,
  closeRedis: async () => {},
}));

jest.mock('../match-chat.persist.queue', () => ({
  enqueueMatchChatPersist: jest.fn(async () => undefined),
}));

jest.mock('../match-chat.repository', () => {
  const actual = jest.requireActual('../match-chat.repository');
  return {
    ...actual,
    pushRecentMessage: jest.fn(async () => true),
    getRecentMessages: jest.fn(async () => []),
    getHistoryFromPostgres: jest.fn(async () => ({ messages: [], hasMore: false })),
    getBlockedPairIds: jest.fn(async () => new Set()),
    persistMatchChatMessage: jest.fn(async () => undefined),
  };
});

import { processMatchChatSend } from '../match-chat.service';
import { resetLocalPolicyState, setFrozenUntil } from '../match-chat.policy';
import { resetLocalRateLimitBuckets } from '../match-chat.rate-limit';
import type { MatchChatSocketUser } from '../match-chat.types';

const user: MatchChatSocketUser = {
  userId: 'user-1',
  clerkUserId: 'clerk_1',
  username: 'ali',
  displayName: 'Ali',
  avatar: null,
  favoriteTeam: null,
};

const payload = {
  matchId: 99,
  clientMessageId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  text: 'هدف عالمي',
};

describe('match-chat send pipeline', () => {
  beforeEach(() => {
    redisStore.clear();
    resetLocalPolicyState();
    resetLocalRateLimitBuckets();
  });

  it('accepts a clean message', async () => {
    const result = await processMatchChatSend({ user, ip: '1.1.1.1', payload });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.text).toBe('هدف عالمي');
      expect(result.message.matchId).toBe(99);
    }
  });

  it('acks the same clientMessageId without creating a second message', async () => {
    const first = await processMatchChatSend({ user, ip: '1.1.1.1', payload });
    const second = await processMatchChatSend({ user, ip: '1.1.1.1', payload });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.message.id).toBe(first.message.id);
    }
  });

  it('rejects frozen users', async () => {
    await setFrozenUntil(user.userId, Date.now() + 60_000);
    const result = await processMatchChatSend({
      user,
      ip: '1.1.1.1',
      payload: { ...payload, clientMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FROZEN');
  });

  it('rejects invalid payloads', async () => {
    const result = await processMatchChatSend({ user, ip: '1.1.1.1', payload: { matchId: 1 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_MESSAGE');
  });
});
