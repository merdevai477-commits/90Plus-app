/**
 * chat.service.ts
 *
 * Prisma-backed persistence layer for the 90Plus AI Chat.
 *
 * Replaces the legacy file-based `chat-store.json` store. All reads and writes
 * go through this module so the route handler stays declarative. Concurrent
 * writes are safe because every mutation hits a single row or is wrapped in
 * a `$transaction`.
 *
 * Role mapping:
 *   DB role is either "user" or "assistant" (matches OpenAI conventions).
 *   The frontend hook uses "ai" for assistant messages — we convert when
 *   serialising responses.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export type StoredRole = 'user' | 'assistant';
export type ApiRole = 'user' | 'ai';

export interface ChatConversationDTO {
    id: string;
    title: string;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
    lastMessage: string | null;
}

export interface ChatMessageDTO {
    id: string;
    role: ApiRole;
    text: string;
    createdAt: string;
}

export interface ConversationWithLast {
    id: string;
    title: string;
    pinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastMessage: string | null;
}

const DAILY_LIMIT = Number(process.env.CHAT_DAILY_MESSAGE_LIMIT ?? 10);
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Clerk user ids with unlimited AI chat (comma/space separated). */
function parseUnlimitedChatUserIds(): Set<string> {
  const raw = process.env.CHAT_UNLIMITED_USER_IDS ?? '';
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

let unlimitedUserIdsCache: Set<string> | null = null;

export function isChatUnlimitedUser(userId: string): boolean {
  if (!userId) return false;
  if (!unlimitedUserIdsCache) unlimitedUserIdsCache = parseUnlimitedChatUserIds();
  return unlimitedUserIdsCache.has(userId);
}

/** Test helper — clears cached unlimited-user set after env changes. */
export function resetChatUnlimitedUserCache(): void {
  unlimitedUserIdsCache = null;
}

export function getDailyMessageLimit(): number {
  return DAILY_LIMIT;
}

function parseWindowStart(dateStr: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isRollingWindowExpired(dateStr: string): boolean {
  const start = parseWindowStart(dateStr);
  if (!start) return true;
  return Date.now() - start.getTime() >= ROLLING_WINDOW_MS;
}

function rollingResetAt(dateStr: string): Date {
  const start = parseWindowStart(dateStr);
  if (!start) return new Date(Date.now() + ROLLING_WINDOW_MS);
  return new Date(start.getTime() + ROLLING_WINDOW_MS);
}

// ─── Conversation list ───────────────────────────────────────────────────────

/**
 * Return the user's conversations ordered by:
 *   1. Pinned first
 *   2. Most recently updated
 *
 * We include only the latest message for the preview so the payload stays
 * small — a conversation with 500 messages shouldn't cost 500 rows here.
 */
export async function listConversations(userId: string, take = 50): Promise<ConversationWithLast[]> {
    const rows = await prisma.chatConversation.findMany({
        where: { userId },
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        take,
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { text: true },
            },
        },
    });

    return rows.map((c) => ({
        id: c.id,
        title: c.title,
        pinned: c.pinned,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastMessage: c.messages[0]?.text?.slice(0, 80) ?? null,
    }));
}

/** Titles that should be replaced after the first user message. */
export function isPlaceholderConversationTitle(title: string | null | undefined): boolean {
    const t = (title ?? '').trim().toLowerCase();
    if (!t) return true;
    return (
        t === 'محادثة جديدة' ||
        t === 'new chat' ||
        t === 'new conversation' ||
        t === 'new conversation.'
    );
}

/** Short title from the first user message (history sidebar). */
export function buildTitleFromFirstMessage(message: string): string {
    const cleaned = message
        .replace(/[\n\r]+/g, ' ')
        .replace(/[?!.,،؟؛]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const candidate = cleaned.split(/\s+/).slice(0, 6).join(' ').slice(0, 50);
    return candidate.length >= 2 ? candidate : 'محادثة جديدة';
}

export async function createConversation(userId: string, title = 'محادثة جديدة') {
    const trimmed = title.trim().slice(0, 100);
    return prisma.chatConversation.create({
        data: {
            userId,
            title: trimmed && !isPlaceholderConversationTitle(trimmed) ? trimmed : 'محادثة جديدة',
        },
    });
}

export async function findConversation(userId: string, conversationId: string) {
    return prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
    });
}

export async function updateConversation(
    userId: string,
    conversationId: string,
    updates: { title?: string; pinned?: boolean },
) {
    // Ensure the conversation belongs to this user before mutating.
    const owned = await prisma.chatConversation.count({
        where: { id: conversationId, userId },
    });
    if (!owned) return null;

    return prisma.chatConversation.update({
        where: { id: conversationId },
        data: updates,
    });
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
    const result = await prisma.chatConversation.deleteMany({
        where: { id: conversationId, userId },
    });
    return result.count > 0;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function listMessages(
    userId: string,
    conversationId: string,
    take = 100,
): Promise<ChatMessageDTO[] | null> {
    const conv = await prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
    });
    if (!conv) return null;

    const rows = await prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take,
    });

    return rows.map(toMessageDTO);
}

/**
 * Save a user OR assistant message and bump the conversation's updatedAt.
 * The two writes happen in a single transaction — a crash between them
 * would otherwise leave an orphaned message while the conversation list
 * still shows an older timestamp.
 */
export async function appendMessage(
    userId: string,
    conversationId: string,
    role: StoredRole,
    text: string,
    usedModel?: string | null,
) {
    // Ownership check outside the transaction — short-circuits if wrong.
    const conv = await prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
        select: { id: true },
    });
    if (!conv) return null;

    const [msg] = await prisma.$transaction([
        prisma.chatMessage.create({
            data: { conversationId, role, text, usedModel: usedModel ?? null },
        }),
        prisma.chatConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        }),
    ]);

    return msg;
}

/**
 * Delete a single message + all messages created AFTER it. Used by the edit
 * flow: when the user edits message N, everything downstream gets regenerated
 * from the LLM so history stays consistent.
 */
export async function deleteMessageCascade(
    userId: string,
    conversationId: string,
    messageId: string,
): Promise<boolean> {
    const msg = await prisma.chatMessage.findFirst({
        where: { id: messageId, conversationId },
        select: { id: true, createdAt: true, conversationId: true },
    });
    if (!msg) return false;

    // Ownership check — the conversation must belong to this user.
    const owned = await prisma.chatConversation.count({
        where: { id: conversationId, userId },
    });
    if (!owned) return false;

    await prisma.$transaction([
        prisma.chatMessage.deleteMany({
            where: {
                conversationId,
                OR: [{ id: messageId }, { createdAt: { gt: msg.createdAt } }],
            },
        }),
        prisma.chatConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        }),
    ]);

    return true;
}

export async function countMessages(conversationId: string): Promise<number> {
    return prisma.chatMessage.count({ where: { conversationId } });
}

// ─── Daily limit (timezone-aware) ────────────────────────────────────────────

export async function getRemaining(userId: string, _timezone: string): Promise<number> {
  if (isChatUnlimitedUser(userId)) return DAILY_LIMIT;
  const row = await prisma.chatLimit.findUnique({ where: { userId } });
  if (!row || isRollingWindowExpired(row.date)) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - row.count);
}

/** Atomic increment. Resets the rolling 24h window when expired. */
export async function incrementLimit(userId: string, _timezone: string): Promise<void> {
  if (isChatUnlimitedUser(userId)) return;
  const nowIso = new Date().toISOString();
  const row = await prisma.chatLimit.findUnique({ where: { userId } });

  if (!row || isRollingWindowExpired(row.date)) {
    await prisma.chatLimit.upsert({
      where: { userId },
      update: { count: 1, date: nowIso },
      create: { userId, count: 1, date: nowIso },
    });
    return;
  }

  await prisma.chatLimit.update({
    where: { userId },
    data: { count: { increment: 1 } },
  });
}

export async function decrementLimit(userId: string, _timezone: string): Promise<void> {
  if (isChatUnlimitedUser(userId)) return;
  const row = await prisma.chatLimit.findUnique({ where: { userId } });
  if (!row || isRollingWindowExpired(row.date) || row.count <= 0) return;
  await prisma.chatLimit.update({
    where: { userId },
    data: { count: { decrement: 1 } },
  });
}

export async function getResetTimeForUser(userId: string): Promise<Date> {
  const row = await prisma.chatLimit.findUnique({ where: { userId } });
  if (!row || isRollingWindowExpired(row.date)) {
    return new Date(Date.now() + ROLLING_WINDOW_MS);
  }
  return rollingResetAt(row.date);
}

/** @deprecated Use getResetTimeForUser for rolling 24h windows. */
export function getResetTime(_timezone: string): Date {
  return new Date(Date.now() + ROLLING_WINDOW_MS);
}

// ─── Serialization ───────────────────────────────────────────────────────────

export function toMessageDTO(row: {
    id: string;
    role: string;
    text: string;
    createdAt: Date;
}): ChatMessageDTO {
    return {
        id: row.id,
        role: row.role === 'assistant' ? 'ai' : 'user',
        text: row.text,
        createdAt: row.createdAt.toISOString(),
    };
}

export function toConversationDTO(c: ConversationWithLast): ChatConversationDTO {
    return {
        id: c.id,
        title: c.title,
        isPinned: c.pinned,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        lastMessage: c.lastMessage,
    };
}

// ─── Legacy file-store → Prisma migration (best-effort, one-shot) ────────────

import fs from 'fs';
import path from 'path';

interface LegacyConversation {
    id: string;
    userId: string;
    title: string;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
    messages: Array<{ id: string; role: 'user' | 'ai'; text: string; createdAt: string }>;
}

interface LegacyStore {
    conversations?: LegacyConversation[];
    limits?: Record<string, { count: number; date: string }>;
}

const LEGACY_PATH = path.join(process.cwd(), 'data', 'chat', 'chat-store.json');
const LEGACY_ARCHIVE = path.join(process.cwd(), 'data', 'chat', 'chat-store.migrated.json');

/**
 * If chat-store.json exists and has never been migrated, copy its contents
 * into the DB and archive the file. Idempotent — the archive rename prevents
 * re-runs. Safe to call at boot even when there's nothing to migrate.
 */
export async function migrateLegacyFileStore(): Promise<void> {
    if (!fs.existsSync(LEGACY_PATH)) return;

    let parsed: LegacyStore;
    try {
        parsed = JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf-8')) as LegacyStore;
    } catch (err) {
        logger.warn('[chat] legacy store unreadable, skipping migration:', err);
        return;
    }

    const convs = parsed.conversations ?? [];
    const limits = parsed.limits ?? {};

    if (convs.length === 0 && Object.keys(limits).length === 0) {
        try {
            fs.renameSync(LEGACY_PATH, LEGACY_ARCHIVE);
        } catch {
            /* ignore */
        }
        return;
    }

    logger.info(
        `[chat] migrating ${convs.length} conversations + ${Object.keys(limits).length} limits from chat-store.json`,
    );

    let migratedConvs = 0;
    let migratedMsgs = 0;
    for (const c of convs) {
        try {
            // Skip if an id collision already exists (re-run safety).
            const exists = await prisma.chatConversation.findUnique({ where: { id: c.id } });
            if (exists) continue;

            await prisma.$transaction([
                prisma.chatConversation.create({
                    data: {
                        id: c.id,
                        userId: c.userId,
                        title: c.title || 'New conversation',
                        pinned: !!c.isPinned,
                        createdAt: new Date(c.createdAt),
                        updatedAt: new Date(c.updatedAt),
                    },
                }),
                ...(c.messages ?? []).map((m) =>
                    prisma.chatMessage.create({
                        data: {
                            id: m.id,
                            conversationId: c.id,
                            role: m.role === 'ai' ? 'assistant' : 'user',
                            text: m.text,
                            createdAt: new Date(m.createdAt),
                        },
                    }),
                ),
            ]);
            migratedConvs++;
            migratedMsgs += c.messages?.length ?? 0;
        } catch (err) {
            logger.warn(`[chat] failed to migrate conversation ${c.id}:`, err);
        }
    }

    for (const [uid, { count, date }] of Object.entries(limits)) {
        try {
            await prisma.chatLimit.upsert({
                where: { userId: uid },
                update: { count, date },
                create: { userId: uid, count, date },
            });
        } catch (err) {
            logger.warn(`[chat] failed to migrate limit for ${uid}:`, err);
        }
    }

    try {
        fs.renameSync(LEGACY_PATH, LEGACY_ARCHIVE);
        logger.info(
            `[chat] ✅ migrated ${migratedConvs} conversations (${migratedMsgs} messages). Archive: ${LEGACY_ARCHIVE}`,
        );
    } catch (err) {
        logger.warn('[chat] migration finished but archive rename failed:', err);
    }
}
