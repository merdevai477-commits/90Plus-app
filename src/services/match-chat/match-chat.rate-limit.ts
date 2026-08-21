/**
 * Atomic token-bucket + per-minute cap. Redis Lua is the production path.
 * The JS bucket is used only when Redis is down (degraded) and in unit tests.
 */

import type Redis from 'ioredis';
import { MATCH_CHAT_CONFIG, MATCH_CHAT_REDIS_KEYS } from '../../config/match-chat.config';
import { getRedisClient, isRedisConnected } from '../../lib/redis';

export const MATCH_CHAT_RATE_LUA = `
local now = tonumber(ARGV[1])
local interval = tonumber(ARGV[2])
local burst = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])
local minuteMax = tonumber(ARGV[6])

local minuteCount = tonumber(redis.call('INCR', KEYS[2]))
if minuteCount == 1 then
  redis.call('PEXPIRE', KEYS[2], 60000)
end
if minuteCount > minuteMax then
  return {0, 'MINUTE', minuteCount}
end

local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = burst
  ts = now
end
local elapsed = now - ts
if elapsed < 0 then
  elapsed = 0
end
local refill = math.floor(elapsed / interval)
if refill > 0 then
  tokens = math.min(burst, tokens + refill)
  ts = ts + refill * interval
end
if tokens < cost then
  return {0, 'BURST', tokens}
end
tokens = tokens - cost
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', ts)
redis.call('PEXPIRE', KEYS[1], ttl)
return {1, 'OK', tokens}
`;

export interface TokenBucketState {
  tokens: number;
  ts: number;
  minuteCount: number;
  minuteWindowStart: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  reason?: 'BURST' | 'MINUTE';
  retryAfterMs: number;
}

export function applyTokenBucket(
  state: TokenBucketState,
  now: number,
  opts: { intervalMs: number; burst: number; perMin: number; cost?: number },
): { next: TokenBucketState; decision: RateLimitDecision } {
  const cost = opts.cost ?? 1;
  const next: TokenBucketState = { ...state };

  if (now - next.minuteWindowStart >= 60_000) {
    next.minuteCount = 0;
    next.minuteWindowStart = now;
  }
  next.minuteCount += 1;
  if (next.minuteCount > opts.perMin) {
    return {
      next,
      decision: { allowed: false, reason: 'MINUTE', retryAfterMs: 60_000 - (now - next.minuteWindowStart) },
    };
  }

  const elapsed = Math.max(0, now - next.ts);
  const refill = Math.floor(elapsed / opts.intervalMs);
  if (refill > 0) {
    next.tokens = Math.min(opts.burst, next.tokens + refill);
    next.ts = next.ts + refill * opts.intervalMs;
  }
  if (next.tokens < cost) {
    return {
      next: { ...next, minuteCount: next.minuteCount - 1 },
      decision: { allowed: false, reason: 'BURST', retryAfterMs: opts.intervalMs },
    };
  }
  next.tokens -= cost;
  return { next, decision: { allowed: true, retryAfterMs: 0 } };
}

const localBuckets = new Map<string, TokenBucketState>();
const LOCAL_BUCKET_CAP = 2000;

function getLocal(key: string, burst: number, now: number): TokenBucketState {
  const existing = localBuckets.get(key);
  if (existing) return existing;
  if (localBuckets.size >= LOCAL_BUCKET_CAP) {
    const first = localBuckets.keys().next().value;
    if (first) localBuckets.delete(first);
  }
  return { tokens: burst, ts: now, minuteCount: 0, minuteWindowStart: now };
}

async function consumeRedis(
  redis: Redis,
  hashKey: string,
  minuteKey: string,
  now: number,
  burst: number,
  perMin: number,
): Promise<RateLimitDecision> {
  const raw = (await redis.eval(
    MATCH_CHAT_RATE_LUA,
    2,
    hashKey,
    minuteKey,
    String(now),
    String(MATCH_CHAT_CONFIG.refillIntervalMs),
    String(burst),
    '1',
    String(MATCH_CHAT_CONFIG.rateKeyTtlSec * 1000),
    String(perMin),
  )) as [number | string, string, number | string];

  const ok = Number(raw[0]) === 1;
  if (ok) return { allowed: true, retryAfterMs: 0 };
  const reason = raw[1] === 'MINUTE' ? 'MINUTE' : 'BURST';
  return {
    allowed: false,
    reason,
    retryAfterMs: reason === 'MINUTE' ? 60_000 : MATCH_CHAT_CONFIG.refillIntervalMs,
  };
}

export async function consumeUserRateLimit(userId: string, now = Date.now()): Promise<RateLimitDecision> {
  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    return consumeRedis(
      redis,
      MATCH_CHAT_REDIS_KEYS.userRate(userId),
      MATCH_CHAT_REDIS_KEYS.userMinute(userId),
      now,
      MATCH_CHAT_CONFIG.burst,
      MATCH_CHAT_CONFIG.perMin,
    );
  }

  const key = `local:user:${userId}`;
  const current = getLocal(key, MATCH_CHAT_CONFIG.burst, now);
  const { next, decision } = applyTokenBucket(current, now, {
    intervalMs: MATCH_CHAT_CONFIG.refillIntervalMs,
    burst: MATCH_CHAT_CONFIG.burst,
    perMin: MATCH_CHAT_CONFIG.perMin,
  });
  localBuckets.set(key, next);
  return decision;
}

export async function consumeIpSendLimit(
  userId: string,
  ip: string,
  now = Date.now(),
): Promise<RateLimitDecision> {
  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    return consumeRedis(
      redis,
      MATCH_CHAT_REDIS_KEYS.ipRate(userId, ip),
      MATCH_CHAT_REDIS_KEYS.ipMinute(userId, ip),
      now,
      MATCH_CHAT_CONFIG.burst * 2,
      MATCH_CHAT_CONFIG.ipSendPerMin,
    );
  }
  return { allowed: true, retryAfterMs: 0 };
}

export async function consumeIpConnectLimit(ip: string): Promise<RateLimitDecision> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) {
    return { allowed: true, retryAfterMs: 0 };
  }
  const key = MATCH_CHAT_REDIS_KEYS.ipConnect(ip);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, 60_000);
  }
  if (count > MATCH_CHAT_CONFIG.ipConnectPerMin) {
    return { allowed: false, reason: 'MINUTE', retryAfterMs: 60_000 };
  }
  return { allowed: true, retryAfterMs: 0 };
}

/** Test helper — not used in production handlers. */
export function resetLocalRateLimitBuckets(): void {
  localBuckets.clear();
}
