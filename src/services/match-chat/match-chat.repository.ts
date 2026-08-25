import { randomUUID } from 'crypto';
import prisma from '../../lib/prisma';
import { getRedisClient, isRedisConnected } from '../../lib/redis';
import { MATCH_CHAT_CONFIG, MATCH_CHAT_REDIS_KEYS } from '../../config/match-chat.config';
import type { MatchChatAuthor, MatchChatPublicMessage, MatchChatReplyTo } from './match-chat.types';
import { matchChatIncr } from './match-chat.metrics';

export interface PersistMatchChatMessageInput {
  id: string;
  matchId: number;
  userId: string;
  text: string;
  normalizedText: string;
  moderationStatus: 'CLEAN' | 'WARNED' | 'BLOCKED' | 'DELETED';
  moderationCategory:
    | 'CLEAN'
    | 'INSULT'
    | 'PROFANITY'
    | 'HARASSMENT'
    | 'THREAT'
    | 'HATE'
    | 'SEXUAL'
    | 'SPAM'
    | 'ADVERTISEMENT'
    | 'SUSPICIOUS_LINK';
  moderationScore: number;
  moderationReason?: string;
  clientMessageId: string;
  replyToMessageId?: string;
  replyToUsername?: string;
  replyToDisplayName?: string | null;
  replyToText?: string;
  createdAt: Date;
}

function replyToFromRow(row: {
  replyToMessageId: string | null;
  replyToUsername: string | null;
  replyToDisplayName: string | null;
  replyToText: string | null;
}): MatchChatReplyTo | undefined {
  if (!row.replyToMessageId || !row.replyToUsername || !row.replyToText) return undefined;
  return {
    messageId: row.replyToMessageId,
    text: row.replyToText,
    user: {
      username: row.replyToUsername,
      displayName: row.replyToDisplayName,
    },
  };
}

function toPublic(row: {
  id: string;
  matchId: number;
  clientMessageId: string;
  text: string;
  createdAt: Date;
  replyToMessageId?: string | null;
  replyToUsername?: string | null;
  replyToDisplayName?: string | null;
  replyToText?: string | null;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    favoriteTeam: string | null;
  };
}): MatchChatPublicMessage {
  const replyTo = replyToFromRow({
    replyToMessageId: row.replyToMessageId ?? null,
    replyToUsername: row.replyToUsername ?? null,
    replyToDisplayName: row.replyToDisplayName ?? null,
    replyToText: row.replyToText ?? null,
  });
  return {
    id: row.id,
    matchId: row.matchId,
    clientMessageId: row.clientMessageId,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: row.user.id,
      username: row.user.username,
      displayName: row.user.displayName,
      avatar: row.user.avatar,
      favoriteTeam: row.user.favoriteTeam,
    },
    ...(replyTo ? { replyTo } : {}),
  };
}

export function buildPublicMessage(
  input: PersistMatchChatMessageInput,
  author: MatchChatAuthor,
): MatchChatPublicMessage {
  const replyTo =
    input.replyToMessageId && input.replyToUsername && input.replyToText
      ? {
          messageId: input.replyToMessageId,
          text: input.replyToText,
          user: {
            username: input.replyToUsername,
            displayName: input.replyToDisplayName ?? null,
          },
        }
      : undefined;
  return {
    id: input.id,
    matchId: input.matchId,
    clientMessageId: input.clientMessageId,
    text: input.text,
    createdAt: input.createdAt.toISOString(),
    user: author,
    ...(replyTo ? { replyTo } : {}),
  };
}

export async function pushRecentMessage(message: MatchChatPublicMessage): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) return false;
  const key = MATCH_CHAT_REDIS_KEYS.recent(message.matchId);
  await redis.lpush(key, JSON.stringify(message));
  await redis.ltrim(key, 0, MATCH_CHAT_CONFIG.historySize - 1);
  await redis.expire(key, MATCH_CHAT_CONFIG.recentTtlSec);
  return true;
}

export async function getRecentMessages(matchId: number): Promise<MatchChatPublicMessage[]> {
  const redis = getRedisClient();
  if (!redis || !isRedisConnected()) return [];
  const key = MATCH_CHAT_REDIS_KEYS.recent(matchId);
  const raw = await redis.lrange(key, 0, MATCH_CHAT_CONFIG.historySize - 1);
  const parsed: MatchChatPublicMessage[] = [];
  for (const item of raw.reverse()) {
    try {
      parsed.push(JSON.parse(item) as MatchChatPublicMessage);
    } catch {
      // skip corrupt
    }
  }
  matchChatIncr('historyRedis');
  return parsed;
}

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatar: true,
  favoriteTeam: true,
} as const;

export async function persistMatchChatMessage(input: PersistMatchChatMessageInput): Promise<void> {
  await prisma.matchChatMessage.create({
    data: {
      id: input.id,
      matchId: input.matchId,
      userId: input.userId,
      text: input.text,
      normalizedText: input.normalizedText,
      moderationStatus: input.moderationStatus,
      moderationCategory: input.moderationCategory,
      moderationScore: input.moderationScore,
      moderationReason: input.moderationReason,
      clientMessageId: input.clientMessageId,
      replyToMessageId: input.replyToMessageId,
      replyToUsername: input.replyToUsername,
      replyToDisplayName: input.replyToDisplayName,
      replyToText: input.replyToText,
      createdAt: input.createdAt,
    },
  });
}

export async function findMessageByClientId(
  userId: string,
  clientMessageId: string,
): Promise<MatchChatPublicMessage | null> {
  const row = await prisma.matchChatMessage.findUnique({
    where: { userId_clientMessageId: { userId, clientMessageId } },
    select: {
      id: true,
      matchId: true,
      clientMessageId: true,
      text: true,
      createdAt: true,
      deletedAt: true,
      replyToMessageId: true,
      replyToUsername: true,
      replyToDisplayName: true,
      replyToText: true,
      user: { select: USER_SELECT },
    },
  });
  if (!row || row.deletedAt) return null;
  return toPublic(row);
}

export async function getHistoryFromPostgres(
  matchId: number,
  opts: { beforeId?: string; afterCreatedAt?: Date; limit: number },
): Promise<{ messages: MatchChatPublicMessage[]; hasMore: boolean }> {
  let beforeCreatedAt: Date | undefined;
  if (opts.beforeId) {
    const cursor = await prisma.matchChatMessage.findUnique({
      where: { id: opts.beforeId },
      select: { createdAt: true, matchId: true },
    });
    if (!cursor || cursor.matchId !== matchId) {
      return { messages: [], hasMore: false };
    }
    beforeCreatedAt = cursor.createdAt;
  }

  const rows = await prisma.matchChatMessage.findMany({
    where: {
      matchId,
      deletedAt: null,
      moderationStatus: { not: 'BLOCKED' },
      ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
      ...(opts.afterCreatedAt ? { createdAt: { gt: opts.afterCreatedAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit + 1,
    select: {
      id: true,
      matchId: true,
      clientMessageId: true,
      text: true,
      createdAt: true,
      replyToMessageId: true,
      replyToUsername: true,
      replyToDisplayName: true,
      replyToText: true,
      user: { select: USER_SELECT },
    },
  });

  const hasMore = rows.length > opts.limit;
  const sliced = hasMore ? rows.slice(0, opts.limit) : rows;
  matchChatIncr('historyPg');
  return {
    messages: sliced.reverse().map(toPublic),
    hasMore,
  };
}

export async function getMessageById(id: string) {
  return prisma.matchChatMessage.findUnique({
    where: { id },
    select: {
      id: true,
      matchId: true,
      userId: true,
      text: true,
      deletedAt: true,
      createdAt: true,
      user: { select: USER_SELECT },
    },
  });
}

export async function softDeleteMessage(id: string): Promise<{ matchId: number } | null> {
  const existing = await prisma.matchChatMessage.findUnique({
    where: { id },
    select: { id: true, matchId: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) return null;
  await prisma.matchChatMessage.update({
    where: { id },
    data: { deletedAt: new Date(), moderationStatus: 'DELETED' },
  });
  return { matchId: existing.matchId };
}

export async function createMatchChatReport(input: {
  reporterId: string;
  messageId: string;
  reason: MatchChatReportReasonPrisma;
  details?: string;
}): Promise<'created' | 'duplicate'> {
  try {
    await prisma.matchChatReport.create({
      data: {
        id: randomUUID(),
        reporterId: input.reporterId,
        messageId: input.messageId,
        reason: input.reason,
        details: input.details,
      },
    });
    return 'created';
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2002') return 'duplicate';
    throw err;
  }
}

type MatchChatReportReasonPrisma =
  | 'PROFANITY'
  | 'ABUSE'
  | 'HARASSMENT'
  | 'SPAM'
  | 'ADVERTISEMENT'
  | 'SUSPICIOUS_LINK'
  | 'OTHER';

export async function fixtureExists(matchId: number): Promise<boolean> {
  const row = await prisma.cachedFixture.findUnique({
    where: { fixtureId: matchId },
    select: { fixtureId: true },
  });
  return Boolean(row);
}

export async function getBlockedPairIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }
  return ids;
}

export { toPublic as toPublicMatchChatMessage };
