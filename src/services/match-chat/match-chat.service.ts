import { randomUUID } from 'crypto';
import { getRedisClient, isRedisConnected } from '../../lib/redis';
import { MATCH_CHAT_CONFIG, MATCH_CHAT_REDIS_KEYS, matchChatRoom } from '../../config/match-chat.config';
import { logger } from '../../utils/logger';
import { moderateMatchChatText } from './match-chat.moderation';
import { matchChatIncr } from './match-chat.metrics';
import { normalizeChatText } from './match-chat.normalizer';
import { applyModerationStrike, getFrozenUntil } from './match-chat.policy';
import { enqueueMatchChatPersist } from './match-chat.persist.queue';
import { consumeIpSendLimit, consumeUserRateLimit } from './match-chat.rate-limit';
import {
  buildPublicMessage,
  getBlockedPairIds,
  getHistoryFromPostgres,
  getRecentMessages,
  pushRecentMessage,
  type PersistMatchChatMessageInput,
} from './match-chat.repository';
import { matchChatSendSchema } from './match-chat.validation';
import type {
  MatchChatFrozenPayload,
  MatchChatIdempotencyRecord,
  MatchChatPublicMessage,
  MatchChatRejectCode,
  MatchChatSocketUser,
  MatchChatWarnedPayload,
} from './match-chat.types';

export type SendPipelineResult =
  | { ok: true; message: MatchChatPublicMessage }
  | {
      ok: false;
      code: MatchChatRejectCode;
      retryAfterMs?: number;
      reason?: string;
      warned?: MatchChatWarnedPayload;
      frozen?: MatchChatFrozenPayload;
    };

async function readIdempotency(
  userId: string,
  clientMessageId: string,
): Promise<MatchChatIdempotencyRecord | null> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) return null;
  const raw = await redis.get(MATCH_CHAT_REDIS_KEYS.idem(userId, clientMessageId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MatchChatIdempotencyRecord;
  } catch {
    return null;
  }
}

async function writeIdempotency(
  userId: string,
  clientMessageId: string,
  record: MatchChatIdempotencyRecord,
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) return true;
  const key = MATCH_CHAT_REDIS_KEYS.idem(userId, clientMessageId);
  const result = await redis.set(
    key,
    JSON.stringify(record),
    'EX',
    MATCH_CHAT_CONFIG.idempotencyTtlSec,
    'NX',
  );
  return result === 'OK';
}

async function identicalFlood(userId: string, normalized: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected() || !normalized) return false;
  const key = `chat:user:${userId}:lastnorm`;
  const prev = await redis.get(key);
  await redis.set(key, normalized, 'EX', 12);
  return prev === normalized;
}

export async function loadJoinHistory(
  matchId: number,
  userId: string,
  lastMessageId?: string,
): Promise<{ messages: MatchChatPublicMessage[]; missed: MatchChatPublicMessage[]; hasMore: boolean }> {
  const blocked = await getBlockedPairIds(userId);
  const filter = (msgs: MatchChatPublicMessage[]) => msgs.filter((m) => !blocked.has(m.user.id));

  let recent = await getRecentMessages(matchId);
  if (recent.length === 0) {
    const pg = await getHistoryFromPostgres(matchId, { limit: MATCH_CHAT_CONFIG.historySize });
    recent = pg.messages;
  }

  const visible = filter(recent);
  if (!lastMessageId) {
    return { messages: visible, missed: [], hasMore: visible.length >= MATCH_CHAT_CONFIG.historySize };
  }

  const idx = visible.findIndex((m) => m.id === lastMessageId);
  if (idx >= 0) {
    return { messages: visible, missed: visible.slice(idx + 1), hasMore: false };
  }

  const pg = await getHistoryFromPostgres(matchId, { limit: MATCH_CHAT_CONFIG.historySize });
  const pgVisible = filter(pg.messages);
  const pgIdx = pgVisible.findIndex((m) => m.id === lastMessageId);
  return {
    messages: pgVisible,
    missed: pgIdx >= 0 ? pgVisible.slice(pgIdx + 1) : pgVisible,
    hasMore: pg.hasMore,
  };
}

export async function processMatchChatSend(input: {
  user: MatchChatSocketUser;
  ip: string;
  payload: unknown;
}): Promise<SendPipelineResult> {
  const parsed = matchChatSendSchema.safeParse(input.payload);
  if (!parsed.success) {
    matchChatIncr('rejected');
    return { ok: false, code: 'INVALID_MESSAGE', reason: 'validation' };
  }

  const { matchId, clientMessageId, text } = parsed.data;

  const existing = await readIdempotency(input.user.userId, clientMessageId);
  if (existing?.kind === 'accepted' && existing.message) {
    return { ok: true, message: existing.message };
  }
  if (existing?.kind === 'rejected') {
    return { ok: false, code: existing.code ?? 'DUPLICATE', reason: existing.reason };
  }

  const frozenUntil = await getFrozenUntil(input.user.userId);
  if (frozenUntil) {
    matchChatIncr('frozen');
    matchChatIncr('rejected');
    return {
      ok: false,
      code: 'FROZEN',
      retryAfterMs: Math.max(0, frozenUntil - Date.now()),
      frozen: {
        frozenUntil: new Date(frozenUntil).toISOString(),
        remainingMs: Math.max(0, frozenUntil - Date.now()),
      },
    };
  }

  const userRate = await consumeUserRateLimit(input.user.userId);
  if (!userRate.allowed) {
    matchChatIncr('rateLimited');
    matchChatIncr('rejected');
    return { ok: false, code: 'RATE_LIMITED', retryAfterMs: userRate.retryAfterMs };
  }

  const ipRate = await consumeIpSendLimit(input.user.userId, input.ip);
  if (!ipRate.allowed) {
    matchChatIncr('rateLimited');
    matchChatIncr('rejected');
    return { ok: false, code: 'RATE_LIMITED', retryAfterMs: ipRate.retryAfterMs };
  }

  const normalized = normalizeChatText(text);
  if (!normalized) {
    matchChatIncr('rejected');
    return { ok: false, code: 'INVALID_MESSAGE', reason: 'empty' };
  }

  if (await identicalFlood(input.user.userId, normalized)) {
    matchChatIncr('moderationBlocked');
    matchChatIncr('rejected');
    return { ok: false, code: 'MODERATION_BLOCKED', reason: 'repeat' };
  }

  const mod = moderateMatchChatText(text, normalized);
  if (mod.action !== 'allow') {
    matchChatIncr('moderationBlocked');
    matchChatIncr('rejected');
    const strike = await applyModerationStrike(input.user.userId, mod.category);
    const rejected: SendPipelineResult = {
      ok: false,
      code: 'MODERATION_BLOCKED',
      reason: mod.reason,
    };
    if (strike.kind === 'warn') {
      rejected.warned = {
        remainingStrikesUntilFreeze: Math.max(0, MATCH_CHAT_CONFIG.freezeStrikes - strike.strikes),
        category: mod.category,
      };
    } else if (strike.frozenUntil && strike.remainingMs != null) {
      rejected.frozen = {
        frozenUntil: new Date(strike.frozenUntil).toISOString(),
        remainingMs: strike.remainingMs,
      };
      rejected.code = 'FROZEN';
      rejected.retryAfterMs = strike.remainingMs;
    }
    await writeIdempotency(input.user.userId, clientMessageId, {
      kind: 'rejected',
      code: rejected.code,
      reason: mod.reason,
    });
    return rejected;
  }

  const createdAt = new Date();
  const persist: PersistMatchChatMessageInput = {
    id: randomUUID(),
    matchId,
    userId: input.user.userId,
    text,
    normalizedText: normalized,
    moderationStatus: 'CLEAN',
    moderationCategory: 'CLEAN',
    moderationScore: 0,
    clientMessageId,
    createdAt,
  };

  const message = buildPublicMessage(persist, {
    id: input.user.userId,
    username: input.user.username,
    displayName: input.user.displayName,
    avatar: input.user.avatar,
    favoriteTeam: input.user.favoriteTeam,
  });

  const claimed = await writeIdempotency(input.user.userId, clientMessageId, {
    kind: 'accepted',
    message,
  });
  if (!claimed) {
    const raced = await readIdempotency(input.user.userId, clientMessageId);
    if (raced?.kind === 'accepted' && raced.message) return { ok: true, message: raced.message };
    return { ok: false, code: 'DUPLICATE' };
  }

  const redisOk = await pushRecentMessage(message);
  if (!redisOk) {
    try {
      const { persistMatchChatMessage } = await import('./match-chat.repository');
      await persistMatchChatMessage(persist);
      matchChatIncr('persistOk');
    } catch (err) {
      logger.warn('[match-chat] degraded persist failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    void enqueueMatchChatPersist(persist);
  }

  matchChatIncr('accepted');
  return { ok: true, message };
}

export async function touchPresence(matchId: number, userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) return;
  const key = MATCH_CHAT_REDIS_KEYS.presence(matchId);
  const count = await redis.scard(key);
  if (count < MATCH_CHAT_CONFIG.presenceCap) {
    await redis.sadd(key, userId);
  }
  await redis.expire(key, MATCH_CHAT_CONFIG.recentTtlSec);
}

export async function dropPresence(matchId: number, userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) return;
  await redis.srem(MATCH_CHAT_REDIS_KEYS.presence(matchId), userId);
}

export function roomName(matchId: number): string {
  return matchChatRoom(matchId);
}
