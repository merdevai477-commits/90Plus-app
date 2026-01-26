import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { r2Storage } from '../services/r2-storage.service';
import { invalidateUserCache } from './clerk-user.routes';
import multer from 'multer';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max
    },
});

// Constants - Strict Cooldown Rules
const AVATAR_CHANGE_COOLDOWN_DAYS = 7;
const COVER_CHANGE_COOLDOWN_DAYS = 15;
const REEL_UPLOAD_COOLDOWN_DAYS = 3;

/**
 * POST /api/upload/avatar
 * Upload avatar image to R2 Storage
 */
router.post('/avatar', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const file = req.file;
        if (!file) {
            logger.error('No file received in avatar upload request');
            res.status(400).json({ status: 'ERROR', message: 'No file provided' });
            return;
        }

        // Validate file properties
        if (!file.buffer) {
            logger.error('File buffer is missing in avatar upload');
            res.status(400).json({ status: 'ERROR', message: 'File buffer is missing' });
            return;
        }

        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            logger.error(`Invalid file type in avatar upload: ${file.mimetype}`);
            res.status(400).json({ status: 'ERROR', message: 'Invalid file type. Only images are allowed.' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastAvatarChange: true, avatarStoragePath: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
                
                res.status(429).json({
                    status: 'ERROR',
                    code: 'COOLDOWN_ACTIVE',
                    message: `يمكنك تغيير صورة البروفايل بعد ${daysRemaining} يوم`,
                    daysRemaining
                });
                return;
            }
        }


        // Delete old avatar if exists
        if (user.avatarStoragePath) {
            await r2Storage.deleteFile('avatars', user.avatarStoragePath);
        }

        // Validate file buffer is not empty
        if (file.buffer.length === 0) {
            logger.error('Empty file buffer received');
            res.status(400).json({ status: 'ERROR', message: 'File is empty or corrupted' });
            return;
        }

        logger.info(`Uploading avatar: ${file.originalname}, size: ${file.buffer.length} bytes, type: ${file.mimetype}`);

        // Upload new avatar
        const fileName = `${user.id}/${Date.now()}_${file.originalname}`;
        const result = await r2Storage.uploadFile('avatars', file.buffer, fileName, file.mimetype);

        if (!result.success) {
            logger.error('R2 upload error:', result.error);
            res.status(500).json({ status: 'ERROR', message: result.error || 'Failed to upload file' });
            return;
        }

        // Check if URL was generated (R2_PUBLIC_URL must be configured)
        if (!result.url) {
            logger.error('R2 upload succeeded but no public URL returned. Check R2_PUBLIC_URL configuration.');
            res.status(500).json({ 
                status: 'ERROR', 
                message: 'File uploaded but public URL not available. Please check server configuration.' 
            });
            return;
        }

        logger.info(`Avatar uploaded successfully: ${result.url}, path: ${result.path}`);

        // Update user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                avatar: result.url,
                avatarStoragePath: result.path,
                lastAvatarChange: new Date()
            }
        });

        // Invalidate cache so /me returns fresh data
        invalidateUserCache(clerkUserId);

        res.json({
            status: 'SUCCESS',
            message: 'تم رفع صورة البروفايل بنجاح',
            data: { url: result.url, storagePath: result.path }
        });
    } catch (error: any) {
        logger.error('Upload avatar error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * POST /api/upload/cover
 * Upload cover image to R2 Storage
 */
router.post('/cover', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const file = req.file;
        if (!file) {
            res.status(400).json({ status: 'ERROR', message: 'No file provided' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastCoverChange: true, coverStoragePath: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
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
                
                res.status(429).json({
                    status: 'ERROR',
                    code: 'COOLDOWN_ACTIVE',
                    message: `يمكنك تغيير صورة الغلاف بعد ${daysRemaining} يوم`,
                    daysRemaining
                });
                return;
            }
        }

        // Delete old cover if exists
        if (user.coverStoragePath) {
            await r2Storage.deleteFile('covers', user.coverStoragePath);
        }

        // Upload new cover
        const fileName = `${user.id}/${Date.now()}_${file.originalname}`;
        const result = await r2Storage.uploadFile('covers', file.buffer, fileName, file.mimetype);

        if (!result.success) {
            res.status(500).json({ status: 'ERROR', message: 'Failed to upload file' });
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                coverImage: result.url,
                coverStoragePath: result.path,
                lastCoverChange: new Date()
            }
        });

        // Invalidate cache so /me returns fresh data
        invalidateUserCache(clerkUserId);

        res.json({
            status: 'SUCCESS',
            message: 'تم رفع صورة الغلاف بنجاح',
            data: { url: result.url, storagePath: result.path }
        });
    } catch (error: any) {
        logger.error('Upload cover error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});


/**
 * POST /api/upload/reel
 * Upload reel video to R2 Storage
 */
router.post('/reel', requireAuth, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let videoUploaded = false;
    let thumbnailUploaded = false;
    let videoResult: { success: boolean; url?: string; path?: string; error?: string } | null = null;
    let thumbnailPath: string | null = null;
    
    try {
        // Note: Timeout is handled by middleware in main.ts (req.setTimeout)
        // Railway gateway has a 60s timeout, so we must complete within that time
        
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const videoFile = files['video']?.[0];
        const thumbnailFile = files['thumbnail']?.[0];

        if (!videoFile) {
            res.status(400).json({ status: 'ERROR', message: 'No video provided' });
            return;
        }

        // Validate file size early
        if (videoFile.buffer.length > 50 * 1024 * 1024) { // 50MB
            res.status(413).json({ 
                status: 'ERROR', 
                message: 'Video file is too large. Maximum size is 50MB.' 
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: { id: true, lastReelUpload: true }
        });

        if (!user) {
            res.status(404).json({ status: 'ERROR', message: 'User not found' });
            return;
        }

        // Check cooldown
        if (user.lastReelUpload) {
            const daysSince = Math.floor((Date.now() - new Date(user.lastReelUpload).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince < REEL_UPLOAD_COOLDOWN_DAYS) {
                const hoursRemaining = Math.ceil(
                    (REEL_UPLOAD_COOLDOWN_DAYS * 24) - 
                    ((Date.now() - new Date(user.lastReelUpload).getTime()) / (1000 * 60 * 60))
                );
                res.status(429).json({
                    status: 'ERROR',
                    message: `يمكنك رفع فيديو جديد بعد ${hoursRemaining} ساعة`,
                    hoursRemaining
                });
                return;
            }
        }

        // Upload video with timeout protection
        // Railway gateway timeout is 60s, so we need to complete upload + response within that time
        // Reduce upload timeout to 45s to leave buffer for response processing
        const videoFileName = `${user.id}/${Date.now()}_${videoFile.originalname}`;
        const fileSizeMB = (videoFile.buffer.length / (1024 * 1024)).toFixed(2);
        logger.info(`Starting video upload: ${videoFileName}, size: ${fileSizeMB}MB (${videoFile.buffer.length} bytes), type: ${videoFile.mimetype}`);
        
        const uploadStartTime = Date.now();
        const uploadPromise = r2Storage.uploadFile('reels', videoFile.buffer, videoFileName, videoFile.mimetype);
        const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
            setTimeout(() => {
                const elapsed = Date.now() - uploadStartTime;
                logger.error(`R2 upload timeout after ${elapsed}ms for file: ${videoFileName}`);
                resolve({ success: false, error: 'Upload to storage timed out. File may be too large. Maximum size is 50MB.' });
            }, 45 * 1000); // 45 seconds - leaving 15s buffer for response
        });

        videoResult = await Promise.race([uploadPromise, timeoutPromise]) as any;

        if (!videoResult || !videoResult.success) {
            const elapsed = Date.now() - uploadStartTime;
            logger.error(`Video upload failed after ${elapsed}ms. File: ${videoFileName}, Size: ${fileSizeMB}MB, Error: ${videoResult?.error || 'Unknown error'}`);
            res.status(500).json({ 
                status: 'ERROR', 
                message: videoResult?.error || 'Failed to upload video to storage. Please try again or use a smaller file.',
                code: 'UPLOAD_FAILED'
            });
            return;
        }
        
        if (!videoResult.url) {
            const elapsed = Date.now() - uploadStartTime;
            logger.error(`Video uploaded but no public URL returned after ${elapsed}ms. File: ${videoFileName}. Check R2_PUBLIC_URL configuration.`);
            res.status(500).json({ 
                status: 'ERROR', 
                message: 'Video uploaded but public URL not available. Please check server configuration.',
                code: 'NO_PUBLIC_URL'
            });
            return;
        }
        
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
                
                const thumbUploadPromise = r2Storage.uploadFile('thumbnails', thumbnailFile.buffer, thumbFileName, thumbnailFile.mimetype);
                const thumbTimeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
                    setTimeout(() => {
                        const elapsed = Date.now() - thumbStartTime;
                        logger.warn(`Thumbnail upload timeout after ${elapsed}ms: ${thumbFileName}`);
                        resolve({ success: false, error: 'Thumbnail upload timed out' });
                    }, 10 * 1000); // 10 seconds for thumbnail
                });

                const thumbResult = await Promise.race([thumbUploadPromise, thumbTimeoutPromise]);
                if (thumbResult.success) {
                    thumbnailUrl = thumbResult.url || null;
                    thumbnailPath = thumbResult.path || null;
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
        if (!videoResult || !videoResult.url || !videoResult.path) {
            logger.error('Cannot create reel: videoResult is missing required fields');
            res.status(500).json({ 
                status: 'ERROR', 
                message: 'Video upload completed but required data is missing',
                code: 'MISSING_DATA'
            });
            return;
        }

        const reel = await prisma.reel.create({
            data: {
                userId: user.id,
                videoUrl: videoResult.url,
                videoStoragePath: videoResult.path,
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

        // Update user's lastReelUpload
        await prisma.user.update({
            where: { id: user.id },
            data: { lastReelUpload: new Date() }
        });

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
                storagePath: videoResult.path
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
            videoPath: videoResult?.path,
            thumbnailPath
        });
        
        // Clean up uploaded files if database operation failed
        if (videoUploaded && videoResult && videoResult.success && videoResult.path) {
            try {
                await r2Storage.deleteFile('reels', videoResult.path);
                logger.info(`Cleaned up uploaded video file: ${videoResult.path}`);
            } catch (cleanupError: any) {
                logger.error(`Failed to cleanup video file ${videoResult.path}:`, cleanupError?.message || cleanupError);
            }
        }
        
        if (thumbnailUploaded && thumbnailPath) {
            try {
                await r2Storage.deleteFile('thumbnails', thumbnailPath);
                logger.info(`Cleaned up uploaded thumbnail file: ${thumbnailPath}`);
            } catch (cleanupError: any) {
                logger.error(`Failed to cleanup thumbnail file ${thumbnailPath}:`, cleanupError?.message || cleanupError);
            }
        }

        // Check if response was already sent
        if (!res.headersSent) {
            res.status(500).json({ 
                status: 'ERROR', 
                message: errorMessage || 'Failed to upload reel. Please try again.',
                code: 'UPLOAD_ERROR'
            });
        }
    }
});

export default router;
