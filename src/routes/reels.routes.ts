import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { WebSocketService } from '../services/websocket.service';
import { responseCacheMiddleware, clearResponseCache } from '../middleware/responseCache.middleware';
import { lenientLimiter, writeLimiter, strictLimiter } from '../middleware/rateLimit.middleware';
import { redisCacheService } from '../services/redis-cache.service';
import { moderateReelCaption, moderateComment } from '../middleware/content-moderation.middleware';
import { filterUGCContent } from '../middleware/filter-content.middleware';
import { enqueueNotification, enqueueSocialNotification } from '../queues/notification.queue';
import { r2MediaStorage } from '../services/r2-media-storage.service';
import { awardXp } from '../services/xp.service';

const router = Router();

// Helper function to ensure param is string
const ensureString = (param: string | string[] | undefined): string => {
    if (Array.isArray(param)) return param[0];
    return param || '';
};

// Constants
const REEL_UPLOAD_COOLDOWN_DAYS = 1; // تقليل من 3 أيام لـ 1 يوم
const REELS_PER_PAGE = 5;
const MAX_COMMENTS_PREVIEW = 3;

// Cache for reels feed — uses Redis for multi-instance consistency.
// Falls back to in-process Map if Redis is unavailable.
const feedCacheFallback = new Map<string, { data: any; timestamp: number }>();
const FEED_CACHE_TTL = 180 * 1000; // 180 seconds (3 minutes)
const FEED_CACHE_REDIS_PREFIX = 'reels:feed:';

async function getFeedFromCache(key: string): Promise<any | null> {
    try {
        const redisResult = await redisCacheService.get<any>(`${FEED_CACHE_REDIS_PREFIX}${key}`);
        if (redisResult) return redisResult;
    } catch {
        // Redis unavailable — try fallback
    }
    const fallback = feedCacheFallback.get(key);
    if (fallback && Date.now() - fallback.timestamp < FEED_CACHE_TTL) {
        return fallback.data;
    }
    return null;
}

async function setFeedCache(key: string, data: any): Promise<void> {
    try {
        await redisCacheService.set(`${FEED_CACHE_REDIS_PREFIX}${key}`, data, FEED_CACHE_TTL);
    } catch {
        // Redis unavailable — use fallback
    }
    feedCacheFallback.set(key, { data, timestamp: Date.now() });
    // Bound the fallback map
    if (feedCacheFallback.size > 200) {
        const oldest = feedCacheFallback.keys().next().value;
        if (oldest !== undefined) feedCacheFallback.delete(oldest);
    }
}

/**
 * Clear all entries of the feed cache (both Redis and in-process).
 * Called by the Mux webhook when a new reel becomes READY.
 */
export async function clearReelsFeedCache(): Promise<void> {
    feedCacheFallback.clear();
    try {
        await redisCacheService.delPattern(`${FEED_CACHE_REDIS_PREFIX}*`);
    } catch {
        // Non-critical — cache will expire naturally
    }
}

// Cache for user IDs (5 minutes TTL)
const userIdCache = new Map<string, { id: string; timestamp: number }>();
const USER_ID_CACHE_TTL = 5 * 60 * 1000;

async function getBlockedUserIdsForUser(userId: string): Promise<string[]> {
    try {
        // Exclude both directions:
        // - users I blocked
        // - users who blocked me
        const rows = await prisma.$queryRaw<{ otherId: string }[]>`
            SELECT
                CASE
                    WHEN b."blockerId" = ${userId} THEN b."blockedId"
                    ELSE b."blockerId"
                END AS "otherId"
            FROM blocks b
            WHERE b."blockerId" = ${userId} OR b."blockedId" = ${userId}
        `;
        return rows.map(r => r.otherId).filter(Boolean);
    } catch (err: any) {
        // Table may not exist yet in some deployments
        if (err?.code === '42P01') return [];
        logger.warn('[Reels] Failed to load blocked users (non-critical):', err);
        return [];
    }
}

/**
 * GET /api/reels/feed
 * Get reels feed with pagination (5 reels per request) - WITH CACHING
 */
router.get('/feed', requireAuth, lenientLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { cursor, limit = REELS_PER_PAGE.toString() } = req.query;
        const currentUserId = req.auth?.userId;
        const take = Math.min(parseInt(limit as string) || REELS_PER_PAGE, 10);

        // Check feed cache (only for first page without cursor)
        const cacheKey = `feed_${currentUserId}_${cursor || 'first'}_${take}`;
        const cached = await getFeedFromCache(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        // Get current user's DB id (with caching)
        let currentUser: { id: string } | null = null;
        if (currentUserId) {
            const cachedUserId = userIdCache.get(currentUserId);
            if (cachedUserId && Date.now() - cachedUserId.timestamp < USER_ID_CACHE_TTL) {
                currentUser = { id: cachedUserId.id };
            } else {
                currentUser = await prisma.user.findUnique({
                    where: { clerkUserId: currentUserId },
                    select: { id: true }
                });
                if (currentUser) {
                    userIdCache.set(currentUserId, { id: currentUser.id, timestamp: Date.now() });
                }
            }
        }

        const blockedUserIds = currentUser?.id ? await getBlockedUserIdsForUser(currentUser.id) : [];

        const reels = await prisma.reel.findMany({
            where: {
                isDeleted: false,
                status: 'READY', // Fix 7: exclude PROCESSING/FAILED reels from feed
                videoUrl: { not: '' }, // Fix 8: skip rows where Mux webhook hasn't fired yet
                ...(blockedUserIds.length > 0 ? { userId: { notIn: blockedUserIds } } : {}),
            }, // Exclude deleted reels + blocked users
            take: take + 1, // Get one extra to check if there's more
            ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                videoUrl: true,
                thumbnail: true,
                caption: true,
                views: true,
                sharesCount: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    }
                },
                hashtags: {
                    select: {
                        hashtag: {
                            select: { name: true }
                        }
                    }
                },
                mentions: {
                    select: {
                        mentionedUserId: true
                    }
                },
                comments: {
                    where: {
                        isDeleted: false,
                        ...(blockedUserIds.length > 0 ? { userId: { notIn: blockedUserIds } } : {}),
                    },
                    take: MAX_COMMENTS_PREVIEW,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        content: true,
                        createdAt: true,
                        user: {
                            select: {
                                username: true,
                                avatar: true,
                            }
                        }
                    }
                },
                likes: currentUser ? {
                    where: { userId: currentUser.id },
                    select: { id: true }
                } : false,
                savedBy: currentUser ? {
                    where: { userId: currentUser.id },
                    select: { id: true }
                } : false,
            }
        });

        const hasMore = reels.length > take;
        const data = hasMore ? reels.slice(0, -1) : reels;

        // Extra safety: drop any reel whose videoUrl is empty or points to a
        // thumbnail/image path (legacy rows from before Mux). The frontend
        // player refuses to load these anyway — filter here so the feed
        // count/cursor stays accurate.
        const isPlayableUrl = (url: string | null | undefined): boolean => {
            if (!url || typeof url !== 'string') return false;
            const trimmed = url.trim();
            if (trimmed.length === 0) return false;
            if (!/^https?:\/\//i.test(trimmed)) return false;
            const lower = trimmed.toLowerCase();
            if (lower.includes('/thumbnails/') || lower.includes('/thumbnail/')) return false;
            if (/\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(lower)) return false;
            return true;
        };
        const playableData = data.filter((r: any) => isPlayableUrl(r.videoUrl));

        const nextCursor = hasMore ? playableData[playableData.length - 1]?.id ?? data[data.length - 1]?.id : null;

        // Format response
        const formattedReels = playableData.map((reel: any) => {
            return {
                id: reel.id,
                videoUrl: reel.videoUrl,
                thumbnail: reel.thumbnail,
            caption: reel.caption,
            views: reel.views,
            likesCount: reel._count.likes,
            commentsCount: reel._count.comments,
            sharesCount: reel.sharesCount || 0,
            isLiked: Array.isArray(reel.likes) && reel.likes.length > 0,
            isSaved: Array.isArray(reel.savedBy) && reel.savedBy.length > 0,
            hashtags: reel.hashtags.map((h: any) => h.hashtag.name),
            mentions: reel.mentions.map((m: any) => m.mentionedUserId),
            previewComments: reel.comments,
            user: reel.user,
            createdAt: reel.createdAt,
            };
        });

        const responseData = {
            status: 'SUCCESS',
            data: {
                reels: formattedReels,
                nextCursor,
                hasMore,
            }
        };

        // Save to cache
        await setFeedCache(cacheKey, responseData);

        res.json(responseData);
    } catch (error: any) {
        logger.error('Get reels feed error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/hashtag/:tag
 * Get reels by hashtag
 */
router.get('/hashtag/:tag', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { tag } = req.params;
        const { cursor, limit = REELS_PER_PAGE.toString() } = req.query;
        const take = Math.min(parseInt(limit as string) || REELS_PER_PAGE, 10);

        const hashtag = await prisma.hashtag.findUnique({
            where: { name: (tag as string).toLowerCase() },
            select: { id: true, name: true, reelCount: true }
        });

        if (!hashtag) {
            res.json({
                status: 'SUCCESS',
                data: { hashtag: null, reels: [], hasMore: false }
            });
            return;
        }

        const reelHashtags = await prisma.reelHashtag.findMany({
            take: take + 1,
            ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
            where: { hashtagId: hashtag.id },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                reel: {
                    select: {
                        id: true,
                        videoUrl: true,
                        thumbnail: true,
                        caption: true,
                        views: true,
                        createdAt: true,
                        user: {
                            select: {
                                username: true,
                                displayName: true,
                                avatar: true,
                                isVerified: true,
                            }
                        },
                        _count: {
                            select: { likes: true, comments: true }
                        }
                    }
                }
            }
        });

        const hasMore = reelHashtags.length > take;
        const data = hasMore ? reelHashtags.slice(0, -1) : reelHashtags;

        res.json({
            status: 'SUCCESS',
            data: {
                hashtag: { name: hashtag.name, reelCount: hashtag.reelCount },
                reels: data.map((rh: any) => ({
                    ...rh.reel,
                    likesCount: rh.reel._count.likes,
                    commentsCount: rh.reel._count.comments,
                })),
                nextCursor: hasMore ? data[data.length - 1]?.id : null,
                hasMore,
            }
        });
    } catch (error: any) {
        logger.error('Get hashtag reels error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/reels — REMOVED
 * This legacy route accepted arbitrary videoUrl strings and was a security risk.
 * All reel creation now goes through POST /api/upload/reel (Mux pipeline).
 */

// ============================================
// PATCH /api/reels/:id  — Edit reel caption & hashtags
// Only the reel owner can edit. Caption goes through moderation.
// ============================================
router.patch('/:id', requireAuth, writeLimiter, moderateReelCaption, async (req: Request, res: Response): Promise<void> => {
    try {
        const reelId = ensureString(req.params.id);
        const clerkUserId = req.auth?.userId;
        const { caption, hashtags } = req.body;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true },
        });
        if (!user) { res.status(404).json({ status: 'ERROR', message: 'User not found' }); return; }

        const reel = await prisma.reel.findUnique({
            where: { id: reelId },
            select: { id: true, userId: true, status: true },
        });
        if (!reel) { res.status(404).json({ status: 'ERROR', message: 'Reel not found' }); return; }
        if (reel.userId !== user.id) { res.status(403).json({ status: 'ERROR', message: 'Not authorized' }); return; }
        if (reel.status === 'PROCESSING') {
            res.status(400).json({ status: 'ERROR', message: 'لا يمكن تعديل الفيديو أثناء المعالجة' });
            return;
        }

        // Build update payload
        const updateData: Record<string, any> = {};
        if (caption !== undefined) updateData.caption = caption?.trim() || null;

        await prisma.reel.update({ where: { id: reelId }, data: updateData });

        // Replace hashtags if provided
        if (Array.isArray(hashtags)) {
            // Remove old hashtag links and decrement counts
            const oldLinks = await prisma.reelHashtag.findMany({
                where: { reelId },
                select: { hashtagId: true },
            });
            if (oldLinks.length > 0) {
                await prisma.reelHashtag.deleteMany({ where: { reelId } });
                await prisma.hashtag.updateMany({
                    where: { id: { in: oldLinks.map((l: any) => l.hashtagId) } },
                    data: { reelCount: { decrement: 1 } },
                });
            }

            // Add new hashtags
            for (const tag of hashtags.slice(0, 10)) {
                const cleanTag = tag.toLowerCase().replace(/^#/, '').trim();
                if (!cleanTag) continue;
                const hashtag = await prisma.hashtag.upsert({
                    where: { name: cleanTag },
                    create: { name: cleanTag, reelCount: 1 },
                    update: { reelCount: { increment: 1 } },
                });
                await prisma.reelHashtag.create({ data: { reelId, hashtagId: hashtag.id } });
            }
        }

        // Invalidate caches
        await Promise.allSettled([
            clearResponseCache('/reels/feed'),
            redisCacheService.delPattern('reels:feed:*'),
            redisCacheService.del(`reel:${reelId}`),
        ]);

        res.json({ status: 'SUCCESS', message: 'تم تحديث الفيديو بنجاح' });
    } catch (error: any) {
        logger.error('Edit reel error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// POST /api/reels/:id/retry  (Feature 5)
// Retry Mux processing for a FAILED reel
// ============================================
router.post('/:id/retry', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const reelId = ensureString(req.params.id);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true },
        });
        if (!user) { res.status(404).json({ status: 'ERROR', message: 'User not found' }); return; }

        const reel = await prisma.reel.findUnique({
            where: { id: reelId },
            select: { id: true, userId: true, status: true, videoStoragePath: true, muxAssetId: true },
        });

        if (!reel) { res.status(404).json({ status: 'ERROR', message: 'Reel not found' }); return; }
        if (reel.userId !== user.id) { res.status(403).json({ status: 'ERROR', message: 'Not authorized' }); return; }
        if (reel.status !== 'FAILED') {
            res.status(400).json({ status: 'ERROR', message: 'يمكن إعادة المحاولة فقط للفيديوهات الفاشلة' });
            return;
        }
        if (!reel.videoStoragePath) {
            res.status(400).json({
                status: 'ERROR',
                message: 'انتهت صلاحية الفيديو الأصلي (أكثر من 24 ساعة). يرجى رفع الفيديو من جديد.',
            });
            return;
        }

        // Delete old Mux asset if it exists
        if (reel.muxAssetId) {
            const { deleteAsset } = await import('../services/mux.service');
            await deleteAsset(reel.muxAssetId).catch((err: any) =>
                logger.warn(`[reels/retry] Mux asset delete failed: ${err?.message}`),
            );
        }

        // Download raw video from R2
        const { r2MediaStorage } = await import('../services/r2-media-storage.service');
        const signedUrl = await r2MediaStorage.generateSignedUrl(reel.videoStoragePath, 300);

        const videoResponse = await fetch(signedUrl);
        if (!videoResponse.ok) {
            res.status(502).json({ status: 'ERROR', message: 'فشل تحميل الفيديو الأصلي من التخزين' });
            return;
        }
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

        // Create new Mux upload URL
        const muxService = await import('../services/mux.service');
        const { uploadId, uploadUrl } = await muxService.createUploadUrl(user.id, reel.id);

        // PUT to Mux
        const muxRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'video/mp4' },
            body: videoBuffer,
        });
        if (!muxRes.ok) {
            res.status(502).json({ status: 'ERROR', message: 'فشل رفع الفيديو إلى خادم المعالجة' });
            return;
        }

        await prisma.reel.update({
            where: { id: reel.id },
            data: { status: 'PROCESSING', muxUploadId: uploadId, muxAssetId: null, muxPlaybackId: null, videoUrl: '' },
        });

        res.json({ status: 'SUCCESS', message: 'جاري إعادة معالجة الفيديو', data: { reelId, muxUploadId: uploadId } });
    } catch (error: any) {
        logger.error('Retry reel error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/reels/:id/view
 * Increment view count (only once per user per video, no owner self-views)
 */
router.post('/:id/view', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const clerkUserId = req.auth?.userId;

        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Get current user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if reel exists and get owner
        const reel = await prisma.reel.findUnique({
            where: { id: idStr },
            select: { id: true, userId: true }
        });

        if (!reel) {
            // Reel doesn't exist (might be mock data) - just return success
            res.json({ status: 'SUCCESS', message: 'View not recorded (reel not in database)' });
            return;
        }

        // Don't count owner's own views
        if (reel.userId === user.id) {
            res.json({ status: 'SUCCESS', message: 'View not counted (owner viewing own video)' });
            return;
        }

        // Check if user has already viewed this reel
        const existingView = await prisma.reelView.findUnique({
            where: {
                reelId_userId: {
                    reelId: idStr,
                    userId: user.id
                }
            }
        });

        if (existingView) {
            // Already viewed - return success without incrementing
            res.json({ status: 'SUCCESS', message: 'View already recorded' });
            return;
        }

        // Create view record and increment count in a transaction
        const [, updatedReel] = await prisma.$transaction([
            prisma.reelView.create({
                data: {
                    reelId: idStr,
                    userId: user.id
                }
            }),
            prisma.reel.update({
                where: { id: idStr },
                data: { views: { increment: 1 } },
                select: { views: true, userId: true }
            })
        ]);

        // ✅ XP Awards for reel owner on view milestones (non-blocking)
        const tz = (req.headers['x-user-timezone'] as string) || 'UTC';
        if (updatedReel.views === 100) {
          awardXp({ userId: updatedReel.userId, action: 'REEL_VIEWS_100', idempotencyKey: `reel:${idStr}:views100`, timezone: tz, metadata: { reelId: idStr } }).catch((e) => logger.warn('XP views100 failed:', e));
        } else if (updatedReel.views === 500) {
          awardXp({ userId: updatedReel.userId, action: 'REEL_VIEWS_500', idempotencyKey: `reel:${idStr}:views500`, timezone: tz, metadata: { reelId: idStr } }).catch((e) => logger.warn('XP views500 failed:', e));
        } else if (updatedReel.views === 1000) {
          awardXp({ userId: updatedReel.userId, action: 'REEL_VIEWS_1000', idempotencyKey: `reel:${idStr}:views1000`, timezone: tz, metadata: { reelId: idStr } }).catch((e) => logger.warn('XP views1000 failed:', e));
        }

        res.json({ status: 'SUCCESS' });
    } catch (error: any) {
        // Handle unique constraint violation (race condition)
        if (error.code === 'P2002') {
            // View was already created by another request - just return success
            res.json({ status: 'SUCCESS', message: 'View already recorded' });
            return;
        }
        
        // Don't fail on view recording errors
        logger.warn('View recording error:', error.message);
        res.json({ status: 'SUCCESS', message: 'View recording skipped' });
    }
});

/**
 * POST /api/reels/:id/like
 * Like a reel
 */
router.post('/:id/like', requireAuth, writeLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if reel exists
        const reel = await prisma.reel.findUnique({
            where: { id: idStr },
            select: { id: true, userId: true }
        });

        if (!reel) {
            // Reel doesn't exist (might be mock data) - return success with fake count
            res.json({ status: 'SUCCESS', data: { likesCount: 1 }, message: 'Mock reel liked locally' });
            return;
        }

        // Check if already liked
        const existingLike = await prisma.like.findUnique({
            where: { userId_reelId: { userId: user.id, reelId: idStr } }
        });

        if (existingLike) {
            const likesCount = await prisma.like.count({ where: { reelId: idStr } });
            res.json({ status: 'SUCCESS', data: { likesCount }, message: 'Already liked' });
            return;
        }

        await prisma.like.create({
            data: { userId: user.id, reelId: idStr }
        });

        const likesCount = await prisma.like.count({ where: { reelId: idStr } });

        // Notify reel owner
        if (reel.userId !== user.id) {
            // ✅ XP Award to reel owner for receiving a like (non-blocking)
            const tz = (req.headers['x-user-timezone'] as string) || 'UTC';
            awardXp({ userId: reel.userId, action: 'REEL_RECEIVED_LIKE', dailyCap: 50, timezone: tz, metadata: { reelId: idStr, likerId: user.id } }).catch((e) => logger.warn('XP received_like failed:', e));

            // Get liker info for notification
            const liker = await prisma.user.findUnique({
                where: { id: user.id },
                select: { username: true, displayName: true, avatar: true }
            });

            // Redis-based like batching: group likes within 5-minute windows
            let likeCount = 1;
            try {
                const { getRedisClient } = await import('../lib/redis');
                const redis = getRedisClient();
                if (redis) {
                    const batchKey = `likes:pending:${reel.userId}:${idStr}`;
                    likeCount = await redis.incr(batchKey);
                    await redis.expire(batchKey, 5 * 60); // 5 min TTL
                }
            } catch {
                likeCount = 1; // fallback: send immediately
            }

            // Send on first like OR every 10 likes
            if (likeCount === 1 || likeCount % 10 === 0) {
                const likerName = liker?.displayName || liker?.username || 'شخص';
                const title = likeCount === 1 ? '❤️ أعجب بمقطعك' : `❤️ ${likeCount} إعجاب على مقطعك`;
                const message = likeCount === 1
                    ? `${likerName} أعجب بمقطعك`
                    : `${likerName} و${likeCount - 1} آخرين أعجبوا بمقطعك`;

                await enqueueSocialNotification({
                    userId: reel.userId,
                    actorId: user.id,
                    title,
                    message,
                    type: 'LIKE',
                    data: { reelId: id, likeCount },
                });
            }
        }

        // Send WebSocket like update (Requirements: 21.8)
        WebSocketService.sendLikeUpdate(reel.userId, {
            reelId: idStr,
            likesCount,
            userId: user.id,
            action: 'like',
        });

        // Invalidate cache for feed and this reel
        {
            const results = await Promise.allSettled([
                clearResponseCache('/reels/feed'),
                redisCacheService.delPattern('reels:feed:*'),
                redisCacheService.del(`reel:${idStr}`),
            ]);
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    logger.warn(`Reels cache invalidation failed [like] index=${i}:`, r.reason);
                }
            });
        }

        res.json({ status: 'SUCCESS', data: { likesCount } });
    } catch (error: any) {
        logger.error('Like error:', error);
        res.json({ status: 'SUCCESS', data: { likesCount: 1 } });
    }
});

/**
 * DELETE /api/reels/:id/like
 * Unlike a reel
 */
router.delete('/:id/like', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if reel exists
        const reel = await prisma.reel.findUnique({
            where: { id: idStr },
            select: { id: true, userId: true }
        });

        if (!reel) {
            // Reel doesn't exist (might be mock data) - return success
            res.json({ status: 'SUCCESS', data: { likesCount: 0 }, message: 'Mock reel unliked locally' });
            return;
        }

        await prisma.like.deleteMany({
            where: { userId: user.id, reelId: idStr }
        });

        const likesCount = await prisma.like.count({ where: { reelId: idStr } });

        // Send WebSocket like update (Requirements: 21.8)
        WebSocketService.sendLikeUpdate(reel.userId, {
            reelId: idStr,
            likesCount,
            userId: user.id,
            action: 'unlike',
        });

        res.json({ status: 'SUCCESS', data: { likesCount } });
    } catch (error: any) {
        logger.error('Unlike error:', error);
        res.json({ status: 'SUCCESS', data: { likesCount: 0 } });
    }
});

/**
 * GET /api/reels/:id/comments
 * Get comments for a reel (with replies)
 */
router.get('/:id/comments', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const { limit = '20' } = req.query;

        const clerkUserId = req.auth?.userId;
        const currentUser = clerkUserId
            ? await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } })
            : null;
        const blockedUserIds = currentUser?.id ? await getBlockedUserIdsForUser(currentUser.id) : [];

        // Get top-level comments (no parentId, not deleted)
        const comments = await prisma.comment.findMany({
            where: {
                reelId: idStr,
                parentId: null,
                isDeleted: false,
                ...(blockedUserIds.length > 0 ? { userId: { notIn: blockedUserIds } } : {}),
            },
            take: Math.min(parseInt(limit as string), 50),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                content: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                },
                replies: {
                    where: {
                        isDeleted: false,
                        ...(blockedUserIds.length > 0 ? { userId: { notIn: blockedUserIds } } : {}),
                    },
                    take: 3,
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        content: true,
                        createdAt: true,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                displayName: true,
                                avatar: true,
                                isVerified: true,
                            }
                        }
                    }
                },
                _count: {
                    select: { replies: true }
                }
            }
        });

        const totalCount = await prisma.comment.count({
            where: {
                reelId: idStr,
                parentId: null,
                isDeleted: false,
                ...(blockedUserIds.length > 0 ? { userId: { notIn: blockedUserIds } } : {}),
            }
        });

        // Format response
        const formattedComments = comments.map((c: any) => ({
            ...c,
            repliesCount: c._count.replies,
            _count: undefined
        }));

        res.json({
            status: 'SUCCESS',
            data: { comments: formattedComments, totalCount }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// Import comment limits from config
import { COMMENT_LIMITS } from '../config/storage.config';

/**
 * POST /api/reels/:id/comments
 * Add a comment or reply to a reel
 * Apple UGC Compliance: Content filtering applied
 */
router.post('/:id/comments', requireAuth, writeLimiter, filterUGCContent, moderateComment, async (req: Request, res: Response): Promise<void> => {
    // Cache invalidation will happen at the end
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const { content, parentId, mentions } = req.body;
        const clerkUserId = req.auth?.userId;

        if (!content || content.trim().length === 0) {
            res.status(400).json({ status: 'ERROR', message: 'Comment content is required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true, username: true, displayName: true, avatar: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if user has reached comment/reply limit on this reel
        // Requirements 15.1, 15.2, 15.3: Separate limits for comments (5) and replies (5)
        const isReply = !!parentId;
        
        if (isReply) {
            // Count user's replies on this reel
            const userRepliesCount = await prisma.comment.count({
                where: {
                    reelId: idStr,
                    userId: user.id,
                    parentId: { not: null }, // Only count replies
                }
            });

            if (userRepliesCount >= COMMENT_LIMITS.MAX_REPLIES_PER_USER_PER_REEL) {
                res.status(429).json({
                    status: 'ERROR',
                    message: 'وصلت للحد الأقصى من الردود (5) على هذا الفيديو',
                    code: 'REPLY_LIMIT_REACHED',
                    details: {
                        maxReplies: COMMENT_LIMITS.MAX_REPLIES_PER_USER_PER_REEL,
                        currentReplies: userRepliesCount,
                    }
                });
                return;
            }
        } else {
            // Count user's top-level comments on this reel
            const userCommentsCount = await prisma.comment.count({
                where: {
                    reelId: idStr,
                    userId: user.id,
                    parentId: null, // Only count top-level comments
                }
            });

            if (userCommentsCount >= COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL) {
                res.status(429).json({
                    status: 'ERROR',
                    message: 'وصلت للحد الأقصى من التعليقات (5) على هذا الفيديو',
                    code: 'COMMENT_LIMIT_REACHED',
                    details: {
                        maxComments: COMMENT_LIMITS.MAX_COMMENTS_PER_USER_PER_REEL,
                        currentComments: userCommentsCount,
                    }
                });
                return;
            }
        }

        // If this is a reply, verify parent comment exists
        let parentComment = null;
        if (parentId) {
            parentComment = await prisma.comment.findUnique({
                where: { id: parentId },
                select: { id: true, userId: true, user: { select: { username: true } } }
            });
            if (!parentComment) {
                res.status(404).json({ status: 'ERROR', message: 'Parent comment not found' });
                return;
            }
        }

        const comment = await prisma.comment.create({
            data: {
                userId: user.id,
                reelId: idStr,
                parentId: parentId || null,
                content: content.trim()
            },
            select: {
                id: true,
                content: true,
                parentId: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                    }
                }
            }
        });

        // Parse mentions from content if not provided
        let parsedMentions: string[] = mentions || [];
        if (!mentions && content) {
            const mentionRegex = /@(\w+)/g;
            const matches = content.match(mentionRegex);
            if (matches) {
                parsedMentions = matches.map((m: any) => m.replace('@', ''));
            }
        }

        // Process mentions in comments
        if (parsedMentions && parsedMentions.length > 0) {
            for (const username of parsedMentions) {
                const mentionedUser = await prisma.user.findUnique({
                    where: { username: username.replace(/^@/, '') },
                    select: { id: true, username: true, displayName: true, avatar: true }
                });

                if (mentionedUser && mentionedUser.id !== user.id) {
                    // Create CommentMention record
                    await prisma.commentMention.create({
                        data: {
                            commentId: comment.id,
                            mentionedUserId: mentionedUser.id
                        }
                    });

                    await enqueueSocialNotification({
                        userId: mentionedUser.id,
                        actorId: user.id,
                        title: 'تم الإشارة إليك في تعليق',
                        message: `قام ${user.displayName || user.username} بالإشارة إليك في تعليق`,
                        type: 'MENTION',
                        data: {
                            reelId: idStr,
                            commentId: comment.id,
                            parentCommentId: parentId || null,
                        },
                    });
                }
            }
        }

        // Get reel info
        const reel = await prisma.reel.findUnique({
            where: { id: idStr },
            select: { userId: true }
        });

        if (parentComment && parentComment.userId !== user.id) {
            // This is a reply - notify the parent comment owner
            await enqueueSocialNotification({
                userId: parentComment.userId,
                actorId: user.id,
                title: 'رد جديد',
                message: `${user.displayName || user.username}: ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`,
                type: 'REPLY',
                data: { 
                    reelId: idStr, 
                    commentId: comment.id,
                    parentCommentId: parentId,
                },
            });

            // Send WebSocket reply event (Requirements: 21.3)
            WebSocketService.sendReply(parentComment.userId, {
                reelId: idStr,
                parentCommentId: parentId,
                reply: {
                    id: comment.id,
                    content: comment.content,
                    user: {
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar || undefined,
                    },
                    createdAt: comment.createdAt.toISOString(),
                },
            });
        } else if (reel && reel.userId !== user.id && !parentId) {
            // This is a top-level comment - notify reel owner
            // ✅ XP Award to reel owner for receiving a comment (non-blocking)
            const tz = (req.headers['x-user-timezone'] as string) || 'UTC';
            awardXp({ userId: reel.userId, action: 'REEL_RECEIVED_COMMENT', dailyCap: 30, timezone: tz, metadata: { reelId: idStr, commenterId: user.id } }).catch((e) => logger.warn('XP received_comment failed:', e));

            await enqueueSocialNotification({
                userId: reel.userId,
                actorId: user.id,
                title: 'تعليق جديد',
                message: `${user.displayName || user.username}: ${content.substring(0, 60)}${content.length > 60 ? '...' : ''}`,
                type: 'COMMENT',
                data: { 
                    reelId: idStr, 
                    commentId: comment.id,
                },
            });

            // Send WebSocket comment event (Requirements: 21.3, 21.9)
            WebSocketService.sendComment(reel.userId, {
                reelId: idStr,
                comment: {
                    id: comment.id,
                    content: comment.content,
                    user: {
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar || undefined,
                    },
                    createdAt: comment.createdAt.toISOString(),
                },
            });
        }

        // Invalidate cache for feed, this reel, and comments
        {
            const results = await Promise.allSettled([
                clearResponseCache('/reels/feed'),
                redisCacheService.delPattern('reels:feed:*'),
                redisCacheService.del(`reel:${idStr}`),
                redisCacheService.del(`reel:${idStr}:comments`),
            ]);
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    logger.warn(`Reels cache invalidation failed [comment] index=${i}:`, r.reason);
                }
            });
        }

        res.status(201).json({ status: 'SUCCESS', data: { comment } });
    } catch (error: any) {
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/comments/:commentId/replies
 * Get all replies for a comment
 */
router.get('/comments/:commentId/replies', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { commentId } = req.params;
        const commentIdStr = ensureString(commentId);
        const { limit = '20' } = req.query;

        const replies = await prisma.comment.findMany({
            where: { parentId: commentIdStr },
            take: Math.min(parseInt(limit as string), 50),
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                content: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                }
            }
        });

        res.json({ status: 'SUCCESS', data: { replies } });
    } catch (error: any) {
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/search/users
 * Search users for mentions (by username)
 */
router.get('/search/users', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;
        const query = (q as string || '').trim();

        if (query.length < 1) {
            res.json({ status: 'SUCCESS', data: { users: [] } });
            return;
        }

        const users = await prisma.user.findMany({
            where: {
                username: { contains: query, mode: 'insensitive' }
            },
            take: 10,
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
            }
        });

        res.json({ status: 'SUCCESS', data: { users } });
    } catch (error: any) {
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/search
 * Search reels by caption, hashtags, or username - OPTIMIZED WITH CACHING
 */
router.get('/search', requireAuth, lenientLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { q, limit = '10', type = 'all' } = req.query;
        const query = (q as string || '').trim();
        const searchLimit = Math.min(parseInt(limit as string) || 10, 20);
        const searchType = type as 'all' | 'reels' | 'hashtags';

        if (query.length < 1) {
            res.json({ status: 'SUCCESS', data: { reels: [], hashtags: [] } });
            return;
        }

        const currentUserId = req.auth?.userId;
        let currentUser: { id: string } | null = null;
        if (currentUserId) {
            const cachedUserId = userIdCache.get(currentUserId);
            if (cachedUserId && Date.now() - cachedUserId.timestamp < USER_ID_CACHE_TTL) {
                currentUser = { id: cachedUserId.id };
            } else {
                currentUser = await prisma.user.findUnique({
                    where: { clerkUserId: currentUserId },
                    select: { id: true }
                });
                if (currentUser) {
                    userIdCache.set(currentUserId, { id: currentUser.id, timestamp: Date.now() });
                }
            }
        }

        const results: { reels: any[]; hashtags: any[] } = { reels: [], hashtags: [] };

        // Search reels if type is 'all' or 'reels'
        if (searchType === 'all' || searchType === 'reels') {
            const reels = await prisma.reel.findMany({
                where: {
                    isDeleted: false,
                    OR: [
                        { caption: { contains: query, mode: 'insensitive' } },
                        {
                            hashtags: {
                                some: {
                                    hashtag: {
                                        name: { contains: query.toLowerCase(), mode: 'insensitive' }
                                    }
                                }
                            }
                        },
                        {
                            user: {
                                OR: [
                                    { username: { contains: query, mode: 'insensitive' } },
                                    { displayName: { contains: query, mode: 'insensitive' } }
                                ]
                            }
                        }
                    ]
                },
                take: searchLimit,
                orderBy: [
                    { views: 'desc' },
                    { createdAt: 'desc' }
                ],
                select: {
                    id: true,
                    videoUrl: true,
                    thumbnail: true,
                    caption: true,
                    views: true,
                    sharesCount: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true,
                            isVerified: true,
                        }
                    },
                    _count: {
                        select: {
                            likes: true,
                            comments: true
                        }
                    },
                    hashtags: {
                        select: {
                            hashtag: {
                                select: { name: true }
                            }
                        }
                    },
                    likes: currentUser ? {
                        where: { userId: currentUser.id },
                        select: { id: true }
                    } : false,
                }
            });

            results.reels = reels.map((reel: any) => ({
                id: reel.id,
                videoUrl: reel.videoUrl,
                thumbnail: reel.thumbnail,
                caption: reel.caption,
                views: reel.views,
                likesCount: reel._count.likes,
                commentsCount: reel._count.comments,
                sharesCount: reel.sharesCount || 0,
                isLiked: Array.isArray(reel.likes) && reel.likes.length > 0,
                hashtags: reel.hashtags.map((h: any) => h.hashtag.name),
                user: reel.user,
                createdAt: reel.createdAt,
            }));
        }

        // Search hashtags if type is 'all' or 'hashtags'
        if (searchType === 'all' || searchType === 'hashtags') {
            const hashtags = await prisma.hashtag.findMany({
                where: {
                    name: { contains: query.toLowerCase(), mode: 'insensitive' }
                },
                take: 10,
                orderBy: { reelCount: 'desc' },
                select: {
                    id: true,
                    name: true,
                    reelCount: true,
                }
            });

            results.hashtags = hashtags;
        }

        res.json({ status: 'SUCCESS', data: results });
    } catch (error: any) {
        logger.error('Search reels error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/trending-hashtags
 * Get trending hashtags
 */
router.get('/trending-hashtags', async (req: Request, res: Response): Promise<void> => {
    try {
        const hashtags = await prisma.hashtag.findMany({
            take: 20,
            orderBy: { reelCount: 'desc' },
            select: {
                id: true,
                name: true,
                reelCount: true,
            }
        });

        res.json({ status: 'SUCCESS', data: { hashtags } });
    } catch (error: any) {
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// COMMENT LIKES (لايك على التعليقات والردود)
// ============================================

/**
 * POST /api/reels/comments/:commentId/like
 * Like a comment or reply
 */
router.post('/comments/:commentId/like', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { commentId } = req.params;
        const commentIdStr = ensureString(commentId);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true, username: true, displayName: true, avatar: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if comment exists
        const comment = await prisma.comment.findUnique({
            where: { id: commentIdStr },
            select: { id: true, userId: true, reelId: true }
        });

        if (!comment) {
            res.status(404).json({ status: 'ERROR', message: 'Comment not found' });
            return;
        }

        // Check if already liked
        const existingLike = await prisma.commentLike.findUnique({
            where: { userId_commentId: { userId: user.id, commentId: commentIdStr } }
        });

        if (existingLike) {
            const likesCount = await prisma.commentLike.count({ where: { commentId: commentIdStr } });
            res.json({ status: 'SUCCESS', data: { likesCount }, message: 'Already liked' });
            return;
        }

        await prisma.commentLike.create({
            data: { userId: user.id, commentId: commentIdStr }
        });

        const likesCount = await prisma.commentLike.count({ where: { commentId: commentIdStr } });

        // Notify comment owner (if not self)
        if (comment.userId !== user.id) {
            await enqueueSocialNotification({
                userId: comment.userId,
                actorId: user.id,
                title: '❤️ إعجاب على تعليقك',
                message: `أعجب ${user.displayName || user.username} بتعليقك`,
                type: 'COMMENT_LIKE',
                data: {
                    commentId: commentIdStr,
                    reelId: comment.reelId,
                    screen: '/(tabs)/reels',
                },
            });
        }

        res.json({ status: 'SUCCESS', data: { likesCount } });
    } catch (error: any) {
        logger.error('Like comment error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * DELETE /api/reels/comments/:commentId/like
 * Unlike a comment or reply
 */
router.delete('/comments/:commentId/like', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { commentId } = req.params;
        const commentIdStr = ensureString(commentId);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        await prisma.commentLike.deleteMany({
            where: { userId: user.id, commentId: commentIdStr }
        });

        const likesCount = await prisma.commentLike.count({ where: { commentId: commentIdStr } });

        res.json({ status: 'SUCCESS', data: { likesCount } });
    } catch (error: any) {
        logger.error('Unlike comment error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * DELETE /api/reels/comments/:commentId
 * Delete a comment (own comments only)
 */
router.delete('/comments/:commentId', requireAuth, strictLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { commentId } = req.params;
        const commentIdStr = ensureString(commentId);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if comment exists and belongs to user
        const comment = await prisma.comment.findUnique({
            where: { id: commentIdStr },
            select: { id: true, userId: true, reelId: true }
        });

        if (!comment) {
            res.status(404).json({ status: 'ERROR', message: 'Comment not found' });
            return;
        }

        if (comment.userId !== user.id) {
            res.status(403).json({ status: 'ERROR', message: 'You can only delete your own comments' });
            return;
        }

        // Soft delete comment
        await prisma.comment.update({
            where: { id: commentIdStr },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                content: '[تم حذف هذا التعليق]'
            }
        });

        // Invalidate cache
        {
            const results = await Promise.allSettled([
                clearResponseCache(`/reels/${comment.reelId}/comments`),
                redisCacheService.del(`reel:${comment.reelId}:comments`),
            ]);
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    logger.warn(`Reels cache invalidation failed [deleteComment] index=${i}:`, r.reason);
                }
            });
        }

        res.json({ status: 'SUCCESS', message: 'Comment deleted successfully' });
    } catch (error: any) {
        logger.error('Delete comment error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/reels/comments/:commentId/report
 * Report a comment
 */
router.post('/comments/:commentId/report', requireAuth, strictLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { commentId } = req.params;
        const commentIdStr = ensureString(commentId);
        const { reason } = req.body;
        const clerkUserId = req.auth?.userId;

        if (!reason || reason.trim().length === 0) {
            res.status(400).json({ status: 'ERROR', message: 'Report reason is required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if comment exists and is not deleted
        const comment = await prisma.comment.findFirst({
            where: { id: commentIdStr, isDeleted: false },
            select: { id: true, userId: true, reelId: true }
        });

        if (!comment) {
            res.status(404).json({ status: 'ERROR', message: 'Comment not found or already deleted' });
            return;
        }

        // Can't report own comments
        if (comment.userId === user.id) {
            res.status(400).json({ status: 'ERROR', message: 'Cannot report your own comment' });
            return;
        }

        // Check for duplicate report
        const { checkDuplicateReport, calculateReportPriority } = await import('../services/moderation.service');
        const isDuplicate = await checkDuplicateReport({
            reporterId: user.id,
            reportedCommentId: commentIdStr,
        });

        if (isDuplicate) {
            res.status(400).json({ status: 'ERROR', message: 'تم الإبلاغ عن هذا التعليق مسبقاً. يمكنك الإبلاغ مرة أخرى بعد 24 ساعة' });
            return;
        }

        // Map reason to ReportType enum
        const reportTypeMap: Record<string, string> = {
            'محتوى غير لائق': 'INAPPROPRIATE',
            'سبام أو إعلانات': 'SPAM',
            'خطاب كراهية': 'HARASSMENT',
            'أخرى': 'OTHER',
        };

        const reportType = reportTypeMap[reason] || 'OTHER';

        // Calculate priority
        const priority = await calculateReportPriority({
            reportType,
            reportedCommentId: commentIdStr,
            reportedUserId: comment.userId,
        });

        // Create report
        const report = await prisma.report.create({
            data: {
                reporterId: user.id,
                reportedCommentId: commentIdStr,
                reportedUserId: comment.userId,
                reportedReelId: comment.reelId,
                type: reportType as any,
                reason: reason.trim(),
                status: 'PENDING',
                priority: priority as any,
                isDuplicate: false,
            }
        });

        // Process report (create strike, check thresholds)
        const { processReport } = await import('../services/moderation.service');
        await processReport(report.id);

        // Alert admins if high priority
        if (priority === 'HIGH' || priority === 'CRITICAL') {
            const { AdminNotificationService } = await import('../services/admin-notification.service');
            await AdminNotificationService.alertHighPriorityReport(report.id, priority, reportType);
        }

        // Log audit
        const { AuditService } = await import('../services/audit.service');
        await AuditService.logReportCreated(report.id, user.id, commentIdStr, 'COMMENT' as any);

        res.json({ status: 'SUCCESS', message: 'تم إرسال البلاغ بنجاح' });
    } catch (error: any) {
        logger.error('Report comment error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// SAVED REELS (الفيديوهات المحفوظة)
// ============================================

/**
 * POST /api/reels/:id/save
 * Save a reel to user's saved list
 */
router.post('/:id/save', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if reel exists
        const reel = await prisma.reel.findUnique({
            where: { id: idStr },
            select: { id: true }
        });

        if (!reel) {
            res.status(404).json({ status: 'ERROR', message: 'Reel not found' });
            return;
        }

        // Check if already saved
        const existingSave = await prisma.savedReel.findUnique({
            where: { userId_reelId: { userId: user.id, reelId: idStr } }
        });

        if (existingSave) {
            res.json({ status: 'SUCCESS', data: { saved: true }, message: 'Already saved' });
            return;
        }

        await prisma.savedReel.create({
            data: { userId: user.id, reelId: idStr }
        });

        res.json({ status: 'SUCCESS', data: { saved: true } });
    } catch (error: any) {
        logger.error('Save reel error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * DELETE /api/reels/:id/save
 * Remove a reel from user's saved list
 */
router.delete('/:id/save', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        await prisma.savedReel.deleteMany({
            where: { userId: user.id, reelId: idStr }
        });

        res.json({ status: 'SUCCESS', data: { saved: false } });
    } catch (error: any) {
        logger.error('Unsave reel error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/saved
 * Get user's saved reels
 */
router.get('/saved', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { cursor, limit = '10' } = req.query;
        const clerkUserId = req.auth?.userId;
        const take = Math.min(parseInt(limit as string) || 10, 20);

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        const savedReels = await prisma.savedReel.findMany({
            where: { userId: user.id },
            take: take + 1,
            ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                createdAt: true,
                reel: {
                    select: {
                        id: true,
                        videoUrl: true,
                        thumbnail: true,
                        caption: true,
                        views: true,
                        createdAt: true,
                        user: {
                            select: {
                                id: true,
                                username: true,
                                displayName: true,
                                avatar: true,
                                isVerified: true,
                            }
                        },
                        _count: {
                            select: { likes: true, comments: true }
                        }
                    }
                }
            }
        });

        const hasMore = savedReels.length > take;
        const data = hasMore ? savedReels.slice(0, -1) : savedReels;

        res.json({
            status: 'SUCCESS',
            data: {
                savedReels: data.map((sr: any) => ({
                    ...sr.reel,
                    savedAt: sr.createdAt,
                    likesCount: sr.reel._count.likes,
                    commentsCount: sr.reel._count.comments,
                })),
                nextCursor: hasMore ? data[data.length - 1]?.id : null,
                hasMore,
            }
        });
    } catch (error: any) {
        logger.error('Get saved reels error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// SHARE TRACKING (تتبع المشاركات)
// ============================================

/**
 * POST /api/reels/:id/share
 * Record a share action
 */
router.post('/:id/share', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const { platform } = req.body; // whatsapp, facebook, twitter, copy_link, etc.
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if reel exists
        const reel = await prisma.reel.findUnique({
            where: { id: idStr },
            select: { id: true, sharesCount: true, userId: true }
        });

        if (!reel) {
            res.status(404).json({ status: 'ERROR', message: 'Reel not found' });
            return;
        }

        // Record share
        await prisma.reelShare.create({
            data: { 
                userId: user.id, 
                reelId: idStr,
                platform: platform || 'unknown'
            }
        });

        // Update shares count
        const updatedReel = await prisma.reel.update({
            where: { id: idStr },
            data: { sharesCount: { increment: 1 } },
            select: { sharesCount: true }
        });

        // Notify reel owner (if not self)
        if (reel.userId !== user.id) {
            // ✅ XP Award to reel owner for receiving a share (non-blocking)
            const tz = (req.headers['x-user-timezone'] as string) || 'UTC';
            awardXp({ userId: reel.userId, action: 'REEL_RECEIVED_SHARE', dailyCap: 20, timezone: tz, metadata: { reelId: idStr, sharerId: user.id } }).catch((e) => logger.warn('XP received_share failed:', e));

            const sharer = await prisma.user.findUnique({
                where: { id: user.id },
                select: { username: true, displayName: true }
            });
            const sharerName = sharer?.displayName || sharer?.username || 'شخص';
            
            await enqueueSocialNotification({
                userId: reel.userId,
                actorId: user.id,
                title: '🔗 شاركوا مقطعك!',
                message: `${sharerName} شارك مقطعك على ${platform || 'وسائل التواصل'}`,
                type: 'SHARE',
                data: { reelId: idStr, platform, screen: '/(tabs)/reels' }
            });
        }


        res.json({ status: 'SUCCESS', data: { sharesCount: updatedReel.sharesCount } });
    } catch (error: any) {
        logger.error('Share reel error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// REPORT REEL (الإبلاغ عن فيديو)
// ============================================

/**
 * POST /api/reels/:id/report
 * Report a reel
 */
router.post('/:id/report', requireAuth, strictLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const idStr = ensureString(id);
        const { reason, type = 'INAPPROPRIATE' } = req.body;
        const clerkUserId = req.auth?.userId;

        if (!reason || reason.trim().length === 0) {
            res.status(400).json({ status: 'ERROR', message: 'Report reason is required' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if reel exists and is not deleted
        const reel = await prisma.reel.findFirst({
            where: { id: idStr, isDeleted: false },
            select: { id: true, userId: true }
        });

        if (!reel) {
            res.status(404).json({ status: 'ERROR', message: 'Reel not found or already deleted' });
            return;
        }

        // Check for duplicate report
        const { checkDuplicateReport, calculateReportPriority } = await import('../services/moderation.service');
        const isDuplicate = await checkDuplicateReport({
            reporterId: user.id,
            reportedReelId: idStr,
        });

        if (isDuplicate) {
            res.status(400).json({ status: 'ERROR', message: 'تم الإبلاغ عن هذا الفيديو مسبقاً. يمكنك الإبلاغ مرة أخرى بعد 24 ساعة' });
            return;
        }

        // Map Arabic reasons to ReportType enum
        const reportTypeMap: Record<string, string> = {
            'محتوى غير لائق': 'INAPPROPRIATE',
            'سبام أو إعلانات': 'SPAM',
            'خطاب كراهية': 'HARASSMENT',
            'عنف أو محتوى خطير': 'INAPPROPRIATE',
            'انتهاك حقوق الملكية': 'COPYRIGHT',
            'محتوى للبالغين': 'INAPPROPRIATE',
            'معلومات مضللة': 'FAKE_INFO',
            'أخرى': 'OTHER',
        };

        const reportType = reportTypeMap[reason] || type || 'OTHER';

        // Calculate priority
        const priority = await calculateReportPriority({
            reportType,
            reportedReelId: idStr,
            reportedUserId: reel.userId,
        });

        // Create report
        const report = await prisma.report.create({
            data: {
                reporterId: user.id,
                reportedReelId: idStr,
                reportedUserId: reel.userId,
                type: reportType as any,
                reason: reason.trim(),
                status: 'PENDING',
                priority: priority as any,
                isDuplicate: false,
            }
        });

        // Process report (create strike, check thresholds)
        const { processReport } = await import('../services/moderation.service');
        await processReport(report.id);

        // Alert admins if high priority
        if (priority === 'HIGH' || priority === 'CRITICAL') {
            const { AdminNotificationService } = await import('../services/admin-notification.service');
            await AdminNotificationService.alertHighPriorityReport(report.id, priority, reportType);
        }

        // Check report count for admin alert
        const reportCount = await prisma.report.count({
            where: {
                reportedReelId: idStr,
                status: { not: 'REJECTED' },
            },
        });

        if (reportCount >= 3) {
            const { AdminNotificationService } = await import('../services/admin-notification.service');
            await AdminNotificationService.alertContentThreshold(idStr, 'reel', reportCount);
        }

        // Log audit
        const { AuditService, AuditTargetType } = await import('../services/audit.service');
        await AuditService.logReportCreated(report.id, user.id, idStr, AuditTargetType.REEL);

        res.json({ status: 'SUCCESS', message: 'تم إرسال البلاغ بنجاح' });
    } catch (error: any) {
        logger.error('Report reel error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// RANKINGS SYSTEM (نظام الرانكينج)
// ============================================

/**
 * GET /api/reels/rankings/top-views
 * Get top 10 reels by views in the last 3 days
 * الفيديوهات الأكثر مشاهدة خلال 3 أيام
 */
router.get('/rankings/top-views', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Calculate date 3 days ago
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const topReels = await prisma.reel.findMany({
            where: {
                createdAt: {
                    gte: threeDaysAgo
                }
            },
            take,
            orderBy: { views: 'desc' },
            select: {
                id: true,
                videoUrl: true,
                thumbnail: true,
                caption: true,
                views: true,
                sharesCount: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    }
                }
            }
        });

        // Format response with rank
        const rankedReels = topReels.map((reel: any, index: any) => ({
            rank: index + 1,
            id: reel.id,
            videoUrl: reel.videoUrl,
            thumbnail: reel.thumbnail,
            caption: reel.caption,
            views: reel.views,
            likesCount: reel._count.likes,
            commentsCount: reel._count.comments,
            sharesCount: reel.sharesCount || 0,
            user: reel.user,
            createdAt: reel.createdAt,
            badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
        }));

        res.json({
            status: 'SUCCESS',
            data: {
                rankings: rankedReels,
                period: '3_days',
                totalCount: rankedReels.length,
            }
        });
    } catch (error: any) {
        logger.error('Get top views rankings error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/top-shares
 * Get top 10 reels by shares in the last 3 days
 * الفيديوهات الأكثر مشاركة خلال 3 أيام
 */
router.get('/rankings/top-shares', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Calculate date 3 days ago
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const topReels = await prisma.reel.findMany({
            where: {
                createdAt: {
                    gte: threeDaysAgo
                },
                sharesCount: {
                    gt: 0
                }
            },
            take,
            orderBy: { sharesCount: 'desc' },
            select: {
                id: true,
                videoUrl: true,
                thumbnail: true,
                caption: true,
                views: true,
                sharesCount: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    }
                }
            }
        });

        // Format response with rank
        const rankedReels = topReels.map((reel: any, index: any) => ({
            rank: index + 1,
            id: reel.id,
            videoUrl: reel.videoUrl,
            thumbnail: reel.thumbnail,
            caption: reel.caption,
            views: reel.views,
            likesCount: reel._count.likes,
            commentsCount: reel._count.comments,
            sharesCount: reel.sharesCount || 0,
            user: reel.user,
            createdAt: reel.createdAt,
            badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
        }));

        res.json({
            status: 'SUCCESS',
            data: {
                rankings: rankedReels,
                period: '3_days',
                totalCount: rankedReels.length,
            }
        });
    } catch (error: any) {
        logger.error('Get top shares rankings error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/top-predictions
 * Get top 10 users by correct predictions
 * أفضل المتوقعين (أكثر التوقعات الصحيحة)
 */
router.get('/rankings/top-predictions', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);

        // Get users with most correct predictions
        const topPredictors = await prisma.prediction.groupBy({
            by: ['userId'],
            where: {
                isCorrect: true
            },
            _count: {
                id: true,
            },
            _sum: {
                coinsWon: true,
            },
            orderBy: {
                _count: {
                    id: 'desc',
                }
            },
            take,
        });

        // Get user details for each top user
        const userIds = topPredictors.map((u: any) => u.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
                level: true,
            }
        });

        // Get total predictions for each user
        const totalPredictions = await prisma.prediction.groupBy({
            by: ['userId'],
            where: {
                userId: { in: userIds }
            },
            _count: {
                id: true,
            }
        });

        // Create maps for quick lookup
        const userMap = new Map(users.map((u: any) => [u.id, u]));
        const totalMap = new Map(totalPredictions.map((p: any) => [p.userId, p._count?.id || 0]));

        // Format response with rank
        const rankedUsers = topPredictors.map((predictor: any, index: any) => {
            const user = userMap.get(predictor.userId);
            const total = (totalMap.get(predictor.userId) as number) || 0;
            const correctCount = (predictor._count?.id as number) || 0;
            const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
            
            return {
                rank: index + 1,
                userId: predictor.userId,
                user: user || null,
                correctPredictions: correctCount,
                totalPredictions: total,
                accuracy,
                coinsWon: predictor._sum.coinsWon || 0,
                badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
            };
        });

        res.json({
            status: 'SUCCESS',
            data: {
                rankings: rankedUsers,
                totalCount: rankedUsers.length,
            }
        });
    } catch (error: any) {
        logger.error('Get top predictions rankings error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/top-commenters
 * Get top 10 users by comments count in the last 3 days
 * أكثر المستخدمين تعليقاً خلال 3 أيام
 */
router.get('/rankings/top-commenters', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Calculate date 3 days ago
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Get users with most comments in last 3 days
        const topCommenters = await prisma.comment.groupBy({
            by: ['userId'],
            where: {
                createdAt: {
                    gte: threeDaysAgo
                }
            },
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: 'desc',
                }
            },
            take,
        });

        // Get user details
        const userIds = topCommenters.map((c: any) => c.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
                level: true,
            }
        });

        const userMap = new Map(users.map((u: any) => [u.id, u]));

        // Format response with rank
        const rankedUsers = topCommenters.map((commenter: any, index: any) => {
            const user = userMap.get(commenter.userId);
            return {
                rank: index + 1,
                userId: commenter.userId,
                user: user || null,
                commentsCount: (commenter._count?.id as number) || 0,
                badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
            };
        });

        res.json({
            status: 'SUCCESS',
            data: {
                rankings: rankedUsers,
                period: '3_days',
                totalCount: rankedUsers.length,
            }
        });
    } catch (error: any) {
        logger.error('Get top commenters rankings error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/all
 * Get all rankings in one request (for efficiency)
 * كل الرانكينج في طلب واحد
 */
router.get('/rankings/all', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Calculate date 3 days ago
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Parallel queries for better performance
        const [topViewsReels, topSharesReels, topPredictors, topCommentersData] = await Promise.all([
            // Top Views — only READY reels with a playable URL, otherwise
            // Home shows thumbnails that fail when tapped.
            prisma.reel.findMany({
                where: {
                    createdAt: { gte: threeDaysAgo },
                    status: 'READY',
                    videoUrl: { not: '' },
                    isDeleted: false,
                },
                take,
                orderBy: { views: 'desc' },
                select: {
                    id: true,
                    videoUrl: true,
                    thumbnail: true,
                    caption: true,
                    views: true,
                    sharesCount: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true,
                            isVerified: true,
                        }
                    },
                    _count: { select: { likes: true, comments: true } }
                }
            }),
            // Top Shares
            prisma.reel.findMany({
                where: { 
                    createdAt: { gte: threeDaysAgo },
                    sharesCount: { gt: 0 },
                    status: 'READY',
                    videoUrl: { not: '' },
                    isDeleted: false,
                },
                take,
                orderBy: { sharesCount: 'desc' },
                select: {
                    id: true,
                    thumbnail: true,
                    caption: true,
                    views: true,
                    sharesCount: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true,
                            isVerified: true,
                        }
                    },
                    _count: { select: { likes: true, comments: true } }
                }
            }),
            // Top Predictions (correct predictions)
            prisma.prediction.groupBy({
                by: ['userId'],
                where: { isCorrect: true },
                _count: { id: true },
                _sum: { coinsWon: true },
                orderBy: { _count: { id: 'desc' } },
                take,
            }),
            // Top Commenters
            prisma.comment.groupBy({
                by: ['userId'],
                where: { createdAt: { gte: threeDaysAgo } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take,
            })
        ]);

        // Get user details for predictions and commenters rankings
        const predictorUserIds = topPredictors.map((u: any) => u.userId);
        const commenterUserIds = topCommentersData.map((c: any) => c.userId);
        const allUserIds = [...new Set([...predictorUserIds, ...commenterUserIds])];
        
        const allUsers = await prisma.user.findMany({
            where: { id: { in: allUserIds } },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
                level: true,
            }
        });
        const userMap = new Map(allUsers.map((u: any) => [u.id, u]));

        // Get total predictions for accuracy calculation
        const totalPredictions = await prisma.prediction.groupBy({
            by: ['userId'],
            where: { userId: { in: predictorUserIds } },
            _count: { id: true }
        });
        const totalMap = new Map(totalPredictions.map((p: any) => [p.userId, (p._count?.id as number) || 0]));

        // Format all rankings
        const formatReel = (reel: any, index: number) => ({
            rank: index + 1,
            id: reel.id,
            thumbnail: reel.thumbnail,
            caption: reel.caption,
            views: reel.views,
            likesCount: reel._count.likes,
            commentsCount: reel._count.comments,
            sharesCount: reel.sharesCount || 0,
            user: reel.user,
            createdAt: reel.createdAt,
            badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
        });

        res.json({
            status: 'SUCCESS',
            data: {
                topViews: topViewsReels.map(formatReel),
                topShares: topSharesReels.map(formatReel),
                topPredictions: topPredictors.map((predictor: any, index: any) => {
                    const total = (totalMap.get(predictor.userId) as number) || 0;
                    const correctCount = (predictor._count?.id as number) || 0;
                    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
                    return {
                        rank: index + 1,
                        userId: predictor.userId,
                        user: userMap.get(predictor.userId) || null,
                        correctPredictions: correctCount,
                        totalPredictions: total,
                        accuracy,
                        coinsWon: predictor._sum.coinsWon || 0,
                        badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
                    };
                }),
                topCommenters: topCommentersData.map((commenter: any, index: any) => ({
                    rank: index + 1,
                    userId: commenter.userId,
                    user: userMap.get(commenter.userId) || null,
                    commentsCount: commenter._count.id,
                    badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
                })),
                period: '3_days',
            }
        });
    } catch (error: any) {
        logger.error('Get all rankings error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/top-players
 * Get top 11 players based on views, profile visits, and likes
 * أفضل 11 لاعب بناءً على المشاهدات وزيارات البروفايل واللايكات
 * @query period - 'weekly' | 'monthly' (default: 'weekly')
 */
router.get('/rankings/top-players', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '11', period = 'weekly' } = req.query;
        const take = Math.min(parseInt(limit as string) || 11, 50);
        
        // Calculate date based on period
        const startDate = new Date();
        if (period === 'monthly') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else {
            // weekly (default)
            startDate.setDate(startDate.getDate() - 7);
        }

        // Get users with their stats aggregated for the period
        // Score = (total views * 1) + (profile views * 2) + (total likes * 3)
        const usersWithStats = await prisma.user.findMany({
            where: {
                reels: {
                    some: {
                        createdAt: {
                            gte: startDate
                        }
                    }
                }
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
                level: true,
                xp: true,
                profileViews: true,
                position: true,
                countryFlag: true,
                clubLogo: true,
                reels: {
                    where: {
                        createdAt: {
                            gte: startDate
                        }
                    },
                    select: {
                        views: true,
                        _count: {
                            select: {
                                likes: true,
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        followers: true,
                    }
                }
            }
        });

        // Calculate score for each user
        const scoredUsers = usersWithStats.map((user: any) => {
            const totalViews = user.reels.reduce((sum: any, reel: any) => sum + reel.views, 0);
            const totalLikes = user.reels.reduce((sum: any, reel: any) => sum + reel._count.likes, 0);
            const profileViews = user.profileViews || 0;
            
            // Weighted score calculation
            const score = (totalViews * 1) + (profileViews * 2) + (totalLikes * 3);
            
            return {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isVerified: user.isVerified,
                level: user.level,
                xp: user.xp,
                position: user.position || 'ST',
                countryFlag: user.countryFlag || '🇪🇬',
                clubLogo: user.clubLogo,
                followersCount: user._count.followers,
                stats: {
                    totalViews,
                    totalLikes,
                    profileViews,
                },
                score,
            };
        });

        // Sort by score and take top players
        const topPlayers = scoredUsers
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, take)
            .map((player: any, index: any) => ({
                ...player,
                rank: index + 1,
                badge: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
            }));

        res.json({
            status: 'SUCCESS',
            data: {
                players: topPlayers,
                totalCount: topPlayers.length,
                period: period as string,
            }
        });
    } catch (error: any) {
        logger.error('Get top players error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/reels/rankings/players/:userId/vote
 * Vote for a player (like or dislike)
 * التصويت للاعب
 */
router.post('/rankings/players/:userId/vote', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const userIdStr = ensureString(userId);
        const { voteType } = req.body; // 'up' or 'down'
        const clerkUserId = req.auth?.userId;

        if (!voteType || !['up', 'down'].includes(voteType)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid vote type' });
            return;
        }

        const voter = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        if (!voter) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check if target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: userIdStr },
            select: { id: true }
        });

        if (!targetUser) {
            res.status(404).json({ status: 'ERROR', message: 'Player not found' });
            return;
        }

        // Can't vote for yourself
        if (voter.id === userIdStr) {
            res.status(400).json({ status: 'ERROR', message: 'Cannot vote for yourself' });
            return;
        }

        // Check existing vote
        const existingVote = await prisma.playerVote.findUnique({
            where: {
                voterId_playerId: {
                    voterId: voter.id,
                    playerId: userIdStr,
                }
            }
        });

        let result;
        if (existingVote) {
            if (existingVote.voteType === voteType) {
                // Remove vote if same type
                await prisma.playerVote.delete({
                    where: { id: existingVote.id }
                });
                result = { action: 'removed', voteType: null };
            } else {
                // Change vote type
                await prisma.playerVote.update({
                    where: { id: existingVote.id },
                    data: { voteType }
                });
                result = { action: 'changed', voteType };
            }
        } else {
            // Create new vote
            await prisma.playerVote.create({
                data: {
                    voterId: voter.id,
                    playerId: userIdStr,
                    voteType,
                }
            });
            result = { action: 'created', voteType };
        }

        // Get updated vote counts
        const [upVotes, downVotes] = await Promise.all([
            prisma.playerVote.count({ where: { playerId: userIdStr, voteType: 'up' } }),
            prisma.playerVote.count({ where: { playerId: userIdStr, voteType: 'down' } }),
        ]);

        res.json({
            status: 'SUCCESS',
            data: {
                ...result,
                votes: {
                    up: upVotes,
                    down: downVotes,
                }
            }
        });
    } catch (error: any) {
        logger.error('Vote for player error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/players/:userId/votes
 * Get vote counts and user's vote for a player
 */
router.get('/rankings/players/:userId/votes', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const userIdStr = ensureString(userId);
        const clerkUserId = req.auth?.userId;

        const voter = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true }
        });

        // Get vote counts
        const [upVotes, downVotes] = await Promise.all([
            prisma.playerVote.count({ where: { playerId: userIdStr, voteType: 'up' } }),
            prisma.playerVote.count({ where: { playerId: userIdStr, voteType: 'down' } }),
        ]);

        // Get user's vote if logged in
        let userVote = null;
        if (voter) {
            const vote = await prisma.playerVote.findUnique({
                where: {
                    voterId_playerId: {
                        voterId: voter.id,
                        playerId: userIdStr,
                    }
                }
            });
            userVote = vote?.voteType || null;
        }

        res.json({
            status: 'SUCCESS',
            data: {
                votes: {
                    up: upVotes,
                    down: downVotes,
                },
                userVote,
            }
        });
    } catch (error: any) {
        logger.error('Get player votes error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/reels/rankings/award-badges
 * Award badges to top ranked users (called by cron job or admin)
 * منح الميداليات للمصنفين
 */
router.post('/rankings/award-badges', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, period = '3_days' } = req.body;
        
        if (!category || !['views', 'shares', 'comments', 'predictions'].includes(category)) {
            res.status(400).json({ status: 'ERROR', message: 'Invalid category' });
            return;
        }

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        let rankedUsers: { rank: number; userId: string }[] = [];

        // Get rankings based on category
        if (category === 'views') {
            const topReels = await prisma.reel.findMany({
                where: { createdAt: { gte: threeDaysAgo } },
                take: 100,
                orderBy: { views: 'desc' },
                select: { userId: true }
            });
            rankedUsers = topReels.map((r: any, i: any) => ({ rank: i + 1, userId: r.userId }));
        } else if (category === 'shares') {
            const topReels = await prisma.reel.findMany({
                where: { createdAt: { gte: threeDaysAgo }, sharesCount: { gt: 0 } },
                take: 100,
                orderBy: { sharesCount: 'desc' },
                select: { userId: true }
            });
            rankedUsers = topReels.map((r: any, i: any) => ({ rank: i + 1, userId: r.userId }));
        } else if (category === 'comments') {
            const topCommenters = await prisma.comment.groupBy({
                by: ['userId'],
                where: { createdAt: { gte: threeDaysAgo } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 100,
            });
            rankedUsers = topCommenters.map((c: any, i: any) => ({ rank: i + 1, userId: c.userId }));
        } else if (category === 'predictions') {
            const topPredictors = await prisma.prediction.groupBy({
                by: ['userId'],
                where: { isCorrect: true },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 100,
            });
            rankedUsers = topPredictors.map((p: any, i: any) => ({ rank: i + 1, userId: p.userId }));
        }

        // Award badges
        const badges = [];
        for (const user of rankedUsers) {
            let badgeType: string;
            if (user.rank === 1) badgeType = 'gold';
            else if (user.rank === 2) badgeType = 'silver';
            else if (user.rank === 3) badgeType = 'bronze';
            else badgeType = `rank_${user.rank}`;

            const badge = await prisma.rankingBadge.create({
                data: {
                    userId: user.userId,
                    badgeType,
                    category,
                    period,
                    rank: user.rank,
                }
            });
            badges.push(badge);

            // Create notification for top 3
            if (user.rank <= 3) {
                const medalName = user.rank === 1 ? 'ذهبية 🥇' : user.rank === 2 ? 'فضية 🥈' : 'برونزية 🥉';
                await enqueueNotification({
                    userId: user.userId,
                    title: 'مبروك! حصلت على ميدالية',
                    message: `حصلت على ميدالية ${medalName} في تصنيف ${category}`,
                    type: 'ACHIEVEMENT',
                    data: { badgeType, category, rank: user.rank },
                });
            }
        }

        res.json({
            status: 'SUCCESS',
            data: { badgesAwarded: badges.length }
        });
    } catch (error: any) {
        logger.error('Award badges error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * POST /api/reels/rankings/award-team-of-month
 * Award team of month badges and check for diamond streak
 * منح ميداليات تشكيلة الشهر وفحص الـ Diamond
 */
router.post('/rankings/award-team-of-month', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const currentDate = new Date();
        const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Get top 11 players for the month
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const usersWithStats = await prisma.user.findMany({
            where: {
                reels: {
                    some: { createdAt: { gte: oneMonthAgo } }
                }
            },
            select: {
                id: true,
                profileViews: true,
                reels: {
                    where: { createdAt: { gte: oneMonthAgo } },
                    select: {
                        views: true,
                        _count: { select: { likes: true } }
                    }
                }
            }
        });

        // Calculate scores and get top 11
        const scoredUsers = usersWithStats.map((user: any) => {
            const totalViews = user.reels.reduce((sum: any, reel: any) => sum + reel.views, 0);
            const totalLikes = user.reels.reduce((sum: any, reel: any) => sum + reel._count.likes, 0);
            const score = (totalViews * 1) + ((user.profileViews || 0) * 2) + (totalLikes * 3);
            return { userId: user.id, score };
        }).sort((a: any, b: any) => b.score - a.score).slice(0, 11);

        const diamondAwards = [];
        const badges = [];

        for (let i = 0; i < scoredUsers.length; i++) {
            const user = scoredUsers[i];
            const rank = i + 1;
            const badgeType = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : `rank_${rank}`;

            // Award team of month badge
            const badge = await prisma.rankingBadge.create({
                data: {
                    userId: user.userId,
                    badgeType,
                    category: 'team_of_month',
                    period: 'monthly',
                    rank,
                    monthYear,
                }
            });
            badges.push(badge);

            // Update streak tracking
            let streak = await prisma.teamOfMonthStreak.findUnique({
                where: { userId: user.userId }
            });

            if (streak) {
                // Check if last month was consecutive
                const lastMonth = new Date(currentDate);
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                const expectedLastMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

                if (streak.lastMonthYear === expectedLastMonth) {
                    // Consecutive month!
                    const newConsecutive = streak.consecutiveMonths + 1;
                    
                    await prisma.teamOfMonthStreak.update({
                        where: { userId: user.userId },
                        data: {
                            consecutiveMonths: newConsecutive,
                            lastMonthYear: monthYear,
                        }
                    });

                    // Check for Diamond (3 consecutive months)
                    if (newConsecutive >= 3 && !streak.diamondAwarded) {
                        await prisma.teamOfMonthStreak.update({
                            where: { userId: user.userId },
                            data: {
                                diamondAwarded: true,
                                diamondAwardedAt: new Date(),
                            }
                        });

                        // Award Diamond badge
                        await prisma.rankingBadge.create({
                            data: {
                                userId: user.userId,
                                badgeType: 'diamond',
                                category: 'team_of_month',
                                period: 'monthly',
                                rank: 0, // Special rank for diamond
                                monthYear,
                            }
                        });

                        // Award coins as gift
                        await prisma.user.update({
                            where: { id: user.userId },
                            data: { coins: { increment: 1000 } }
                        });

                        await prisma.coinTransaction.create({
                            data: {
                                userId: user.userId,
                                amount: 1000,
                                type: 'ACHIEVEMENT',
                                description: 'هدية ميدالية الدايموند - 3 شهور متتالية في تشكيلة الشهر'
                            }
                        });

                        await enqueueNotification({
                            userId: user.userId,
                            title: '💎 مبروك! حصلت على ميدالية الدايموند!',
                            message: 'أنت بطل! ظهرت في تشكيلة الشهر 3 شهور متتالية. حصلت على 1000 كوين هدية!',
                            type: 'ACHIEVEMENT',
                            data: { badgeType: 'diamond', coinsAwarded: 1000 },
                        });

                        diamondAwards.push(user.userId);
                    }
                } else {
                    // Reset streak
                    await prisma.teamOfMonthStreak.update({
                        where: { userId: user.userId },
                        data: {
                            consecutiveMonths: 1,
                            lastMonthYear: monthYear,
                        }
                    });
                }
            } else {
                // First time in team of month
                await prisma.teamOfMonthStreak.create({
                    data: {
                        userId: user.userId,
                        consecutiveMonths: 1,
                        lastMonthYear: monthYear,
                    }
                });
            }

            // Notification for top 3
            if (rank <= 3) {
                const medalName = rank === 1 ? 'ذهبية 🥇' : rank === 2 ? 'فضية 🥈' : 'برونزية 🥉';
                await enqueueNotification({
                    userId: user.userId,
                    title: 'مبروك! أنت في تشكيلة الشهر',
                    message: `حصلت على ميدالية ${medalName} في تشكيلة الشهر`,
                    type: 'ACHIEVEMENT',
                    data: { badgeType, category: 'team_of_month', rank },
                });
            }
        }

        res.json({
            status: 'SUCCESS',
            data: {
                badgesAwarded: badges.length,
                diamondAwards: diamondAwards.length,
                monthYear,
            }
        });
    } catch (error: any) {
        logger.error('Award team of month error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/user-rank
 * Get current user's rank in all categories
 * جلب رتبة المستخدم الحالي في كل الفئات
 */
router.get('/rankings/user-rank', requireAuth, responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Calculate date 3 days ago
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Get user's rank in each category
        const [viewsRank, sharesRank, predictionsRank, commentersRank] = await Promise.all([
            // Views rank
            (async () => {
                const reels = await prisma.reel.findMany({
                    where: { createdAt: { gte: threeDaysAgo } },
                    orderBy: { views: 'desc' },
                    select: { userId: true, views: true }
                });
                const userReel = reels.find((r: any) => r.userId === user.id);
                if (!userReel) return null;
                const rank = reels.findIndex((r: any) => r.userId === user.id) + 1;
                return rank <= 10 ? rank : null;
            })(),
            // Shares rank
            (async () => {
                const reels = await prisma.reel.findMany({
                    where: { createdAt: { gte: threeDaysAgo } },
                    orderBy: { sharesCount: 'desc' },
                    select: { userId: true, sharesCount: true }
                });
                const userReel = reels.find((r: any) => r.userId === user.id);
                if (!userReel) return null;
                const rank = reels.findIndex((r: any) => r.userId === user.id) + 1;
                return rank <= 10 ? rank : null;
            })(),
            // Predictions rank
            (async () => {
                const topPredictors = await prisma.prediction.groupBy({
                    by: ['userId'],
                    where: { isCorrect: true },
                    _count: { id: true },
                    orderBy: { _count: { id: 'desc' } },
                    take: 10
                });
                const userIndex = topPredictors.findIndex((p: any) => p.userId === user.id);
                return userIndex >= 0 ? userIndex + 1 : null;
            })(),
            // Commenters rank
            (async () => {
                const topCommenters = await prisma.comment.groupBy({
                    by: ['userId'],
                    where: { createdAt: { gte: threeDaysAgo } },
                    _count: { id: true },
                    orderBy: { _count: { id: 'desc' } },
                    take: 10
                });
                const userIndex = topCommenters.findIndex((c: any) => c.userId === user.id);
                return userIndex >= 0 ? userIndex + 1 : null;
            })()
        ]);

        res.json({
            status: 'SUCCESS',
            data: {
                views: viewsRank,
                shares: sharesRank,
                predictions: predictionsRank,
                comments: commentersRank,
                hasAnyRank: !!(viewsRank || sharesRank || predictionsRank || commentersRank)
            }
        });
    } catch (error: any) {
        logger.error('Get user rank error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

/**
 * GET /api/reels/rankings/user/:userId/badges
 * Get all badges for a user
 * جلب كل ميداليات المستخدم
 */
router.get('/rankings/user/:userId/badges', responseCacheMiddleware({ ttl: 5 * 60 * 1000 }), async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const userIdStr = ensureString(userId);

        const badges = await prisma.rankingBadge.findMany({
            where: { userId: userIdStr },
            orderBy: { earnedAt: 'desc' },
        });

        // Get diamond streak info
        const streak = await prisma.teamOfMonthStreak.findUnique({
            where: { userId: userIdStr }
        });

        // Group badges by type
        const goldBadges = badges.filter((b: { badgeType: string }) => b.badgeType === 'gold');
        const silverBadges = badges.filter((b: { badgeType: string }) => b.badgeType === 'silver');
        const bronzeBadges = badges.filter((b: { badgeType: string }) => b.badgeType === 'bronze');
        const diamondBadges = badges.filter((b: { badgeType: string }) => b.badgeType === 'diamond');
        const rankBadges = badges.filter((b: { badgeType: string }) => b.badgeType.startsWith('rank_'));

        res.json({
            status: 'SUCCESS',
            data: {
                badges,
                summary: {
                    gold: goldBadges.length,
                    silver: silverBadges.length,
                    bronze: bronzeBadges.length,
                    diamond: diamondBadges.length,
                    ranked: rankBadges.length,
                    total: badges.length,
                },
                streak: streak ? {
                    consecutiveMonths: streak.consecutiveMonths,
                    diamondAwarded: streak.diamondAwarded,
                    diamondAwardedAt: streak.diamondAwardedAt,
                } : null,
            }
        });
    } catch (error: any) {
        logger.error('Get user badges error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// GET /api/reels
// Get all reels (alias for /feed)
// ============================================
router.get('/', requireAuth, lenientLimiter, async (req: Request, res: Response): Promise<void> => {
    // Forward to /feed endpoint logic
    try {
        const { cursor, limit = REELS_PER_PAGE.toString() } = req.query;
        const currentUserId = req.auth?.userId;
        const take = Math.min(parseInt(limit as string) || REELS_PER_PAGE, 10);

        // Check feed cache (only for first page without cursor)
        const cacheKey = `feed_${currentUserId}_${cursor || 'first'}_${take}`;
        const cached = await getFeedFromCache(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        // Get current user's DB id (with caching)
        let currentUser: { id: string } | null = null;
        if (currentUserId) {
            const cachedUserId = userIdCache.get(currentUserId);
            if (cachedUserId && Date.now() - cachedUserId.timestamp < USER_ID_CACHE_TTL) {
                currentUser = { id: cachedUserId.id };
            } else {
                currentUser = await prisma.user.findUnique({
                    where: { clerkUserId: currentUserId },
                    select: { id: true }
                });
                if (currentUser) {
                    userIdCache.set(currentUserId, { id: currentUser.id, timestamp: Date.now() });
                }
            }
        }

        const reels = await prisma.reel.findMany({
            where: {
                isDeleted: false,
                status: 'READY', // Fix 7: exclude PROCESSING/FAILED reels from feed
            },
            take: take + 1,
            ...(cursor && { cursor: { id: cursor as string }, skip: 1 }),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                videoUrl: true,
                thumbnail: true,
                caption: true,
                views: true,
                sharesCount: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    }
                },
                hashtags: {
                    select: {
                        hashtag: {
                            select: { name: true }
                        }
                    }
                },
                mentions: {
                    select: {
                        mentionedUserId: true
                    }
                },
                comments: {
                    where: { isDeleted: false },
                    take: MAX_COMMENTS_PREVIEW,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        content: true,
                        createdAt: true,
                        user: {
                            select: {
                                username: true,
                                avatar: true,
                            }
                        }
                    }
                },
                likes: currentUser ? {
                    where: { userId: currentUser.id },
                    select: { id: true }
                } : false,
                savedBy: currentUser ? {
                    where: { userId: currentUser.id },
                    select: { id: true }
                } : false,
            }
        });

        const hasMore = reels.length > take;
        const data = hasMore ? reels.slice(0, -1) : reels;
        const nextCursor = hasMore ? data[data.length - 1]?.id : null;

        const formattedReels = data.map((reel: any) => ({
            id: reel.id,
            videoUrl: reel.videoUrl,
            thumbnail: reel.thumbnail,
            caption: reel.caption,
            views: reel.views,
            likesCount: reel._count.likes,
            commentsCount: reel._count.comments,
            sharesCount: reel.sharesCount || 0,
            isLiked: Array.isArray(reel.likes) && reel.likes.length > 0,
            isSaved: Array.isArray(reel.savedBy) && reel.savedBy.length > 0,
            hashtags: reel.hashtags.map((h: any) => h.hashtag.name),
            mentions: reel.mentions.map((m: any) => m.mentionedUserId),
            previewComments: reel.comments,
            user: reel.user,
            createdAt: reel.createdAt,
        }));

        const responseData = {
            status: 'SUCCESS',
            data: {
                reels: formattedReels,
                nextCursor,
                hasMore,
            }
        };

        await setFeedCache(cacheKey, responseData);
        res.json(responseData);
    } catch (error: any) {
        logger.error('Get reels feed error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// GET /api/reels/trending
// Get trending reels (most viewed/liked in last 24 hours)
// ============================================
router.get('/trending', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 20);
        
        // Get reels from last 24 hours, sorted by engagement
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const trendingReels = await prisma.reel.findMany({
            where: {
                isDeleted: false,
                createdAt: { gte: yesterday }
            },
            take,
            orderBy: [
                { views: 'desc' }
            ],
            select: {
                id: true,
                videoUrl: true,
                thumbnail: true,
                caption: true,
                views: true,
                sharesCount: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    }
                }
            }
        });
        
        res.json({
            status: 'SUCCESS',
            data: {
                reels: trendingReels.map(reel => ({
                    ...reel,
                    likesCount: reel._count.likes,
                    commentsCount: reel._count.comments,
                }))
            }
        });
    } catch (error: any) {
        logger.error('Get trending reels error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// GET /api/reels/rankings
// Get user rankings by reel engagement
// ============================================
router.get('/rankings', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Get users with most total views/likes on their reels
        const rankings = await prisma.user.findMany({
            take,
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
                reels: {
                    where: { isDeleted: false },
                    select: {
                        views: true,
                        _count: {
                            select: { likes: true }
                        }
                    }
                }
            },
            orderBy: {
                reels: {
                    _count: 'desc'
                }
            }
        });
        
        // Calculate total engagement for each user
        const rankedUsers = rankings.map(user => {
            const totalViews = user.reels.reduce((sum, reel) => sum + reel.views, 0);
            const totalLikes = user.reels.reduce((sum, reel) => sum + reel._count.likes, 0);
            const reelsCount = user.reels.length;
            
            return {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isVerified: user.isVerified,
                stats: {
                    totalViews,
                    totalLikes,
                    reelsCount,
                    engagement: totalViews + (totalLikes * 10) // Weight likes more
                }
            };
        }).sort((a, b) => b.stats.engagement - a.stats.engagement);
        
        res.json({
            status: 'SUCCESS',
            data: { rankings: rankedUsers }
        });
    } catch (error: any) {
        logger.error('Get reels rankings error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// GET /api/reels/:id/signed-url  (Fix 3)
// Return a fresh signed URL for a reel video
// ============================================
router.get('/:id/signed-url', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const reelId = ensureString(req.params.id);
        const clerkUserId = req.auth?.userId;

        const reel = await prisma.reel.findUnique({
            where: { id: reelId },
            select: { id: true, userId: true, videoStoragePath: true, processedVideoKey: true, isDeleted: true },
        });

        if (!reel || reel.isDeleted) {
            res.status(404).json({ status: 'ERROR', message: 'Reel not found' });
            return;
        }

        // Fix 3: Verify ownership — only the reel owner gets a signed URL
        const currentUser = clerkUserId
            ? await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } })
            : null;

        if (!currentUser || currentUser.id !== reel.userId) {
            res.status(403).json({ status: 'ERROR', message: 'Access denied' });
            return;
        }

        const storagePath = reel.processedVideoKey || reel.videoStoragePath;
        if (!storagePath) {
            res.status(404).json({ status: 'ERROR', message: 'Video file not found in storage' });
            return;
        }

        let signedUrl: string;
        try {
            signedUrl = await r2MediaStorage.generateSignedUrl(storagePath, 3600);
        } catch (signErr: any) {
            logger.error('[reels/signed-url] AWS SDK error:', signErr?.message);
            res.status(500).json({ status: 'ERROR', message: 'Failed to generate signed URL' });
            return;
        }

        res.json({
            status: 'SUCCESS',
            data: { reelId, signedUrl, expiresIn: 3600 },
        });
    } catch (error: any) {
        logger.error('Get signed URL error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

// ============================================
// DELETE /api/reels/:id  (Fix 4 – R2 cascade)
// Delete a reel and its R2 files
// ============================================
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const reelId = ensureString(req.params.id);
        const clerkUserId = req.auth?.userId;

        const user = await prisma.user.findUnique({
            where: { clerkUserId: clerkUserId! },
            select: { id: true, reelDeleteCount: true },
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        const MAX_REEL_DELETES = 2;
        if (user.reelDeleteCount >= MAX_REEL_DELETES) {
            res.status(429).json({
                status: 'ERROR',
                code: 'MAX_DELETES_REACHED',
                message: 'لقد وصلت للحد الأقصى من مسح الفيديوهات (2 مرات)',
                deletesUsed: user.reelDeleteCount,
                maxDeletes: MAX_REEL_DELETES,
            });
            return;
        }

        const reel = await prisma.reel.findUnique({
            where: { id: reelId },
            select: { userId: true, videoStoragePath: true, processedVideoKey: true, thumbnailStoragePath: true, fileSizeBytes: true, muxAssetId: true },
        });

        if (!reel) {
            res.status(404).json({ status: 'ERROR', message: 'Reel not found' });
            return;
        }

        if (reel.userId !== user.id) {
            res.status(403).json({ status: 'ERROR', message: 'Not authorized to delete this reel' });
            return;
        }

        // Fix 4: Delete storage files (Mux asset OR R2 files)
        if (reel.muxAssetId) {
            // New reels: delete from Mux
            const { deleteAsset } = await import('../services/mux.service');
            await deleteAsset(reel.muxAssetId);
        } else {
            // Legacy reels: delete from R2
            const pathsToDelete = [
                reel.videoStoragePath,
                reel.processedVideoKey,
            ].filter(Boolean) as string[];
            for (const p of pathsToDelete) {
                const ok = await r2MediaStorage.deleteObject(p);
                if (!ok) logger.warn(`[reels/delete] Could not delete R2 object: ${p}`);
            }
        }

        // Always delete thumbnail from R2 (both old and new reels)
        if (reel.thumbnailStoragePath) {
            r2MediaStorage.deleteObject(reel.thumbnailStoragePath).catch((err: any) =>
                logger.warn('[reels/delete] Thumbnail R2 delete failed:', err?.message),
            );
        }

        await prisma.$transaction([
            prisma.reel.delete({ where: { id: reelId } }),
            prisma.user.update({
                where: { id: user.id },
                data: {
                    reelDeleteCount: { increment: 1 },
                    lastReelUpload: null,
                    // Fix 7: Decrement storage quota using stored file size
                    ...(reel.fileSizeBytes > 0
                        ? { storageUsedBytes: { decrement: reel.fileSizeBytes } }
                        : {}),
                },
            }),
        ]);

        res.json({
            status: 'SUCCESS',
            message: 'تم حذف الفيديو بنجاح',
            data: {
                deletesUsed: user.reelDeleteCount + 1,
                remainingDeletes: MAX_REEL_DELETES - (user.reelDeleteCount + 1),
                maxDeletes: MAX_REEL_DELETES,
                uploadCooldownReset: true,
            },
        });
    } catch (error: any) {
        logger.error('Delete reel error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
    }
});

export default router;
