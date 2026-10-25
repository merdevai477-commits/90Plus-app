/**
 * Community (المجتمع) — Threads-style feed.
 *
 * Owns every write path so counters, moderation, notifications and caches
 * stay consistent no matter which route triggered the change.
 */

import { Prisma, CommunityContentStatus, ReportType } from '@prisma/client';
import sharp from 'sharp';
import prisma from '../lib/prisma';
import { getRedisClient, isRedisConnected } from '../lib/redis';
import { logger } from '../utils/logger';
import { ensureBackendUserId } from '../utils/ensureBackendUser';
import { redisCacheService } from './redis-cache.service';
import { r2MediaStorage } from './r2-media-storage.service';
import { notifyUser } from './notify.service';
import type { PushTemplateKey } from './push-templates.service';
import {
    checkCommunityText,
    enqueueCommunityAiModeration,
    recordBlockedAttempt,
    registerCommunityHideHandler,
    type CommunityContentKind,
} from './community-moderation.service';
import { classifyCommunityImage, type CommunityImageVerdict } from './community-image-safety';
import {
    consumeCommunityRate,
    MAX_COMMENTS_PER_USER_PER_POST,
    type CommunityAction,
} from './community-rate-limit.service';
import {
    COMMENT_MAX_LENGTH,
    decodeCursor,
    encodeCursor,
    extractHashtags,
    extractMentions,
    normalizeCommunityText,
    POST_MAX_LENGTH,
} from './community-text';

// ─── Errors ───────────────────────────────────────────────────────────────

export class CommunityError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
        public extra: Record<string, unknown> = {},
    ) {
        super(message);
    }
}

// ─── Actor resolution ─────────────────────────────────────────────────────

export interface CommunityActor {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    isSuspended: boolean;
    suspendedUntil: Date | null;
}

const actorCache = new Map<string, { actor: CommunityActor; at: number }>();
const ACTOR_TTL_MS = 60_000;

const actorSelect = {
    id: true,
    username: true,
    displayName: true,
    avatar: true,
    isSuspended: true,
    suspendedUntil: true,
} as const;

export async function resolveActor(clerkUserId: string): Promise<CommunityActor> {
    const hit = actorCache.get(clerkUserId);
    if (hit && Date.now() - hit.at < ACTOR_TTL_MS) return hit.actor;

    let user = await prisma.user.findUnique({ where: { clerkUserId }, select: actorSelect });
    if (!user) {
        const id = await ensureBackendUserId(clerkUserId);
        user = await prisma.user.findUnique({ where: { id }, select: actorSelect });
    }
    if (!user) throw new CommunityError(404, 'USER_NOT_FOUND', 'User not found');

    actorCache.set(clerkUserId, { actor: user, at: Date.now() });
    if (actorCache.size > 5000) actorCache.delete(actorCache.keys().next().value as string);
    return user;
}

function assertCanWrite(actor: CommunityActor): void {
    if (actor.isSuspended && (!actor.suspendedUntil || actor.suspendedUntil > new Date())) {
        throw new CommunityError(403, 'ACCOUNT_SUSPENDED', 'Your account is temporarily restricted from posting.', {
            until: actor.suspendedUntil?.toISOString() ?? null,
        });
    }
}

async function claimRate(action: CommunityAction, userId: string): Promise<void> {
    const verdict = await consumeCommunityRate(action, userId);
    if (!verdict.allowed) {
        throw new CommunityError(429, action === 'post' ? 'POST_COOLDOWN' : action === 'comment' ? 'COMMENT_COOLDOWN' : 'MEDIA_COOLDOWN', 'Slow down', {
            retryAfterSec: verdict.retryAfterSec,
            reason: verdict.reason,
        });
    }
}

async function moderateOrThrow(userId: string, kind: CommunityContentKind, text: string): Promise<void> {
    const verdict = checkCommunityText(text);
    if (verdict.ok) return;
    void recordBlockedAttempt(userId, kind, verdict);
    throw new CommunityError(422, verdict.code, verdict.code === 'PROFANITY_DETECTED' ? 'Content violates community guidelines' : 'Content looks like spam');
}

function rejectUnsafeImage(userId: string, imageSafety: Extract<CommunityImageVerdict, { safe: false }>): never {
    const scanFailed = imageSafety.categories.some((c) => c === 'SCAN_FAILED' || c === 'SCAN_UNAVAILABLE');
    void prisma.moderationLog
        .create({
            data: {
                userId,
                contentType: 'community_media',
                action: 'BLOCKED',
                reason: scanFailed ? 'IMAGE_SCAN_FAILED' : 'IMAGE_REJECTED',
                detectedWords: imageSafety.categories.slice(0, 10),
                severity: 'high',
            },
        })
        .catch(() => undefined);
    if (scanFailed) throw new CommunityError(503, 'IMAGE_SCAN_FAILED', 'Could not verify the image');
    throw new CommunityError(422, 'IMAGE_REJECTED', 'Image violates community guidelines');
}

async function assertImageBufferSafe(userId: string, buffer: Buffer): Promise<void> {
    const imageSafety = await classifyCommunityImage(buffer);
    if (!imageSafety.safe) rejectUnsafeImage(userId, imageSafety);
}

async function assertRemoteImageSafe(userId: string, url: string): Promise<void> {
    let buffer: Buffer;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
        if (!res.ok) throw new Error(`http ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
    } catch {
        throw new CommunityError(503, 'IMAGE_SCAN_FAILED', 'Could not verify the image');
    }
    await assertImageBufferSafe(userId, buffer);
}

// ─── Blocks ───────────────────────────────────────────────────────────────

const blockCache = new Map<string, { ids: Set<string>; at: number }>();
const BLOCK_TTL_MS = 30_000;

async function blockedPairIds(userId: string): Promise<Set<string>> {
    const hit = blockCache.get(userId);
    if (hit && Date.now() - hit.at < BLOCK_TTL_MS) return hit.ids;
    const rows = await prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
    });
    const ids = new Set<string>();
    for (const r of rows) ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
    blockCache.set(userId, { ids, at: Date.now() });
    if (blockCache.size > 5000) blockCache.delete(blockCache.keys().next().value as string);
    return ids;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────

const authorSelect = {
    id: true,
    username: true,
    displayName: true,
    avatar: true,
    isVerified: true,
} as const;

const postSelect = {
    id: true,
    userId: true,
    content: true,
    imageUrl: true,
    imageWidth: true,
    imageHeight: true,
    imagePlaceholder: true,
    likesCount: true,
    commentsCount: true,
    sharesCount: true,
    createdAt: true,
    user: { select: authorSelect },
} satisfies Prisma.CommunityPostSelect;

type PostRow = Prisma.CommunityPostGetPayload<{ select: typeof postSelect }>;

export interface CommunityAuthorDto {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    isVerified: boolean;
}

export interface CommunityPostDto {
    id: string;
    content: string;
    createdAt: string;
    image: { url: string; width: number; height: number; placeholder: string | null } | null;
    author: CommunityAuthorDto;
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    likedByMe: boolean;
    isMine: boolean;
}

function toPostDto(row: PostRow, viewerId: string, liked: Set<string>): CommunityPostDto {
    return {
        id: row.id,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        image: row.imageUrl
            ? {
                  url: row.imageUrl,
                  width: row.imageWidth ?? 1080,
                  height: row.imageHeight ?? 1080,
                  placeholder: row.imagePlaceholder,
              }
            : null,
        author: row.user,
        likesCount: row.likesCount,
        commentsCount: row.commentsCount,
        sharesCount: row.sharesCount,
        likedByMe: liked.has(row.id),
        isMine: row.userId === viewerId,
    };
}

const commentSelect = {
    id: true,
    postId: true,
    userId: true,
    parentId: true,
    content: true,
    likesCount: true,
    repliesCount: true,
    createdAt: true,
    user: { select: authorSelect },
} satisfies Prisma.CommunityCommentSelect;

type CommentRow = Prisma.CommunityCommentGetPayload<{ select: typeof commentSelect }>;

export interface CommunityCommentDto {
    id: string;
    postId: string;
    parentId: string | null;
    content: string;
    createdAt: string;
    author: CommunityAuthorDto;
    likesCount: number;
    repliesCount: number;
    likedByMe: boolean;
    isMine: boolean;
    replies?: CommunityCommentDto[];
}

function toCommentDto(row: CommentRow, viewerId: string, liked: Set<string>): CommunityCommentDto {
    return {
        id: row.id,
        postId: row.postId,
        parentId: row.parentId,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        author: row.user,
        likesCount: row.likesCount,
        repliesCount: row.repliesCount,
        likedByMe: liked.has(row.id),
        isMine: row.userId === viewerId,
    };
}

async function likedPostIds(viewerId: string, postIds: string[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    const rows = await prisma.communityPostLike.findMany({
        where: { userId: viewerId, postId: { in: postIds } },
        select: { postId: true },
    });
    return new Set(rows.map((r) => r.postId));
}

async function likedCommentIds(viewerId: string, commentIds: string[]): Promise<Set<string>> {
    if (!commentIds.length) return new Set();
    const rows = await prisma.communityCommentLike.findMany({
        where: { userId: viewerId, commentId: { in: commentIds } },
        select: { commentId: true },
    });
    return new Set(rows.map((r) => r.commentId));
}

// ─── Feed ─────────────────────────────────────────────────────────────────

export const FEED_PAGE_SIZE = 15;
const FIRST_PAGE_CACHE_KEY = 'community:feed:first:v1';
const FIRST_PAGE_TTL_MS = 20_000;

export interface FeedPage<T> {
    items: T[];
    nextCursor: string | null;
}

function cursorWhere(cursorRaw: unknown): Prisma.CommunityPostWhereInput {
    const cursor = decodeCursor(cursorRaw);
    if (!cursor) return {};
    return {
        OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
    };
}

async function queryPosts(where: Prisma.CommunityPostWhereInput, limit: number): Promise<{ rows: PostRow[]; nextCursor: string | null }> {
    const rows = await prisma.communityPost.findMany({
        where: { status: 'ACTIVE', ...where },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: postSelect,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return { rows: page, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
}

async function finishPostPage(rows: PostRow[], viewerId: string, nextCursor: string | null): Promise<FeedPage<CommunityPostDto>> {
    const blocked = await blockedPairIds(viewerId);
    const visible = blocked.size ? rows.filter((r) => !blocked.has(r.userId)) : rows;
    const liked = await likedPostIds(viewerId, visible.map((r) => r.id));
    return { items: visible.map((r) => toPostDto(r, viewerId, liked)), nextCursor };
}

interface CachedFirstPage {
    rows: (Omit<PostRow, 'createdAt'> & { createdAt: string })[];
    nextCursor: string | null;
}

export async function getFeed(viewerId: string, cursor: unknown, limit = FEED_PAGE_SIZE): Promise<FeedPage<CommunityPostDto>> {
    const isFirstPage = !decodeCursor(cursor) && limit === FEED_PAGE_SIZE;
    if (isFirstPage) {
        const cached = await redisCacheService.get<CachedFirstPage>(FIRST_PAGE_CACHE_KEY).catch(() => null);
        if (cached) {
            const rows = cached.rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
            return finishPostPage(rows, viewerId, cached.nextCursor);
        }
    }
    const { rows, nextCursor } = await queryPosts(cursorWhere(cursor), limit);
    if (isFirstPage) {
        const toCache: CachedFirstPage = {
            rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
            nextCursor,
        };
        void redisCacheService.set(FIRST_PAGE_CACHE_KEY, toCache, FIRST_PAGE_TTL_MS).catch(() => undefined);
    }
    return finishPostPage(rows, viewerId, nextCursor);
}

export async function invalidateFeedCache(): Promise<void> {
    await redisCacheService.del(FIRST_PAGE_CACHE_KEY).catch(() => undefined);
}

export async function getUserPosts(viewerId: string, username: string, cursor: unknown): Promise<FeedPage<CommunityPostDto> & { author: CommunityAuthorDto | null }> {
    const author = await prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
        select: authorSelect,
    });
    if (!author) return { items: [], nextCursor: null, author: null };
    const blocked = await blockedPairIds(viewerId);
    if (blocked.has(author.id)) return { items: [], nextCursor: null, author };
    const { rows, nextCursor } = await queryPosts({ userId: author.id, ...cursorWhere(cursor) }, FEED_PAGE_SIZE);
    const page = await finishPostPage(rows, viewerId, nextCursor);
    return { ...page, author };
}

export async function getHashtagPosts(viewerId: string, tagRaw: string, cursor: unknown): Promise<FeedPage<CommunityPostDto> & { tag: string; postsCount: number }> {
    const tag = tagRaw.replace(/^#/, '').trim().toLowerCase();
    if (!tag) return { items: [], nextCursor: null, tag, postsCount: 0 };
    const hashtag = await prisma.hashtag.findUnique({ where: { name: tag }, select: { id: true } });
    if (!hashtag) return { items: [], nextCursor: null, tag, postsCount: 0 };
    const [{ rows, nextCursor }, postsCount] = await Promise.all([
        queryPosts({ hashtags: { some: { hashtagId: hashtag.id } }, ...cursorWhere(cursor) }, FEED_PAGE_SIZE),
        prisma.communityPostHashtag.count({ where: { hashtagId: hashtag.id, post: { status: 'ACTIVE' } } }),
    ]);
    const page = await finishPostPage(rows, viewerId, nextCursor);
    return { ...page, tag, postsCount };
}

const TRENDING_CACHE_KEY = 'community:trending:v1';

export async function getTrendingHashtags(): Promise<{ tag: string; count: number }[]> {
    const cached = await redisCacheService.get<{ tag: string; count: number }[]>(TRENDING_CACHE_KEY).catch(() => null);
    if (cached) return cached;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const groups = await prisma.communityPostHashtag.groupBy({
        by: ['hashtagId'],
        where: { createdAt: { gte: since }, post: { status: 'ACTIVE' } },
        _count: { hashtagId: true },
        orderBy: { _count: { hashtagId: 'desc' } },
        take: 12,
    });
    const tags = await prisma.hashtag.findMany({
        where: { id: { in: groups.map((g) => g.hashtagId) } },
        select: { id: true, name: true },
    });
    const byId = new Map(tags.map((t) => [t.id, t.name]));
    const result = groups
        .map((g) => ({ tag: byId.get(g.hashtagId) ?? '', count: g._count.hashtagId }))
        .filter((t) => t.tag);
    void redisCacheService.set(TRENDING_CACHE_KEY, result, 5 * 60_000).catch(() => undefined);
    return result;
}

export async function getPost(viewerId: string, postId: string): Promise<CommunityPostDto> {
    const row = await prisma.communityPost.findFirst({
        where: { id: postId, status: 'ACTIVE' },
        select: postSelect,
    });
    if (!row) throw new CommunityError(404, 'POST_NOT_FOUND', 'Post not found');
    const blocked = await blockedPairIds(viewerId);
    if (blocked.has(row.userId)) throw new CommunityError(404, 'POST_NOT_FOUND', 'Post not found');
    const liked = await likedPostIds(viewerId, [row.id]);
    return toPostDto(row, viewerId, liked);
}

// ─── Media ────────────────────────────────────────────────────────────────

const MEDIA_MAX_EDGE = 1440;

export interface CommunityMediaDto {
    id: string;
    url: string;
    width: number;
    height: number;
    placeholder: string | null;
}

export async function uploadMedia(actor: CommunityActor, file: { buffer: Buffer; originalname: string }): Promise<CommunityMediaDto> {
    assertCanWrite(actor);
    await claimRate('media', actor.id);

    let output: { data: Buffer; info: sharp.OutputInfo };
    let placeholder: string | null = null;
    try {
        const pipeline = sharp(file.buffer, { failOn: 'error' }).rotate();
        output = await pipeline
            .clone()
            .resize(MEDIA_MAX_EDGE, MEDIA_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80, effort: 3 })
            .toBuffer({ resolveWithObject: true });
        const tiny = await sharp(output.data).resize(16, 16, { fit: 'inside' }).webp({ quality: 30 }).toBuffer();
        placeholder = `data:image/webp;base64,${tiny.toString('base64')}`;
    } catch (err: any) {
        throw new CommunityError(400, 'INVALID_IMAGE', 'Image is corrupted or unsupported', { detail: err?.message });
    }

    await assertImageBufferSafe(actor.id, output.data);

    const baseName = (file.originalname || 'image').replace(/\.[^.]+$/, '').slice(0, 40) || 'image';
    const result = await r2MediaStorage.uploadPublic('community', actor.id, output.data, `${baseName}.webp`, 'image/webp');
    if (!result.success || !result.url || !result.key) {
        throw new CommunityError(502, 'STORAGE_UPLOAD_FAILED', result.error || 'Upload failed');
    }

    const media = await prisma.communityMedia.create({
        data: {
            userId: actor.id,
            url: result.url,
            storagePath: result.key,
            width: output.info.width,
            height: output.info.height,
            placeholder,
            sizeBytes: output.data.length,
        },
        select: { id: true, url: true, width: true, height: true, placeholder: true },
    });
    return media;
}

/** Deletes images that were uploaded but never attached to a post. */
export async function sweepOrphanMedia(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await prisma.communityMedia.findMany({
        where: { attachedAt: null, createdAt: { lt: cutoff } },
        select: { id: true, storagePath: true },
        take: 200,
    });
    for (const m of stale) {
        await r2MediaStorage.deleteObject(m.storagePath).catch(() => false);
    }
    if (stale.length) {
        await prisma.communityMedia.deleteMany({ where: { id: { in: stale.map((m) => m.id) } } });
    }
    return stale.length;
}

let janitor: NodeJS.Timeout | null = null;

export function startCommunityJanitor(): void {
    if (janitor) return;
    janitor = setInterval(() => {
        sweepOrphanMedia().catch((err) => logger.warn('[community] orphan sweep failed:', err?.message));
    }, 60 * 60 * 1000);
    janitor.unref?.();
}

// ─── Hashtags / mentions ──────────────────────────────────────────────────

async function resolveMentionedUsers(text: string, excludeUserId: string): Promise<{ id: string; username: string }[]> {
    const names = extractMentions(text);
    if (!names.length) return [];
    const users = await prisma.user.findMany({
        where: { OR: names.map((n) => ({ username: { equals: n, mode: 'insensitive' as const } })) },
        select: { id: true, username: true },
        take: names.length,
    });
    return users.filter((u) => u.id !== excludeUserId);
}

async function upsertHashtagIds(tx: Prisma.TransactionClient, tags: string[]): Promise<string[]> {
    if (!tags.length) return [];
    await tx.hashtag.createMany({ data: tags.map((name) => ({ name })), skipDuplicates: true });
    const rows = await tx.hashtag.findMany({ where: { name: { in: tags } }, select: { id: true } });
    return rows.map((r) => r.id);
}

export async function searchMentionUsers(viewerId: string, qRaw: string): Promise<CommunityAuthorDto[]> {
    const q = qRaw.replace(/^@/, '').trim();
    if (!q) return [];
    const blocked = await blockedPairIds(viewerId);
    const users = await prisma.user.findMany({
        where: {
            isBanned: false,
            OR: [
                { username: { startsWith: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
            ],
        },
        select: authorSelect,
        orderBy: [{ isVerified: 'desc' }, { username: 'asc' }],
        take: 12,
    });
    return users.filter((u) => u.id !== viewerId && !blocked.has(u.id)).slice(0, 8);
}

// ─── Notifications ────────────────────────────────────────────────────────

type CommunityNotifType = 'LIKE' | 'COMMENT' | 'REPLY' | 'COMMENT_LIKE' | 'SHARE' | 'MENTION';

interface CommunityNotifyInput {
    recipientId: string;
    actor: CommunityActor;
    type: CommunityNotifType;
    target: string;
    titleKey: PushTemplateKey;
    bodyKey: PushTemplateKey;
    postId: string;
    commentId?: string;
    snippet?: string;
}

function snippetOf(text: string, max = 80): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

async function notifyCommunity(input: CommunityNotifyInput): Promise<void> {
    if (input.recipientId === input.actor.id) return;
    try {
        const blocked = await blockedPairIds(input.recipientId);
        if (blocked.has(input.actor.id)) return;
        await notifyUser({
            userId: input.recipientId,
            type: input.type,
            titleKey: input.titleKey,
            bodyKey: input.bodyKey,
            vars: {
                user: input.actor.displayName || input.actor.username,
                content: input.snippet ?? '',
            },
            data: {
                kind: 'community',
                screen: '/community/post/[id]',
                postId: input.postId,
                ...(input.commentId ? { commentId: input.commentId } : {}),
                entityId: input.postId,
                actorId: input.actor.id,
            },
            idempotencyKey: `community:${input.type}:${input.target}:${input.actor.id}`,
            actor: {
                id: input.actor.id,
                username: input.actor.username,
                displayName: input.actor.displayName,
                avatar: input.actor.avatar,
            },
        });
    } catch (err: any) {
        logger.warn('[community] notify failed', { type: input.type, err: err?.message });
    }
}

function fireAndForget(task: () => Promise<unknown>): void {
    setImmediate(() => {
        task().catch((err) => logger.warn('[community] background task failed:', err?.message));
    });
}

// ─── Posts ────────────────────────────────────────────────────────────────

const CLIENT_ID_TTL_SEC = 10 * 60;

async function rememberedClientPost(userId: string, clientId: string | undefined): Promise<string | null> {
    if (!clientId || !isRedisConnected()) return null;
    try {
        return (await getRedisClient()?.get(`community:client:${userId}:${clientId}`)) ?? null;
    } catch {
        return null;
    }
}

async function rememberClientPost(userId: string, clientId: string | undefined, id: string): Promise<void> {
    if (!clientId || !isRedisConnected()) return;
    try {
        await getRedisClient()?.set(`community:client:${userId}:${clientId}`, id, 'EX', CLIENT_ID_TTL_SEC);
    } catch {
        /* best effort */
    }
}

function cleanClientId(raw: unknown): string | undefined {
    return typeof raw === 'string' && /^[\w-]{6,64}$/.test(raw) ? raw : undefined;
}

export async function createPost(
    actor: CommunityActor,
    input: { content?: unknown; mediaId?: unknown; clientId?: unknown },
): Promise<CommunityPostDto> {
    assertCanWrite(actor);
    const clientId = cleanClientId(input.clientId);
    const existingId = await rememberedClientPost(actor.id, clientId);
    if (existingId) return getPost(actor.id, existingId);

    const content = normalizeCommunityText(input.content);
    const mediaId = typeof input.mediaId === 'string' && input.mediaId ? input.mediaId : null;
    if (!content && !mediaId) throw new CommunityError(400, 'EMPTY_POST', 'Write something or add a photo');
    if (content.length > POST_MAX_LENGTH) {
        throw new CommunityError(400, 'POST_TOO_LONG', `Posts are limited to ${POST_MAX_LENGTH} characters`, { max: POST_MAX_LENGTH });
    }
    if (content) await moderateOrThrow(actor.id, 'post', content);

    const media = mediaId
        ? await prisma.communityMedia.findFirst({
              where: { id: mediaId, userId: actor.id, attachedAt: null },
              select: { id: true, url: true, storagePath: true, width: true, height: true, placeholder: true },
          })
        : null;
    if (mediaId && !media) throw new CommunityError(400, 'MEDIA_NOT_FOUND', 'Image expired, please upload it again');
    if (media) await assertRemoteImageSafe(actor.id, media.url);

    await claimRate('post', actor.id);

    const tags = extractHashtags(content);
    const mentioned = await resolveMentionedUsers(content, actor.id);

    const post = await prisma.$transaction(async (tx) => {
        const created = await tx.communityPost.create({
            data: {
                userId: actor.id,
                content,
                imageUrl: media?.url ?? null,
                imageStoragePath: media?.storagePath ?? null,
                imageWidth: media?.width ?? null,
                imageHeight: media?.height ?? null,
                imagePlaceholder: media?.placeholder ?? null,
            },
            select: postSelect,
        });
        if (media) {
            await tx.communityMedia.update({ where: { id: media.id }, data: { attachedAt: new Date() } });
        }
        const hashtagIds = await upsertHashtagIds(tx, tags);
        if (hashtagIds.length) {
            await tx.communityPostHashtag.createMany({
                data: hashtagIds.map((hashtagId) => ({ postId: created.id, hashtagId })),
                skipDuplicates: true,
            });
        }
        if (mentioned.length) {
            await tx.communityMention.createMany({
                data: mentioned.map((u) => ({ postId: created.id, mentionedUserId: u.id })),
            });
        }
        return created;
    });

    await rememberClientPost(actor.id, clientId, post.id);
    void invalidateFeedCache();
    void enqueueCommunityAiModeration({
        kind: 'post',
        id: post.id,
        userId: actor.id,
        text: content,
        imageUrl: post.imageUrl,
    });

    fireAndForget(async () => {
        await Promise.all(
            mentioned.map((u) =>
                notifyCommunity({
                    recipientId: u.id,
                    actor,
                    type: 'MENTION',
                    target: post.id,
                    titleKey: 'communityMentionTitle',
                    bodyKey: 'communityMentionPostBody',
                    postId: post.id,
                }),
            ),
        );
    });

    return toPostDto(post, actor.id, new Set());
}

export async function deletePost(actor: CommunityActor, postId: string): Promise<void> {
    const post = await prisma.communityPost.findUnique({
        where: { id: postId },
        select: { userId: true, status: true, imageStoragePath: true },
    });
    if (!post || post.status === 'DELETED') throw new CommunityError(404, 'POST_NOT_FOUND', 'Post not found');
    if (post.userId !== actor.id) throw new CommunityError(403, 'FORBIDDEN', 'You can only delete your own posts');
    await prisma.communityPost.update({ where: { id: postId }, data: { status: 'DELETED' } });
    void invalidateFeedCache();
    if (post.imageStoragePath) {
        const key = post.imageStoragePath;
        fireAndForget(() => r2MediaStorage.deleteObject(key));
    }
}

/** Owner-only edit: change text and/or attach a new photo. */
export async function updatePost(
    actor: CommunityActor,
    postId: string,
    input: { content?: unknown; mediaId?: unknown; removeImage?: unknown },
): Promise<CommunityPostDto> {
    assertCanWrite(actor);
    const existing = await prisma.communityPost.findUnique({
        where: { id: postId },
        select: {
            id: true,
            userId: true,
            status: true,
            content: true,
            imageUrl: true,
            imageStoragePath: true,
            imageWidth: true,
            imageHeight: true,
            imagePlaceholder: true,
        },
    });
    if (!existing || existing.status === 'DELETED') throw new CommunityError(404, 'POST_NOT_FOUND', 'Post not found');
    if (existing.userId !== actor.id) throw new CommunityError(403, 'FORBIDDEN', 'You can only edit your own posts');

    const hasContent = Object.prototype.hasOwnProperty.call(input, 'content');
    const content = hasContent ? normalizeCommunityText(input.content) : existing.content;
    const mediaId = typeof input.mediaId === 'string' && input.mediaId ? input.mediaId : null;
    const removeImage = input.removeImage === true || input.removeImage === 'true';

    if (hasContent) {
        if (content.length > POST_MAX_LENGTH) {
            throw new CommunityError(400, 'POST_TOO_LONG', `Posts are limited to ${POST_MAX_LENGTH} characters`, {
                max: POST_MAX_LENGTH,
            });
        }
        if (content) await moderateOrThrow(actor.id, 'post', content);
    }

    const media = mediaId
        ? await prisma.communityMedia.findFirst({
              where: { id: mediaId, userId: actor.id, attachedAt: null },
              select: { id: true, url: true, storagePath: true, width: true, height: true, placeholder: true },
          })
        : null;
    if (mediaId && !media) throw new CommunityError(400, 'MEDIA_NOT_FOUND', 'Image expired, please upload it again');
    if (media) await assertRemoteImageSafe(actor.id, media.url);

    const clearImage = removeImage && !media;
    if (!content && !media && (clearImage || !existing.imageUrl)) {
        throw new CommunityError(400, 'EMPTY_POST', 'Write something or add a photo');
    }

    const oldKey = media || clearImage ? existing.imageStoragePath : null;
    const tags = extractHashtags(content);
    const mentioned = await resolveMentionedUsers(content, actor.id);

    const post = await prisma.$transaction(async (tx) => {
        const updated = await tx.communityPost.update({
            where: { id: postId },
            data: {
                content,
                ...(media
                    ? {
                          imageUrl: media.url,
                          imageStoragePath: media.storagePath,
                          imageWidth: media.width,
                          imageHeight: media.height,
                          imagePlaceholder: media.placeholder,
                      }
                    : clearImage
                      ? {
                            imageUrl: null,
                            imageStoragePath: null,
                            imageWidth: null,
                            imageHeight: null,
                            imagePlaceholder: null,
                        }
                      : {}),
            },
            select: postSelect,
        });
        if (media) {
            await tx.communityMedia.update({ where: { id: media.id }, data: { attachedAt: new Date() } });
        }
        if (hasContent) {
            await tx.communityPostHashtag.deleteMany({ where: { postId } });
            await tx.communityMention.deleteMany({ where: { postId } });
            const hashtagIds = await upsertHashtagIds(tx, tags);
            if (hashtagIds.length) {
                await tx.communityPostHashtag.createMany({
                    data: hashtagIds.map((hashtagId) => ({ postId, hashtagId })),
                    skipDuplicates: true,
                });
            }
            if (mentioned.length) {
                await tx.communityMention.createMany({
                    data: mentioned.map((u) => ({ postId, mentionedUserId: u.id })),
                });
            }
        }
        return updated;
    });

    void invalidateFeedCache();
    const newKey = media?.storagePath ?? (clearImage ? null : oldKey);
    if (oldKey && oldKey !== newKey) {
        fireAndForget(() => r2MediaStorage.deleteObject(oldKey));
    }
    if (hasContent || media) {
        void enqueueCommunityAiModeration({
            kind: 'post',
            id: post.id,
            userId: actor.id,
            text: post.content,
            imageUrl: post.imageUrl,
        });
    }
    return getPost(actor.id, post.id);
}

async function hidePost(postId: string): Promise<boolean> {
    const res = await prisma.communityPost.updateMany({
        where: { id: postId, status: 'ACTIVE' },
        data: { status: 'HIDDEN' },
    });
    if (res.count) await invalidateFeedCache();
    return res.count > 0;
}

async function activePostOrThrow(postId: string): Promise<{ id: string; userId: string; content: string }> {
    const post = await prisma.communityPost.findFirst({
        where: { id: postId, status: 'ACTIVE' },
        select: { id: true, userId: true, content: true },
    });
    if (!post) throw new CommunityError(404, 'POST_NOT_FOUND', 'Post not found');
    return post;
}

function isUniqueViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function likePost(actor: CommunityActor, postId: string): Promise<{ likesCount: number; liked: true }> {
    const post = await activePostOrThrow(postId);
    let created = false;
    try {
        await prisma.$transaction([
            prisma.communityPostLike.create({ data: { userId: actor.id, postId } }),
            prisma.communityPost.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } }),
        ]);
        created = true;
    } catch (err) {
        if (!isUniqueViolation(err)) throw err;
    }
    const { likesCount } = await prisma.communityPost.findUniqueOrThrow({ where: { id: postId }, select: { likesCount: true } });
    if (created) {
        fireAndForget(() =>
            notifyCommunity({
                recipientId: post.userId,
                actor,
                type: 'LIKE',
                target: postId,
                titleKey: 'communityLikeTitle',
                bodyKey: 'communityLikeBody',
                postId,
            }),
        );
    }
    return { likesCount, liked: true };
}

export async function unlikePost(actor: CommunityActor, postId: string): Promise<{ likesCount: number; liked: false }> {
    const removed = await prisma.communityPostLike.deleteMany({ where: { userId: actor.id, postId } });
    if (removed.count) {
        await prisma.communityPost.updateMany({
            where: { id: postId, likesCount: { gt: 0 } },
            data: { likesCount: { decrement: 1 } },
        });
    }
    const row = await prisma.communityPost.findUnique({ where: { id: postId }, select: { likesCount: true } });
    return { likesCount: row?.likesCount ?? 0, liked: false };
}

const SHARE_DEDUPE_MS = 10 * 60 * 1000;

export async function sharePost(actor: CommunityActor, postId: string, platformRaw: unknown): Promise<{ sharesCount: number }> {
    const post = await activePostOrThrow(postId);
    const platform = typeof platformRaw === 'string' ? platformRaw.slice(0, 30) : null;
    const recent = await prisma.communityShare.findFirst({
        where: { userId: actor.id, postId, createdAt: { gte: new Date(Date.now() - SHARE_DEDUPE_MS) } },
        select: { id: true },
    });
    if (!recent) {
        await prisma.$transaction([
            prisma.communityShare.create({ data: { userId: actor.id, postId, platform } }),
            prisma.communityPost.update({ where: { id: postId }, data: { sharesCount: { increment: 1 } } }),
        ]);
        fireAndForget(() =>
            notifyCommunity({
                recipientId: post.userId,
                actor,
                type: 'SHARE',
                target: postId,
                titleKey: 'communityShareTitle',
                bodyKey: 'communityShareBody',
                postId,
            }),
        );
    }
    const row = await prisma.communityPost.findUniqueOrThrow({ where: { id: postId }, select: { sharesCount: true } });
    return { sharesCount: row.sharesCount };
}

// ─── Comments ─────────────────────────────────────────────────────────────

export const COMMENTS_PAGE_SIZE = 20;
const REPLIES_PREVIEW = 2;

function commentCursorWhere(cursorRaw: unknown, direction: 'asc' | 'desc'): Prisma.CommunityCommentWhereInput {
    const cursor = decodeCursor(cursorRaw);
    if (!cursor) return {};
    const op = direction === 'desc' ? 'lt' : 'gt';
    return {
        OR: [
            { createdAt: { [op]: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { [op]: cursor.id } },
        ],
    };
}

export async function getComments(viewerId: string, postId: string, cursor: unknown): Promise<FeedPage<CommunityCommentDto>> {
    await activePostOrThrow(postId);
    const blocked = await blockedPairIds(viewerId);
    const blockedIds = [...blocked];
    const rows = await prisma.communityComment.findMany({
        where: {
            postId,
            parentId: null,
            status: 'ACTIVE',
            ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
            ...commentCursorWhere(cursor, 'desc'),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: COMMENTS_PAGE_SIZE + 1,
        select: {
            ...commentSelect,
            replies: {
                where: { status: 'ACTIVE', ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}) },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                take: REPLIES_PREVIEW,
                select: commentSelect,
            },
        },
    });
    const hasMore = rows.length > COMMENTS_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, COMMENTS_PAGE_SIZE) : rows;
    const allIds = page.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
    const liked = await likedCommentIds(viewerId, allIds);
    const last = page[page.length - 1];
    return {
        items: page.map(({ replies, ...c }) => ({
            ...toCommentDto(c, viewerId, liked),
            replies: replies.map((r) => toCommentDto(r, viewerId, liked)),
        })),
        nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
}

export async function getReplies(viewerId: string, commentId: string, cursor: unknown): Promise<FeedPage<CommunityCommentDto>> {
    const blocked = await blockedPairIds(viewerId);
    const blockedIds = [...blocked];
    const rows = await prisma.communityComment.findMany({
        where: {
            parentId: commentId,
            status: 'ACTIVE',
            ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
            ...commentCursorWhere(cursor, 'asc'),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: COMMENTS_PAGE_SIZE + 1,
        select: commentSelect,
    });
    const hasMore = rows.length > COMMENTS_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, COMMENTS_PAGE_SIZE) : rows;
    const liked = await likedCommentIds(viewerId, page.map((r) => r.id));
    const last = page[page.length - 1];
    return {
        items: page.map((r) => toCommentDto(r, viewerId, liked)),
        nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
}

export async function createComment(
    actor: CommunityActor,
    postId: string,
    input: { content?: unknown; parentId?: unknown },
): Promise<CommunityCommentDto> {
    assertCanWrite(actor);
    const content = normalizeCommunityText(input.content);
    if (!content) throw new CommunityError(400, 'EMPTY_COMMENT', 'Comment cannot be empty');
    if (content.length > COMMENT_MAX_LENGTH) {
        throw new CommunityError(400, 'COMMENT_TOO_LONG', `Comments are limited to ${COMMENT_MAX_LENGTH} characters`, { max: COMMENT_MAX_LENGTH });
    }
    await moderateOrThrow(actor.id, 'comment', content);

    const post = await activePostOrThrow(postId);
    const blocked = await blockedPairIds(actor.id);
    if (blocked.has(post.userId)) throw new CommunityError(403, 'BLOCKED', 'You cannot comment on this post');

    let parent: { id: string; userId: string } | null = null;
    if (typeof input.parentId === 'string' && input.parentId) {
        const target = await prisma.communityComment.findFirst({
            where: { id: input.parentId, postId, status: 'ACTIVE' },
            select: { id: true, userId: true, parentId: true },
        });
        if (!target) throw new CommunityError(404, 'COMMENT_NOT_FOUND', 'The comment you replied to was removed');
        // Threads are one level deep: replying to a reply attaches to its root.
        const rootId = target.parentId ?? target.id;
        parent = { id: rootId, userId: target.userId };
    }

    const perPost = await prisma.communityComment.count({ where: { postId, userId: actor.id, status: { not: 'DELETED' } } });
    if (perPost >= MAX_COMMENTS_PER_USER_PER_POST) {
        throw new CommunityError(429, 'COMMENT_LIMIT_PER_POST', 'You reached the comment limit for this post', { retryAfterSec: 0 });
    }
    await claimRate('comment', actor.id);

    const mentioned = await resolveMentionedUsers(content, actor.id);

    const comment = await prisma.$transaction(async (tx) => {
        const created = await tx.communityComment.create({
            data: { postId, userId: actor.id, parentId: parent?.id ?? null, content },
            select: commentSelect,
        });
        await tx.communityPost.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
        if (parent) {
            await tx.communityComment.update({ where: { id: parent.id }, data: { repliesCount: { increment: 1 } } });
        }
        if (mentioned.length) {
            await tx.communityMention.createMany({
                data: mentioned.map((u) => ({ commentId: created.id, postId, mentionedUserId: u.id })),
            });
        }
        return created;
    });

    void invalidateFeedCache();
    void enqueueCommunityAiModeration({ kind: 'comment', id: comment.id, userId: actor.id, text: content });

    fireAndForget(async () => {
        const snippet = snippetOf(content);
        const notified = new Set<string>([actor.id]);
        if (parent && !notified.has(parent.userId)) {
            notified.add(parent.userId);
            await notifyCommunity({
                recipientId: parent.userId,
                actor,
                type: 'REPLY',
                target: comment.id,
                titleKey: 'communityReplyTitle',
                bodyKey: 'communityReplyBody',
                postId,
                commentId: comment.id,
                snippet,
            });
        }
        if (!notified.has(post.userId)) {
            notified.add(post.userId);
            await notifyCommunity({
                recipientId: post.userId,
                actor,
                type: 'COMMENT',
                target: comment.id,
                titleKey: 'communityCommentTitle',
                bodyKey: 'communityCommentBody',
                postId,
                commentId: comment.id,
                snippet,
            });
        }
        await Promise.all(
            mentioned
                .filter((u) => !notified.has(u.id))
                .map((u) =>
                    notifyCommunity({
                        recipientId: u.id,
                        actor,
                        type: 'MENTION',
                        target: comment.id,
                        titleKey: 'communityMentionTitle',
                        bodyKey: 'communityMentionCommentBody',
                        postId,
                        commentId: comment.id,
                    }),
                ),
        );
    });

    return { ...toCommentDto(comment, actor.id, new Set()), replies: [] };
}

/** Takes a comment out of circulation and keeps every counter in sync. */
async function removeComment(commentId: string, status: Exclude<CommunityContentStatus, 'ACTIVE'>): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
        const c = await tx.communityComment.findUnique({
            where: { id: commentId },
            select: { id: true, postId: true, parentId: true, status: true, repliesCount: true },
        });
        if (!c || c.status !== 'ACTIVE') return false;
        await tx.communityComment.update({ where: { id: commentId }, data: { status } });
        const removedFromPost = 1 + (c.parentId ? 0 : c.repliesCount);
        await tx.$executeRaw`UPDATE community_posts SET "commentsCount" = GREATEST("commentsCount" - ${removedFromPost}, 0) WHERE id = ${c.postId}`;
        if (c.parentId) {
            await tx.$executeRaw`UPDATE community_comments SET "repliesCount" = GREATEST("repliesCount" - 1, 0) WHERE id = ${c.parentId}`;
        }
        return true;
    });
}

export async function deleteComment(actor: CommunityActor, commentId: string): Promise<void> {
    const c = await prisma.communityComment.findUnique({
        where: { id: commentId },
        select: { userId: true, status: true, post: { select: { userId: true } } },
    });
    if (!c || c.status !== 'ACTIVE') throw new CommunityError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    if (c.userId !== actor.id && c.post.userId !== actor.id) {
        throw new CommunityError(403, 'FORBIDDEN', 'You cannot delete this comment');
    }
    await removeComment(commentId, 'DELETED');
    void invalidateFeedCache();
}

export async function likeComment(actor: CommunityActor, commentId: string): Promise<{ likesCount: number; liked: true }> {
    const c = await prisma.communityComment.findFirst({
        where: { id: commentId, status: 'ACTIVE' },
        select: { userId: true, postId: true },
    });
    if (!c) throw new CommunityError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    let created = false;
    try {
        await prisma.$transaction([
            prisma.communityCommentLike.create({ data: { userId: actor.id, commentId } }),
            prisma.communityComment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } }),
        ]);
        created = true;
    } catch (err) {
        if (!isUniqueViolation(err)) throw err;
    }
    const { likesCount } = await prisma.communityComment.findUniqueOrThrow({ where: { id: commentId }, select: { likesCount: true } });
    if (created) {
        fireAndForget(() =>
            notifyCommunity({
                recipientId: c.userId,
                actor,
                type: 'COMMENT_LIKE',
                target: commentId,
                titleKey: 'communityCommentLikeTitle',
                bodyKey: 'communityCommentLikeBody',
                postId: c.postId,
                commentId,
            }),
        );
    }
    return { likesCount, liked: true };
}

export async function unlikeComment(actor: CommunityActor, commentId: string): Promise<{ likesCount: number; liked: false }> {
    const removed = await prisma.communityCommentLike.deleteMany({ where: { userId: actor.id, commentId } });
    if (removed.count) {
        await prisma.communityComment.updateMany({
            where: { id: commentId, likesCount: { gt: 0 } },
            data: { likesCount: { decrement: 1 } },
        });
    }
    const row = await prisma.communityComment.findUnique({ where: { id: commentId }, select: { likesCount: true } });
    return { likesCount: row?.likesCount ?? 0, liked: false };
}

// ─── Reports ──────────────────────────────────────────────────────────────

/** Unique reporters needed to auto-hide content pending review. */
export const AUTO_HIDE_REPORTS = 3;

const REPORT_TYPES = new Set<string>(Object.values(ReportType));

function parseReportType(raw: unknown): ReportType {
    const v = typeof raw === 'string' ? raw.toUpperCase() : '';
    return REPORT_TYPES.has(v) ? (v as ReportType) : 'INAPPROPRIATE';
}

export async function reportContent(
    actor: CommunityActor,
    kind: CommunityContentKind,
    id: string,
    input: { type?: unknown; reason?: unknown },
): Promise<{ reported: true; hidden: boolean }> {
    const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 500) : 'Reported from Community';
    const type = parseReportType(input.type);

    const target =
        kind === 'post'
            ? await prisma.communityPost.findUnique({ where: { id }, select: { userId: true, status: true } })
            : await prisma.communityComment.findUnique({ where: { id }, select: { userId: true, status: true } });
    if (!target || target.status === 'DELETED') throw new CommunityError(404, 'NOT_FOUND', 'Content not found');
    if (target.userId === actor.id) throw new CommunityError(400, 'SELF_REPORT', 'You cannot report your own content');

    const where: Prisma.ReportWhereInput =
        kind === 'post'
            ? { reporterId: actor.id, reportedCommunityPostId: id }
            : { reporterId: actor.id, reportedCommunityCommentId: id };
    const existing = await prisma.report.findFirst({ where, select: { id: true } });
    if (existing) return { reported: true, hidden: target.status === 'HIDDEN' };

    await prisma.report.create({
        data: {
            reporterId: actor.id,
            reportedUserId: target.userId,
            type,
            reason,
            priority: type === 'HARASSMENT' || type === 'INAPPROPRIATE' ? 'HIGH' : 'MEDIUM',
            ...(kind === 'post' ? { reportedCommunityPostId: id } : { reportedCommunityCommentId: id }),
        },
    });

    const reportsCount =
        kind === 'post'
            ? (await prisma.communityPost.update({ where: { id }, data: { reportsCount: { increment: 1 } }, select: { reportsCount: true } })).reportsCount
            : (await prisma.communityComment.update({ where: { id }, data: { reportsCount: { increment: 1 } }, select: { reportsCount: true } })).reportsCount;

    let hidden = target.status === 'HIDDEN';
    if (!hidden && reportsCount >= AUTO_HIDE_REPORTS) {
        hidden = kind === 'post' ? await hidePost(id) : await removeComment(id, 'HIDDEN');
        if (hidden) {
            await prisma.moderationLog
                .create({
                    data: {
                        userId: target.userId,
                        contentType: `community_${kind}`,
                        contentId: id,
                        action: 'FLAGGED',
                        reason: `Auto-hidden after ${reportsCount} reports`,
                        severity: 'medium',
                    },
                })
                .catch(() => undefined);
        }
    }
    return { reported: true, hidden };
}

registerCommunityHideHandler(async (kind, id) => {
    if (kind === 'post') return hidePost(id);
    const hidden = await removeComment(id, 'HIDDEN');
    if (hidden) await invalidateFeedCache();
    return hidden;
});
