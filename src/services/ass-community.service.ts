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

const AI_REASON_MATCH = /(AI|Nemotron|Gemini|image.?safety|SEXUAL|OFF_TOPIC|PROFANITY|GORE|HATE)/i;

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

async function aiFlaggedPostIds(limit = 800): Promise<Set<string>> {
    const logs = await prisma.moderationLog.findMany({
        where: {
            contentType: { in: ['community_post', 'community_media'] },
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
            user: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatar: true,
                    communitySafetyFlag: true,
                },
            },
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
