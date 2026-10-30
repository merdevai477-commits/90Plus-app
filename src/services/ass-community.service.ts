/**
 * AsS desk helpers for community post review.
 * Shared-password session (same as competition ads) — not Clerk admin.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { r2MediaStorage } from './r2-media-storage.service';
import { notifyUser } from './notify.service';
import { redisCacheService } from './redis-cache.service';

const FEED_CACHE_KEY = 'community:feed:first:v2';

export type AssPostFilter = 'all' | 'reported' | 'ai';
export type AssPostOrder = 'newest' | 'oldest';
export type AssContentFilter = AssPostFilter;
export type AssContentOrder = AssPostOrder;

const AI_REASON_MATCH = /(AI|Nemotron|Gemini|image.?safety|SEXUAL|OFF_TOPIC|PROFANITY|GORE|HATE)/i;
const USER_SELECT = {
    id: true,
    username: true,
    displayName: true,
    avatar: true,
    communitySafetyFlag: true,
} as const;

export class AssCommunityError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

export interface AssCommunityPostRow {
    id: string;
    content: string;
    imageUrl: string | null;
    status: string;
    kind: string;
    reportsCount: number;
    likesCount: number;
    commentsCount: number;
    createdAt: string;
    aiFlagged: boolean;
    pendingReports: number;
    user: {
        id: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
        communitySafetyFlag: string | null;
    };
}

async function aiFlaggedIds(contentTypes: string[], limit = 800): Promise<Set<string>> {
    const logs = await prisma.moderationLog.findMany({
        where: {
            contentType: { in: contentTypes },
            action: { in: ['REMOVED', 'FLAGGED', 'BLOCKED'] },
            contentId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { contentId: true, reason: true, detectedWords: true },
    });
    const ids = new Set<string>();
    for (const row of logs) {
        if (!row.contentId) continue;
        const hay = `${row.reason} ${(row.detectedWords || []).join(' ')}`;
        if (AI_REASON_MATCH.test(hay) || /IMAGE_|SCAN_|NSFW/i.test(hay)) ids.add(row.contentId);
    }
    return ids;
}

async function aiFlaggedPostIds(limit = 800): Promise<Set<string>> {
    return aiFlaggedIds(['community_post', 'community_media'], limit);
}

async function aiFlaggedCommentIds(limit = 800): Promise<Set<string>> {
    return aiFlaggedIds(['community_comment'], limit);
}

export interface AssCommunityCommentRow {
    id: string;
    content: string;
    status: string;
    reportsCount: number;
    likesCount: number;
    createdAt: string;
    aiFlagged: boolean;
    pendingReports: number;
    post: {
        id: string;
        content: string;
        imageUrl: string | null;
        status: string;
    };
    user: {
        id: string;
        username: string;
        displayName: string | null;
        avatar: string | null;
        communitySafetyFlag: string | null;
    };
}

export async function listAssCommunityPosts(opts: {
    filter?: AssPostFilter;
    order?: AssPostOrder;
    limit?: number;
}): Promise<AssCommunityPostRow[]> {
    const filter: AssPostFilter = opts.filter === 'reported' || opts.filter === 'ai' ? opts.filter : 'all';
    const order: AssPostOrder = opts.order === 'oldest' ? 'oldest' : 'newest';
    const take = Math.min(Math.max(opts.limit ?? 80, 1), 200);

    const where: {
        status: { in: Array<'ACTIVE' | 'HIDDEN'> };
        reportsCount?: { gt: number };
        id?: { in: string[] };
    } = {
        status: { in: ['ACTIVE', 'HIDDEN'] },
    };

    let aiIds: Set<string> | null = null;
    if (filter === 'reported') {
        where.reportsCount = { gt: 0 };
    } else if (filter === 'ai') {
        aiIds = await aiFlaggedPostIds();
        if (!aiIds.size) return [];
        where.id = { in: [...aiIds] };
    }

    const rows = await prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: order === 'oldest' ? 'asc' : 'desc' },
        take,
        select: {
            id: true,
            content: true,
            imageUrl: true,
            status: true,
            kind: true,
            reportsCount: true,
            likesCount: true,
            commentsCount: true,
            createdAt: true,
            user: { select: USER_SELECT },
            _count: {
                select: { reports: { where: { status: 'PENDING' } } },
            },
        },
    });

    if (!aiIds) aiIds = await aiFlaggedPostIds();

    return rows.map((p) => ({
        id: p.id,
        content: p.content,
        imageUrl: p.imageUrl,
        status: p.status,
        kind: p.kind,
        reportsCount: p.reportsCount,
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        createdAt: p.createdAt.toISOString(),
        aiFlagged: aiIds!.has(p.id),
        pendingReports: p._count.reports,
        user: p.user,
    }));
}

export async function listAssCommunityComments(opts: {
    filter?: AssContentFilter;
    order?: AssContentOrder;
    limit?: number;
}): Promise<AssCommunityCommentRow[]> {
    const filter: AssContentFilter = opts.filter === 'reported' || opts.filter === 'ai' ? opts.filter : 'all';
    const order: AssContentOrder = opts.order === 'oldest' ? 'oldest' : 'newest';
    const take = Math.min(Math.max(opts.limit ?? 80, 1), 200);

    let aiIds: Set<string> | null = null;
    let where: Record<string, unknown> = {
        status: { in: ['ACTIVE', 'HIDDEN'] },
    };

    if (filter === 'reported') {
        where = { ...where, reportsCount: { gt: 0 } };
    } else if (filter === 'ai') {
        aiIds = await aiFlaggedCommentIds();
        if (!aiIds.size) return [];
        where = { ...where, id: { in: [...aiIds] } };
    } else {
        // Default "all" for comments focuses on items that need a human look:
        // reported, hidden, or AI-flagged — not every chatty reply in the app.
        aiIds = await aiFlaggedCommentIds();
        where = {
            status: { in: ['ACTIVE', 'HIDDEN'] },
            OR: [
                { reportsCount: { gt: 0 } },
                { status: 'HIDDEN' },
                ...(aiIds.size ? [{ id: { in: [...aiIds] } }] : []),
            ],
        };
    }

    const rows = await prisma.communityComment.findMany({
        where: where as any,
        orderBy: { createdAt: order === 'oldest' ? 'asc' : 'desc' },
        take,
        select: {
            id: true,
            content: true,
            status: true,
            reportsCount: true,
            likesCount: true,
            createdAt: true,
            user: { select: USER_SELECT },
            post: {
                select: {
                    id: true,
                    content: true,
                    imageUrl: true,
                    status: true,
                },
            },
            _count: {
                select: { reports: { where: { status: 'PENDING' } } },
            },
        },
    });

    if (!aiIds) aiIds = await aiFlaggedCommentIds();

    return rows.map((c) => ({
        id: c.id,
        content: c.content,
        status: c.status,
        reportsCount: c.reportsCount,
        likesCount: c.likesCount,
        createdAt: c.createdAt.toISOString(),
        aiFlagged: aiIds!.has(c.id),
        pendingReports: c._count.reports,
        post: c.post,
        user: c.user,
    }));
}

/**
 * Immediately soft-deletes a community post, issues a UserWarning, resolves
 * pending reports, and notifies the author. Reason is optional.
 */
export async function assDeleteCommunityPost(
    postId: string,
    reasonRaw?: string | null,
): Promise<{ id: string }> {
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 500) : '';
    const post = await prisma.communityPost.findUnique({
        where: { id: postId },
        select: {
            id: true,
            userId: true,
            status: true,
            imageStoragePath: true,
            content: true,
        },
    });
    if (!post || post.status === 'DELETED') {
        throw new AssCommunityError(404, 'POST_NOT_FOUND', 'Post not found');
    }

    const warningReason =
        reason || 'Community post removed by moderators for violating community guidelines';

    await prisma.$transaction(async (tx) => {
        await tx.communityPost.update({
            where: { id: post.id },
            data: { status: 'DELETED' },
        });
        await tx.moderationLog.create({
            data: {
                userId: post.userId,
                contentType: 'community_post',
                contentId: post.id,
                action: 'REMOVED',
                reason: reason ? `AsS: ${reason}` : 'AsS: removed by moderator',
                detectedWords: reason ? [reason.slice(0, 80)] : [],
                severity: 'high',
                metadata: { source: 'ass', optionalReason: reason || null } as any,
            },
        });
        await tx.userWarning.create({
            data: {
                userId: post.userId,
                reason: warningReason,
                severity: 'HIGH',
                issuedBy: null,
            },
        });
        await tx.user.update({
            where: { id: post.userId },
            data: { warningsCount: { increment: 1 } },
        });
        await tx.report.updateMany({
            where: { reportedCommunityPostId: post.id, status: 'PENDING' },
            data: {
                status: 'RESOLVED',
                action: 'CONTENT_REMOVED',
                reviewedAt: new Date(),
            },
        });
        await tx.moderationLog.create({
            data: {
                userId: post.userId,
                contentType: 'community_post',
                contentId: post.id,
                action: 'WARNING_ISSUED',
                reason: warningReason,
                severity: 'high',
                metadata: { source: 'ass' } as any,
            },
        });
    });

    await redisCacheService.del(FEED_CACHE_KEY).catch(() => undefined);

    if (post.imageStoragePath) {
        const key = post.imageStoragePath;
        void r2MediaStorage.deleteObject(key).catch((err: any) => {
            logger.warn('[AsS] R2 cleanup failed:', err?.message);
        });
    }

    const hasReason = !!reason;
    void notifyUser({
        userId: post.userId,
        type: 'MODERATION_ALERT',
        titleKey: 'communityPostDeletedTitle',
        bodyKey: hasReason ? 'communityPostDeletedBodyWithReason' : 'communityPostDeletedBody',
        vars: hasReason ? { reason } : {},
        data: {
            screen: '/(tabs)/community',
            kind: 'community',
            contentKind: 'post',
            contentId: post.id,
            action: 'deleted',
        },
        bypassPreferences: true,
    }).catch((err: any) => logger.warn('[AsS] notify failed:', err?.message));

    logger.warn('[AsS] community post deleted', { postId: post.id, userId: post.userId, hasReason });
    return { id: post.id };
}

/**
 * Immediately soft-deletes a community comment, issues a UserWarning, resolves
 * pending reports, and notifies the author. Reason is optional.
 */
export async function assDeleteCommunityComment(
    commentId: string,
    reasonRaw?: string | null,
): Promise<{ id: string }> {
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 500) : '';
    const comment = await prisma.communityComment.findUnique({
        where: { id: commentId },
        select: {
            id: true,
            userId: true,
            postId: true,
            status: true,
            content: true,
        },
    });
    if (!comment || comment.status === 'DELETED') {
        throw new AssCommunityError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }

    const warningReason =
        reason || 'Community comment removed by moderators for violating community guidelines';

    await prisma.$transaction(async (tx) => {
        await tx.communityComment.update({
            where: { id: comment.id },
            data: { status: 'DELETED' },
        });
        await tx.communityPost.updateMany({
            where: { id: comment.postId, commentsCount: { gt: 0 } },
            data: { commentsCount: { decrement: 1 } },
        });
        await tx.moderationLog.create({
            data: {
                userId: comment.userId,
                contentType: 'community_comment',
                contentId: comment.id,
                action: 'REMOVED',
                reason: reason ? `AsS: ${reason}` : 'AsS: removed by moderator',
                detectedWords: reason ? [reason.slice(0, 80)] : [],
                severity: 'high',
                metadata: { source: 'ass', optionalReason: reason || null, postId: comment.postId } as any,
            },
        });
        await tx.userWarning.create({
            data: {
                userId: comment.userId,
                reason: warningReason,
                severity: 'HIGH',
                issuedBy: null,
            },
        });
        await tx.user.update({
            where: { id: comment.userId },
            data: { warningsCount: { increment: 1 } },
        });
        await tx.report.updateMany({
            where: { reportedCommunityCommentId: comment.id, status: 'PENDING' },
            data: {
                status: 'RESOLVED',
                action: 'CONTENT_REMOVED',
                reviewedAt: new Date(),
            },
        });
        await tx.moderationLog.create({
            data: {
                userId: comment.userId,
                contentType: 'community_comment',
                contentId: comment.id,
                action: 'WARNING_ISSUED',
                reason: warningReason,
                severity: 'high',
                metadata: { source: 'ass' } as any,
            },
        });
    });

    await redisCacheService.del(FEED_CACHE_KEY).catch(() => undefined);

    const hasReason = !!reason;
    void notifyUser({
        userId: comment.userId,
        type: 'MODERATION_ALERT',
        titleKey: 'communityCommentDeletedTitle',
        bodyKey: hasReason ? 'communityCommentDeletedBodyWithReason' : 'communityCommentDeletedBody',
        vars: hasReason ? { reason } : {},
        data: {
            screen: '/(tabs)/community',
            kind: 'community',
            contentKind: 'comment',
            contentId: comment.id,
            postId: comment.postId,
            action: 'deleted',
        },
        bypassPreferences: true,
    }).catch((err: any) => logger.warn('[AsS] notify failed:', err?.message));

    logger.warn('[AsS] community comment deleted', {
        commentId: comment.id,
        userId: comment.userId,
        hasReason,
    });
    return { id: comment.id };
}
