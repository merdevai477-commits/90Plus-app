import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { validateVideoDuration } from '../middleware/file-validation.middleware';
import { optimizeUploadedImage } from '../middleware/image-optimization.middleware';
import { validateUploadedImage } from '../middleware/image-moderation.middleware';
import { r2MediaStorage } from '../services/r2-media-storage.service';
import { invalidateUserCache } from './clerk-user.routes';
import multer from 'multer';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import path from 'path';

const router = Router();

function sanitizeOriginalName(name: string | undefined, fallback: string): string {
    const base = path.basename(name || fallback);
    return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function sendError(
    res: Response,
    httpStatus: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
): void {
    res.status(httpStatus).json({
        status: 'ERROR',
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
    });
}

// Configure multer for memory storage (images)
const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB max for images
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype?.startsWith('image/')) return cb(null, true);
        cb(null, false);
    },
});

// Configure multer for memory storage (reels)
const uploadReel = multer({
    storage: multer.memoryStorage(),
    limits: {
        // Keep strict: backend should reject >50MB fast, and avoid holding bigger buffers in memory
        fileSize: 55 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const mt = (file.mimetype || '').toLowerCase();
        const ok = mt.startsWith('video/') || mt.startsWith('image/');
        cb(null, ok);
    },
});

// Constants - Strict Cooldown Rules
const AVATAR_CHANGE_COOLDOWN_DAYS = 7;
const COVER_CHANGE_COOLDOWN_DAYS = 15;
const REEL_UPLOAD_COOLDOWN_DAYS = 3;
/** يمنع عدة طلبات رفع متزامنة لنفس المستخدم (حتى لا يتجاوز الجميع فحص الـ cooldown قبل تحديث lastReelUpload) */
const REEL_UPLOAD_LOCK_MS = 25 * 60 * 1000;

type BeginReelUploadResult =
    | { ok: true; userId: string }
    | { ok: false; status: number; payload: Record<string, unknown> };

async function beginReelUploadForClerkUser(clerkUserId: string): Promise<BeginReelUploadResult> {
    try {
        return await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT 1 FROM "users" WHERE "clerkUserId" = ${clerkUserId} FOR UPDATE`;
            const user = await tx.user.findUnique({
                where: { clerkUserId },
                select: { id: true, lastReelUpload: true, reelUploadLockedUntil: true },
            });
            if (!user) {
                return {
                    ok: false,
                    status: 404,
                    payload: {
                        status: 'ERROR',
                        code: 'USER_NOT_FOUND',
                        message: 'User not found',
                        timestamp: new Date().toISOString(),
                    },
                };
            }
            const now = Date.now();
            if (user.reelUploadLockedUntil && user.reelUploadLockedUntil.getTime() > now) {
                return {
                    ok: false,
                    status: 429,
                    payload: {
                        status: 'ERROR',
                        code: 'REEL_UPLOAD_IN_PROGRESS',
                        message: 'يتم رفع فيديو بالفعل. انتظر حتى يكتمل ثم حاول مجدداً.',
                        timestamp: new Date().toISOString(),
                    },
                };
            }
            if (user.lastReelUpload) {
                const daysSince = Math.floor(
                    (now - new Date(user.lastReelUpload).getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysSince < REEL_UPLOAD_COOLDOWN_DAYS) {
                    const hoursRemaining = Math.ceil(
                        REEL_UPLOAD_COOLDOWN_DAYS * 24 -
                            (now - new Date(user.lastReelUpload).getTime()) / (1000 * 60 * 60)
                    );
                    return {
                        ok: false,
                        status: 429,
                        payload: {
                            status: 'ERROR',
                            code: 'COOLDOWN_ACTIVE',
                            message: `يمكنك رفع فيديو جديد بعد ${hoursRemaining} ساعة`,
                            hoursRemaining,
                            timestamp: new Date().toISOString(),
                        },
                    };
                }
            }
            await tx.user.update({
                where: { id: user.id },
                data: { reelUploadLockedUntil: new Date(now + REEL_UPLOAD_LOCK_MS) },
            });
            return { ok: true, userId: user.id };
        });
    } catch (e: any) {
        logger.error('[upload/reel] beginReelUploadForClerkUser:', e);
        return {
            ok: false,
            status: 500,
            payload: {
                status: 'ERROR',
                code: 'LOCK_ERROR',
                message: 'تعذّر بدء الرفع. حاول مرة أخرى.',
                timestamp: new Date().toISOString(),
            },
        };
    }
}

/**
 * POST /api/upload/avatar
 * Upload avatar image to R2 Storage
 */
router.post('/avatar', requireAuth, uploadImage.single('file'), validateUploadedImage, optimizeUploadedImage, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
            return;
        }

        const file = req.file;
        if (!file) {
            logger.error('No file received in avatar upload request');
            sendError(res, 400, 'NO_FILE', 'No file provided');
            return;
        }

        // Validate file properties
        if (!file.buffer) {
            logger.error('File buffer is missing in avatar upload');
            sendError(res, 400, 'INVALID_FILE', 'File buffer is missing');
            return;
        }

        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            logger.error(`Invalid file type in avatar upload: ${file.mimetype}`);
            sendError(res, 400, 'INVALID_FILE_TYPE', 'Invalid file type. Only images are allowed.', { mimetype: file.mimetype });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastAvatarChange: true, avatarStoragePath: true }
        });

        if (!user) {
            sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
            return;
        }

        // Check 7 days cooldown
        if (user.lastAvatarChange) {
            const daysSince = Math.floor((Date.now() - new Date(user.lastAvatarChange).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince < AVATAR_CHANGE_COOLDOWN_DAYS) {
                const daysRemaining = AVATAR_CHANGE_COOLDOWN_DAYS - daysSince;
                
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        type: 'GENERAL',
                        title: 'تغيير صورة البروفايل',
                        message: `لا يمكنك تغيير صورة البروفايل الآن. يرجى الانتظار ${daysRemaining} يوم.`,
                        data: { type: 'AVATAR_COOLDOWN', daysRemaining, cooldownDays: AVATAR_CHANGE_COOLDOWN_DAYS }
                    }
                });
                
                sendError(res, 429, 'COOLDOWN_ACTIVE', `يمكنك تغيير صورة البروفايل بعد ${daysRemaining} يوم`, { daysRemaining });
                return;
            }
        }


        // Delete old avatar if exists
        if (user.avatarStoragePath) {
            await r2MediaStorage.deleteObject(user.avatarStoragePath);
        }

        // Validate file buffer is not empty
        if (file.buffer.length === 0) {
            logger.error('Empty file buffer received');
            sendError(res, 400, 'EMPTY_FILE', 'File is empty or corrupted');
            return;
        }

        logger.info(`Uploading avatar: ${file.originalname}, size: ${file.buffer.length} bytes, type: ${file.mimetype}`);

        // Upload new avatar
        const safeName = sanitizeOriginalName(file.originalname, 'avatar');
        const result = await r2MediaStorage.uploadPublic('avatars', user.id, file.buffer, safeName, file.mimetype);

        if (!result.success) {
            logger.error('R2 upload error:', result.error);
            sendError(res, 500, 'STORAGE_UPLOAD_FAILED', result.error || 'Failed to upload file');
            return;
        }

        if (!result.url || !result.key) {
            logger.error('R2 upload succeeded but missing url/key. Check R2_MEDIA_PUBLIC_URL / R2_PUBLIC_URL configuration.');
            sendError(res, 500, 'STORAGE_URL_MISSING', 'File uploaded but public URL not available. Please check server configuration.');
            return;
        }

        logger.info(`Avatar uploaded successfully: ${result.url}, key: ${result.key}`);

        // Update user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                avatar: result.url,
                avatarStoragePath: result.key,
                lastAvatarChange: new Date()
            }
        });

        // Invalidate cache so /me returns fresh data
        invalidateUserCache(clerkUserId);
        
        // ✅ CRITICAL: Recalculate profile completion after avatar upload
        try {
          const { ProfileCompletionService } = await import('../services/profile-completion.service');
          await ProfileCompletionService.getCompletionStatus(clerkUserId);
          logger.info('✅ Profile completion recalculated after avatar upload');
        } catch (err) {
          logger.error('Failed to recalculate profile completion:', err);
        }

        res.json({
            status: 'SUCCESS',
            message: 'تم رفع صورة البروفايل بنجاح',
            data: { url: result.url, storagePath: result.key }
        });
    } catch (error: any) {
        logger.error('Upload avatar error:', error);
        sendError(res, 500, 'UPLOAD_ERROR', error?.message || 'Upload failed');
    }
});

/**
 * POST /api/upload/cover
 * Upload cover image to R2 Storage
 */
router.post('/cover', requireAuth, uploadImage.single('file'), validateUploadedImage, optimizeUploadedImage, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
            return;
        }

        const file = req.file;
        if (!file) {
            sendError(res, 400, 'NO_FILE', 'No file provided');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastCoverChange: true, coverStoragePath: true }
        });

        if (!user) {
            sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
            return;
        }

        // Check 15 days cooldown
        if (user.lastCoverChange) {
            const daysSince = Math.floor((Date.now() - new Date(user.lastCoverChange).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince < COVER_CHANGE_COOLDOWN_DAYS) {
                const daysRemaining = COVER_CHANGE_COOLDOWN_DAYS - daysSince;
                
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        type: 'GENERAL',
                        title: 'تغيير صورة الغلاف',
                        message: `لا يمكنك تغيير صورة الغلاف الآن. يرجى الانتظار ${daysRemaining} يوم.`,
                        data: { type: 'COVER_COOLDOWN', daysRemaining, cooldownDays: COVER_CHANGE_COOLDOWN_DAYS }
                    }
                });
                
                sendError(res, 429, 'COOLDOWN_ACTIVE', `يمكنك تغيير صورة الغلاف بعد ${daysRemaining} يوم`, { daysRemaining });
                return;
            }
        }

        // Delete old cover if exists
        if (user.coverStoragePath) {
            await r2MediaStorage.deleteObject(user.coverStoragePath);
        }

        // Upload new cover
        const safeName = sanitizeOriginalName(file.originalname, 'cover');
        const result = await r2MediaStorage.uploadPublic('covers', user.id, file.buffer, safeName, file.mimetype);

        if (!result.success) {
            sendError(res, 500, 'STORAGE_UPLOAD_FAILED', result.error || 'Failed to upload file');
            return;
        }
        if (!result.url || !result.key) {
            sendError(res, 500, 'STORAGE_URL_MISSING', 'File uploaded but public URL not available. Please check server configuration.');
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                coverImage: result.url,
                coverStoragePath: result.key,
                lastCoverChange: new Date()
            }
        });

        // Invalidate cache so /me returns fresh data
        invalidateUserCache(clerkUserId);

        res.json({
            status: 'SUCCESS',
            message: 'تم رفع صورة الغلاف بنجاح',
            data: { url: result.url, storagePath: result.key }
        });
    } catch (error: any) {
        logger.error('Upload cover error:', error);
        sendError(res, 500, 'UPLOAD_ERROR', error?.message || 'Upload failed');
    }
});


/**
 * POST /api/upload/reel
 * Upload reel video to R2 Storage
 */
router.post(
    '/reel', 
    requireAuth, 
    uploadReel.fields([
        { name: 'video', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 }
    ]), 
    validateVideoDuration, 
    async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let videoUploaded = false;
    let thumbnailUploaded = false;
    type UploadOk = { success: true; url: string; key: string };
    type UploadFail = { success: false; error: string };
    type UploadResult = UploadOk | UploadFail;
    let videoResult: UploadResult | null = null;
    let thumbnailPath: string | null = null;
    let reelSlotHeld = false;
    let reelUploadCommitted = false;
    let heldUserId: string | null = null;

    try {
        // Note: Timeout is handled by middleware in main.ts (req.setTimeout)
        // Railway gateway has a 60s timeout, so we must complete within that time
        
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            sendError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
            return;
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const videoFile = files['video']?.[0];
        const thumbnailFile = files['thumbnail']?.[0];

        if (!videoFile) {
            sendError(res, 400, 'NO_FILE', 'No video provided');
            return;
        }

        // Validate file size early
        if (videoFile.buffer.length > 50 * 1024 * 1024) { // 50MB
            sendError(res, 413, 'FILE_TOO_LARGE', 'Video file is too large. Maximum size is 50MB.', { maxBytes: 50 * 1024 * 1024 });
            return;
        }

        const begin = await beginReelUploadForClerkUser(clerkUserId);
        if (!begin.ok) {
            res.status(begin.status).json(begin.payload);
            return;
        }
        reelSlotHeld = true;
        heldUserId = begin.userId;
        const user = { id: begin.userId };

        // Upload video with timeout protection
        // Railway gateway timeout is 60s, so we need to complete upload + response within that time
        // Reduce upload timeout to 45s to leave buffer for response processing
        const videoFileName = sanitizeOriginalName(videoFile.originalname, 'reel');
        const fileSizeMB = (videoFile.buffer.length / (1024 * 1024)).toFixed(2);
        logger.info(`Starting video upload: ${videoFileName}, size: ${fileSizeMB}MB (${videoFile.buffer.length} bytes), type: ${videoFile.mimetype}`);
        
        const uploadStartTime = Date.now();
        
        const uploadPromise: Promise<UploadResult> = r2MediaStorage
            .uploadPublic('reels', user.id, videoFile.buffer, videoFileName, videoFile.mimetype)
            .then((r) => (r.success && r.url && r.key ? { success: true, url: r.url, key: r.key } : { success: false, error: r.error || 'Upload failed' }));
        
        const timeoutPromise: Promise<UploadFail> = new Promise((resolve) => {
            setTimeout(() => {
                const elapsed = Date.now() - uploadStartTime;
                logger.error(`R2 upload timeout after ${elapsed}ms for file: ${videoFileName}`);
                
                resolve({ 
                    success: false, 
                    error: 'Upload to storage timed out. File may be too large. Maximum size is 50MB.' 
                });
            }, 45 * 1000); // 45 seconds - leaving 15s buffer for response
        });

        videoResult = await Promise.race([uploadPromise, timeoutPromise]);

        if (!videoResult || !videoResult.success) {
            const elapsed = Date.now() - uploadStartTime;
            logger.error(`Video upload failed after ${elapsed}ms. File: ${videoFileName}, Size: ${fileSizeMB}MB, Error: ${videoResult?.error || 'Unknown error'}`);
            sendError(res, 500, 'UPLOAD_FAILED', videoResult?.error || 'Failed to upload video to storage. Please try again or use a smaller file.');
            return;
        }
        
        // At this point UploadResult must be UploadOk
        
        videoUploaded = true;
        const uploadTime = Date.now() - uploadStartTime;
        logger.info(`Video uploaded successfully in ${uploadTime}ms (${(uploadTime/1000).toFixed(2)}s). File: ${videoFileName}, Size: ${fileSizeMB}MB, URL: ${videoResult.url}`);

        // Upload thumbnail if provided (with timeout)
        let thumbnailUrl = null;
        if (thumbnailFile) {
            try {
                const thumbFileName = `${user.id}/${Date.now()}_thumb_${thumbnailFile.originalname}`;
                const thumbSizeMB = (thumbnailFile.buffer.length / (1024 * 1024)).toFixed(2);
                logger.info(`Starting thumbnail upload: ${thumbFileName}, size: ${thumbSizeMB}MB`);
                const thumbStartTime = Date.now();
                
                const thumbUploadPromise: Promise<UploadResult> = r2MediaStorage
                    .uploadPublic('thumbnails', user.id, thumbnailFile.buffer, thumbFileName, thumbnailFile.mimetype)
                    .then((r) => (r.success && r.url && r.key ? { success: true, url: r.url, key: r.key } : { success: false, error: r.error || 'Thumbnail upload failed' }));
                const thumbTimeoutPromise: Promise<UploadFail> = new Promise((resolve) => {
                    setTimeout(() => {
                        const elapsed = Date.now() - thumbStartTime;
                        logger.warn(`Thumbnail upload timeout after ${elapsed}ms: ${thumbFileName}`);
                        resolve({ success: false, error: 'Thumbnail upload timed out' });
                    }, 10 * 1000); // 10 seconds for thumbnail
                });

                const thumbResult: UploadResult = await Promise.race([thumbUploadPromise, thumbTimeoutPromise]);
                if (thumbResult.success) {
                    thumbnailUrl = thumbResult.url;
                    thumbnailPath = thumbResult.key;
                    thumbnailUploaded = true;
                    const thumbTime = Date.now() - thumbStartTime;
                    logger.info(`Thumbnail uploaded successfully in ${thumbTime}ms: ${thumbFileName}`);
                } else {
                    logger.warn(`Thumbnail upload failed for ${thumbFileName}, continuing without thumbnail. Error: ${thumbResult.error}`);
                }
            } catch (thumbError: any) {
                logger.warn(`Thumbnail upload exception for ${thumbnailFile.originalname}:`, thumbError?.message || thumbError);
            }
        }

        // Parse metadata (with error handling)
        let hashtags: string[] = [];
        let mentions: string[] = [];
        let caption: string | null = null;
        try {
            const { caption: captionFromBody, hashtags: hashtagsJson, mentions: mentionsJson } = req.body;
            caption = captionFromBody || null;
            hashtags = hashtagsJson ? (typeof hashtagsJson === 'string' ? JSON.parse(hashtagsJson) : hashtagsJson) : [];
            mentions = mentionsJson ? (typeof mentionsJson === 'string' ? JSON.parse(mentionsJson) : mentionsJson) : [];
        } catch (parseError: any) {
            logger.warn('Failed to parse metadata (hashtags/mentions), continuing with empty arrays:', parseError?.message);
        }

        // Create reel in database
        if (!videoResult || !videoResult.success) {
            logger.error('Cannot create reel: videoResult is missing required fields');
            sendError(res, 500, 'MISSING_DATA', 'Video upload completed but required data is missing');
            return;
        }

        const reel = await prisma.reel.create({
            data: {
                userId: user.id,
                videoUrl: videoResult.url,
                videoStoragePath: videoResult.key,
                thumbnail: thumbnailUrl,
                thumbnailStoragePath: thumbnailPath,
                caption: caption || null,
            }
        });

        // Process hashtags
        for (const tag of hashtags) {
            const cleanTag = tag.toLowerCase().replace(/^#/, '');
            if (cleanTag) {
                const hashtag = await prisma.hashtag.upsert({
                    where: { name: cleanTag },
                    create: { name: cleanTag, reelCount: 1 },
                    update: { reelCount: { increment: 1 } }
                });
                await prisma.reelHashtag.create({
                    data: { reelId: reel.id, hashtagId: hashtag.id }
                });
            }
        }

        // Process mentions
        for (const username of mentions) {
            const mentionedUser = await prisma.user.findUnique({
                where: { username: username.replace(/^@/, '') },
                select: { id: true }
            });
            if (mentionedUser) {
                await prisma.reelMention.create({
                    data: { reelId: reel.id, mentionedUserId: mentionedUser.id }
                });
                await prisma.notification.create({
                    data: {
                        userId: mentionedUser.id,
                        title: 'تم الإشارة إليك',
                        message: 'قام شخص بالإشارة إليك في فيديو',
                        type: 'GENERAL',
                        data: { reelId: reel.id }
                    }
                });
            }
        }

        // Update cooldown + release concurrent-upload lock
        await prisma.user.update({
            where: { id: user.id },
            data: { lastReelUpload: new Date(), reelUploadLockedUntil: null },
        });
        reelUploadCommitted = true;

        const totalTime = Date.now() - startTime;
        logger.info(`Reel upload completed successfully in ${totalTime}ms (${(totalTime/1000).toFixed(2)}s). Reel ID: ${reel.id}, User: ${user.id}, Hashtags: ${hashtags.length}, Mentions: ${mentions.length}`);
        
        // Log videoUrl for debugging
        logger.info(`[Upload] Reel created with videoUrl: ${videoResult.url}, reelId: ${reel.id}`);

        res.json({
            status: 'SUCCESS',
            message: 'تم رفع الفيديو بنجاح',
            data: {
                reelId: reel.id,
                videoUrl: videoResult.url,
                thumbnailUrl,
                storagePath: videoResult.key
            }
        });
    } catch (error: any) {
        const totalTime = Date.now() - startTime;
        const errorMessage = error?.message || 'Unknown error';
        const errorStack = error?.stack || 'No stack trace';
        logger.error(`Upload reel exception after ${totalTime}ms (${(totalTime/1000).toFixed(2)}s). Error: ${errorMessage}`, {
            error: errorMessage,
            stack: errorStack,
            videoUploaded,
            thumbnailUploaded,
            videoKey: videoResult && videoResult.success ? videoResult.key : undefined,
            thumbnailPath
        });
        
        // Clean up uploaded files if database operation failed
        if (videoUploaded && videoResult && videoResult.success) {
            try {
                await r2MediaStorage.deleteObject(videoResult.key);
                logger.info(`Cleaned up uploaded video file: ${videoResult.key}`);
            } catch (cleanupError: any) {
                logger.error(`Failed to cleanup video file ${videoResult.key}:`, cleanupError?.message || cleanupError);
            }
        }
        
        if (thumbnailUploaded && thumbnailPath) {
            try {
                await r2MediaStorage.deleteObject(thumbnailPath);
                logger.info(`Cleaned up uploaded thumbnail file: ${thumbnailPath}`);
            } catch (cleanupError: any) {
                logger.error(`Failed to cleanup thumbnail file ${thumbnailPath}:`, cleanupError?.message || cleanupError);
            }
        }

        // Check if response was already sent
        if (!res.headersSent) {
            sendError(res, 500, 'UPLOAD_ERROR', errorMessage || 'Failed to upload reel. Please try again.');
        }
    } finally {
        if (reelSlotHeld && !reelUploadCommitted && heldUserId) {
            try {
                await prisma.user.update({
                    where: { id: heldUserId },
                    data: { reelUploadLockedUntil: null },
                });
            } catch (unlockErr: any) {
                logger.warn('[upload/reel] Failed to clear reelUploadLockedUntil:', unlockErr?.message || unlockErr);
            }
        }
    }
});

export default router;
