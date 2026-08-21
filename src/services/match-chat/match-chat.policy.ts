import { MATCH_CHAT_CONFIG, MATCH_CHAT_REDIS_KEYS } from '../../config/match-chat.config';
import { getRedisClient, isRedisConnected } from '../../lib/redis';
import type { MatchChatModerationCategory } from './match-chat.types';

export interface StrikeDecision {
  kind: 'warn' | 'freeze';
  strikes: number;
  frozenUntil?: number;
  remainingMs?: number;
}

const localStrikes = new Map<string, { count: number; expiresAt: number }>();
const localFreeze = new Map<string, number>();
const LOCAL_CAP = 2000;

function capMap<V>(map: Map<string, V>): void {
  if (map.size < LOCAL_CAP) return;
  const first = map.keys().next().value;
  if (first) map.delete(first);
}

export async function getFrozenUntil(userId: string): Promise<number | null> {
  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    const raw = await redis.get(MATCH_CHAT_REDIS_KEYS.freeze(userId));
    if (!raw) return null;
    const until = Number.parseInt(raw, 10);
    if (!Number.isFinite(until) || until <= Date.now()) {
      await redis.del(MATCH_CHAT_REDIS_KEYS.freeze(userId));
      return null;
    }
    return until;
  }
  const until = localFreeze.get(userId);
  if (!until || until <= Date.now()) {
    localFreeze.delete(userId);
    return null;
  }
  return until;
}

export async function setFrozenUntil(userId: string, until: number): Promise<void> {
  const ttlMs = Math.max(1000, until - Date.now());
  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    await redis.set(MATCH_CHAT_REDIS_KEYS.freeze(userId), String(until), 'PX', ttlMs);
    return;
  }
  capMap(localFreeze);
  localFreeze.set(userId, until);
}

export async function clearFreeze(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (redis && isRedisConnected()) {
    await redis.del(MATCH_CHAT_REDIS_KEYS.freeze(userId));
  }
  localFreeze.delete(userId);
}

export async function applyModerationStrike(
  userId: string,
  category: MatchChatModerationCategory,
  now = Date.now(),
): Promise<StrikeDecision> {
  const skipToFreeze = category === 'THREAT' || category === 'HATE';
  const redis = getRedisClient();

  if (redis && isRedisConnected()) {
    const key = MATCH_CHAT_REDIS_KEYS.moderation(userId);
    const strikes = await redis.incr(key);
    if (strikes === 1) {
      await redis.expire(key, MATCH_CHAT_CONFIG.strikeWindowSec);
    }
    if (skipToFreeze || strikes >= MATCH_CHAT_CONFIG.freezeStrikes) {
      const until = now + MATCH_CHAT_CONFIG.freezeMs;
      await setFrozenUntil(userId, until);
      return {
        kind: 'freeze',
        strikes,
        frozenUntil: until,
        remainingMs: MATCH_CHAT_CONFIG.freezeMs,
      };
    }
    return { kind: 'warn', strikes };
  }

  capMap(localStrikes);
  const existing = localStrikes.get(userId);
  const count =
    existing && existing.expiresAt > now ? existing.count + 1 : 1;
  localStrikes.set(userId, {
    count,
    expiresAt: now + MATCH_CHAT_CONFIG.strikeWindowSec * 1000,
  });

  if (skipToFreeze || count >= MATCH_CHAT_CONFIG.freezeStrikes) {
    const until = now + MATCH_CHAT_CONFIG.freezeMs;
    await setFrozenUntil(userId, until);
    return { kind: 'freeze', strikes: count, frozenUntil: until, remainingMs: MATCH_CHAT_CONFIG.freezeMs };
  }
  return { kind: 'warn', strikes: count };
}

export function resetLocalPolicyState(): void {
  localStrikes.clear();
  localFreeze.clear();
}
