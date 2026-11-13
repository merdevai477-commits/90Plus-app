/**
 * AsS desk helpers for reel and reel-comment review.
 * Shared-password session (same as competition ads) — not Clerk admin.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { r2MediaStorage } from './r2-media-storage.service';
import { notifyUser } from './notify.service';
import { redisCacheService } from './redis-cache.service';
import { deleteAsset, getPlaybackUrl, getThumbnailUrl } from './mux.service';

export type AssReelFilter = 'all' | 'reported' | 'ai';
export type AssReelOrder = 'newest' | 'oldest';

const AI_REASON_MATCH = /(AI|Nemotron|Gemini|image.?safety|SEXUAL|OFF_TOPIC|PROFANITY|GORE|HATE)/i;

const USER_SELECT = {
    id: true,
    username: true,
    displayName: true,
    avatar: true,
    communitySafetyFlag: true,
} as const;

export class AssReelError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

export interface AssReelUser {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    communitySafetyFlag: string | null;
}

export interface AssReelRow {
    id: string;
    caption: string | null;
    status: string;
    views: number;
    sharesCount: number;
    likesCount: number;
    commentsCount: number;
    reportsCount: number;
    pendingReports: number;
    createdAt: string;
    aiFlagged: boolean;
    playbackUrl: string | null;
    thumbnailUrl: string | null;
    user: AssReelUser;
}

export interface AssReelCommentRow {
    id: string;
    content: string;
    createdAt: string;
    likesCount: number;
    reportsCount: number;
    pendingReports: number;
    aiFlagged: boolean;
    isReply: boolean;
    parentContent: string | null;
    reel: {
        id: string;
        caption: string | null;
        status: string;
        playbackUrl: string | null;
        thumbnailUrl: string | null;
    };
    user: AssReelUser;
}

function takeOf(limit?: number): number {
    return Math.min(Math.max(limit ?? 80, 1), 200);
}

function normalizeFilter(filter?: string): AssReelFilter {
    return filter === 'reported' || filter === 'ai' ? filter : 'all';
}

function normalizeOrder(order?: string): AssReelOrder {
    return order === 'oldest' ? 'oldest' : 'newest';
}

function mediaFor(reel: {
    muxPlaybackId: string | null;
    videoUrl: string | null;
    thumbnail: string | null;
}): { playbackUrl: string | null; thumbnailUrl: string | null } {
    const playbackUrl = reel.muxPlaybackId
        ? getPlaybackUrl(reel.muxPlaybackId)
        : reel.videoUrl?.trim()
          ? reel.videoUrl
          : null;
    const thumbnailUrl =
        reel.thumbnail?.trim() || (reel.muxPlaybackId ? getThumbnailUrl(reel.muxPlaybackId) : null) || null;
    return { playbackUrl, thumbnailUrl };
}

async function aiFlaggedIds(contentType: string, limit = 800): Promise<Set<string>> {
    const logs = await prisma.moderationLog.findMany({
        where: {
            contentType,
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

async function pendingReportCounts(
    field: 'reportedReelId' | 'reportedCommentId',
    ids: string[],
    reelOnly = false,
): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!ids.length) return map;
    const rows = await prisma.report.groupBy({
        by: [field],
        where: {
            [field]: { in: ids },
            status: 'PENDING',
            ...(reelOnly ? { reportedCommentId: null } : {}),
        },
        _count: { _all: true },
    });
    for (const row of rows) {
        const id = row[field];
        if (id) map.set(id, row._count._all);
    }
    return map;
}

export async function listAssReels(opts: {
    filter?: AssReelFilter;
    order?: AssReelOrder;
    limit?: number;
}): Promise<AssReelRow[]> {
    const filter = normalizeFilter(opts.filter);
    const order = normalizeOrder(opts.order);
    const take = takeOf(opts.limit);

    const where: {
        isDeleted: boolean;
        status: { in: Array<'READY' | 'PROCESSING'> };
        reports?: { some: { reportedCommentId: null; status: { not: 'REJECTED' } } };
        id?: { in: string[] };
    } = {
        isDeleted: false,
        status: { in: ['READY', 'PROCESSING'] },
    };

    let aiIds: Set<string> | null = null;
    if (filter === 'reported') {
        where.reports = { some: { reportedCommentId: null, status: { not: 'REJECTED' } } };
    } else if (filter === 'ai') {
        aiIds = await aiFlaggedIds('reel');
        if (!aiIds.size) return [];
        where.id = { in: [...aiIds] };
    }

    const rows = await prisma.reel.findMany({
        where,
        orderBy: { createdAt: order === 'oldest' ? 'asc' : 'desc' },
        take,
        select: {
            id: true,
            caption: true,
            status: true,
            views: true,
            sharesCount: true,
            createdAt: true,
            videoUrl: true,
            thumbnail: true,
            muxPlaybackId: true,
            user: { select: USER_SELECT },
            _count: {
                select: {
                    likes: true,
                    comments: { where: { isDeleted: false } },
                    reports: {
                        where: { reportedCommentId: null, status: { not: 'REJECTED' } },
                    },
                },
            },
        },
    });

    if (!aiIds) aiIds = await aiFlaggedIds('reel');
    const pending = await pendingReportCounts(
        'reportedReelId',
        rows.map((r) => r.id),
        true,
    );

    return rows.map((reel) => {
        const media = mediaFor(reel);
        return {
            id: reel.id,
            caption: reel.caption,
            status: reel.status,
            views: reel.views,
            sharesCount: reel.sharesCount,
            likesCount: reel._count.likes,
            commentsCount: reel._count.comments,
            reportsCount: reel._count.reports,
            pendingReports: pending.get(reel.id) ?? 0,
            createdAt: reel.createdAt.toISOString(),
            aiFlagged: aiIds!.has(reel.id),
            playbackUrl: media.playbackUrl,
            thumbnailUrl: media.thumbnailUrl,
            user: reel.user,
        };
    });
}

export async function listAssReelComments(opts: {
    filter?: AssReelFilter;
    order?: AssReelOrder;
    limit?: number;
}): Promise<AssReelCommentRow[]> {
    const filter = normalizeFilter(opts.filter);
    const order = normalizeOrder(opts.order);
    const take = takeOf(opts.limit);

    const where: {
        isDeleted: boolean;
        reel: { isDeleted: boolean };
        reports?: { some: { status: { not: 'REJECTED' } } };
        id?: { in: string[] };
    } = {
        isDeleted: false,
        reel: { isDeleted: false },
    };

    let aiIds: Set<string> | null = null;
    if (filter === 'reported') {
        where.reports = { some: { status: { not: 'REJECTED' } } };
    } else if (filter === 'ai') {
        aiIds = await aiFlaggedIds('comment');
        if (!aiIds.size) return [];
        where.id = { in: [...aiIds] };
    }

    const rows = await prisma.comment.findMany({
        where,
        orderBy: { createdAt: order === 'oldest' ? 'asc' : 'desc' },
        take,
        select: {
            id: true,
            content: true,
            createdAt: true,
            parentId: true,
            parent: { select: { content: true, isDeleted: true } },
            user: { select: USER_SELECT },
            reel: {
                select: {
                    id: true,
                    caption: true,
                    status: true,
                    videoUrl: true,
                    thumbnail: true,
                    muxPlaybackId: true,
                },
            },
            _count: {
                select: {
                    likes: true,
                    reports: { where: { status: { not: 'REJECTED' } } },
                },
            },
        },
    });

    if (!aiIds) aiIds = await aiFlaggedIds('comment');
    const pending = await pendingReportCounts(
        'reportedCommentId',
        rows.map((c) => c.id),
    );

    return rows.map((comment) => {
        const media = mediaFor(comment.reel);
        const parentContent = !comment.parent
            ? null
            : comment.parent.isDeleted
              ? null
              : comment.parent.content;
        return {
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt.toISOString(),
            likesCount: comment._count.likes,
            reportsCount: comment._count.reports,
            pendingReports: pending.get(comment.id) ?? 0,
            aiFlagged: aiIds!.has(comment.id),
            isReply: !!comment.parentId,
            parentContent,
            reel: {
                id: comment.reel.id,
                caption: comment.reel.caption,
                status: comment.reel.status,
                playbackUrl: media.playbackUrl,
                thumbnailUrl: media.thumbnailUrl,
            },
            user: comment.user,
        };
    });
}

async function purgeReelMedia(reel: {
    id: string;
    muxAssetId: string | null;
    videoStoragePath: string | null;
    processedVideoKey: string | null;
    thumbnailStoragePath: string | null;
}): Promise<void> {
    if (reel.muxAssetId) {
        const removed = await deleteAsset(reel.muxAssetId);
        if (removed) {
            await prisma.reel
                .update({ where: { id: reel.id }, data: { muxAssetId: null } })
                .catch((err: any) => logger.warn('[AsS] clear muxAssetId failed:', err?.message));
        }
    } else {
        const paths = [reel.videoStoragePath, reel.processedVideoKey].filter(Boolean) as string[];
        for (const key of paths) {
            const ok = await r2MediaStorage.deleteObject(key);
            if (!ok) logger.warn('[AsS] R2 video cleanup failed:', key);
        }
    }
    if (reel.thumbnailStoragePath) {
        void r2MediaStorage.deleteObject(reel.thumbnailStoragePath).catch((err: any) => {
            logger.warn('[AsS] thumbnail cleanup failed:', err?.message);
        });
    }
}

/**
 * Soft-deletes a reel, removes its video, resolves pending reel reports,
 * warns the author, and notifies them. Does not consume the owner's self-delete quota.
 */
export async function assDeleteReel(reelId: string, reasonRaw?: string | null): Promise<{ id: string }> {
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 500) : '';
    const reel = await prisma.reel.findUnique({
        where: { id: reelId },
        select: {
            id: true,
            userId: true,
            isDeleted: true,
            muxAssetId: true,
            videoStoragePath: true,
            processedVideoKey: true,
            thumbnailStoragePath: true,
            fileSizeBytes: true,
        },
    });
    if (!reel || reel.isDeleted) {
        throw new AssReelError(404, 'REEL_NOT_FOUND', 'Reel not found');
    }

    const warningReason = reason || 'Reel removed by moderators for violating community guidelines';
    const bytes = reel.fileSizeBytes;

    await prisma.$transaction(async (tx) => {
        const updated = await tx.reel.updateMany({
            where: { id: reel.id, isDeleted: false },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                videoUrl: '',
                muxPlaybackId: null,
            },
        });
        if (updated.count !== 1) {
            throw new AssReelError(404, 'REEL_NOT_FOUND', 'Reel not found');
        }
        if (bytes > 0n) {
            await tx.user.update({
                where: { id: reel.userId },
                data: { storageUsedBytes: { decrement: bytes } },
            });
        }
        await tx.moderationLog.create({
            data: {
                userId: reel.userId,
                contentType: 'reel',
                contentId: reel.id,
                action: 'REMOVED',
                reason: reason ? `AsS: ${reason}` : 'AsS: removed by moderator',
                detectedWords: reason ? [reason.slice(0, 80)] : [],
                severity: 'high',
                isAutomatic: false,
                metadata: { source: 'ass', optionalReason: reason || null } as any,
            },
        });
        await tx.userWarning.create({
            data: {
                userId: reel.userId,
                reason: warningReason,
                severity: 'HIGH',
                issuedBy: null,
            },
        });
        await tx.user.update({
            where: { id: reel.userId },
            data: { warningsCount: { increment: 1 } },
        });
        await tx.report.updateMany({
            where: { reportedReelId: reel.id, reportedCommentId: null, status: 'PENDING' },
            data: {
                status: 'RESOLVED',
                action: 'CONTENT_REMOVED',
                reviewedAt: new Date(),
            },
        });
        await tx.moderationLog.create({
            data: {
                userId: reel.userId,
                contentType: 'reel',
                contentId: reel.id,
                action: 'WARNING_ISSUED',
                reason: warningReason,
                severity: 'high',
                isAutomatic: false,
                metadata: { source: 'ass' } as any,
            },
        });
    });

    await purgeReelMedia(reel);
    await Promise.all([
        redisCacheService.delPattern('reels:feed:*').catch(() => undefined),
        redisCacheService.del(`reel:${reel.id}`).catch(() => undefined),
        redisCacheService.del(`reel:${reel.id}:comments`).catch(() => undefined),
    ]);

    const hasReason = !!reason;
    void notifyUser({
        userId: reel.userId,
        type: 'MODERATION_ALERT',
        titleKey: 'reelModeratorDeletedTitle',
        bodyKey: hasReason ? 'reelModeratorDeletedBodyWithReason' : 'reelModeratorDeletedBody',
        vars: hasReason ? { reason } : {},
        data: {
            screen: '/(tabs)/reels',
            kind: 'reel',
            contentKind: 'reel',
            contentId: reel.id,
            action: 'deleted',
        },
        bypassPreferences: true,
    }).catch((err: any) => logger.warn('[AsS] reel notify failed:', err?.message));

    logger.warn('[AsS] reel deleted', { reelId: reel.id, userId: reel.userId, hasReason });
    return { id: reel.id };
}

/**
 * Soft-deletes a reel comment, redacts the text, resolves pending reports,
 * warns the author, and notifies them.
 */
export async function assDeleteReelComment(
    commentId: string,
    reasonRaw?: string | null,
): Promise<{ id: string }> {
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim().slice(0, 500) : '';
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true, userId: true, reelId: true, isDeleted: true },
    });
    if (!comment || comment.isDeleted) {
        throw new AssReelError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }

    const warningReason = reason || 'Reel comment removed by moderators for violating community guidelines';

    await prisma.$transaction(async (tx) => {
        const updated = await tx.comment.updateMany({
            where: { id: comment.id, isDeleted: false },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                content: '[deleted]',
            },
        });
        if (updated.count !== 1) {
            throw new AssReelError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
        }
        await tx.moderationLog.create({
            data: {
                userId: comment.userId,
                contentType: 'comment',
                contentId: comment.id,
                action: 'REMOVED',
                reason: reason ? `AsS: ${reason}` : 'AsS: removed by moderator',
                detectedWords: reason ? [reason.slice(0, 80)] : [],
                severity: 'high',
                isAutomatic: false,
                metadata: { source: 'ass', optionalReason: reason || null, reelId: comment.reelId } as any,
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
            where: { reportedCommentId: comment.id, status: 'PENDING' },
            data: {
                status: 'RESOLVED',
                action: 'CONTENT_REMOVED',
                reviewedAt: new Date(),
            },
        });
        await tx.moderationLog.create({
            data: {
                userId: comment.userId,
                contentType: 'comment',
                contentId: comment.id,
                action: 'WARNING_ISSUED',
                reason: warningReason,
                severity: 'high',
                isAutomatic: false,
                metadata: { source: 'ass' } as any,
            },
        });
    });

    await redisCacheService.del(`reel:${comment.reelId}:comments`).catch(() => undefined);

    const hasReason = !!reason;
    void notifyUser({
        userId: comment.userId,
        type: 'MODERATION_ALERT',
        titleKey: 'reelCommentModeratorDeletedTitle',
        bodyKey: hasReason ? 'reelCommentModeratorDeletedBodyWithReason' : 'reelCommentModeratorDeletedBody',
        vars: hasReason ? { reason } : {},
        data: {
            screen: '/(tabs)/reels',
            kind: 'reel',
            contentKind: 'comment',
            contentId: comment.id,
            reelId: comment.reelId,
            action: 'deleted',
        },
        bypassPreferences: true,
    }).catch((err: any) => logger.warn('[AsS] reel comment notify failed:', err?.message));

    logger.warn('[AsS] reel comment deleted', {
        commentId: comment.id,
        userId: comment.userId,
        hasReason,
    });
    return { id: comment.id };
}
