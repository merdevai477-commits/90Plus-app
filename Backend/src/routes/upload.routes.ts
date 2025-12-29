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
    try {
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

        // Upload video
        const videoFileName = `${user.id}/${Date.now()}_${videoFile.originalname}`;
        logger.info(`Starting video upload: ${videoFileName}, size: ${videoFile.buffer.length} bytes, type: ${videoFile.mimetype}`);
        
        const videoResult = await r2Storage.uploadFile('reels', videoFile.buffer, videoFileName, videoFile.mimetype);

        if (!videoResult.success) {
            logger.error('Video upload error:', videoResult.error);
            res.status(500).json({ 
                status: 'ERROR', 
                message: videoResult.error || 'Failed to upload video to storage' 
            });
            return;
        }
        
        if (!videoResult.url) {
            logger.error('Video uploaded but no public URL returned. Check R2_PUBLIC_URL configuration.');
            res.status(500).json({ 
                status: 'ERROR', 
                message: 'Video uploaded but public URL not available. Please check server configuration.' 
            });
            return;
        }
        
        logger.info(`Video uploaded successfully: ${videoResult.url}, path: ${videoResult.path}`);

        // Upload thumbnail if provided
        let thumbnailUrl = null;
        let thumbnailPath = null;
        if (thumbnailFile) {
            const thumbFileName = `${user.id}/${Date.now()}_thumb_${thumbnailFile.originalname}`;
            const thumbResult = await r2Storage.uploadFile('thumbnails', thumbnailFile.buffer, thumbFileName, thumbnailFile.mimetype);
            if (thumbResult.success) {
                thumbnailUrl = thumbResult.url;
                thumbnailPath = thumbResult.path;
            }
        }

        // Parse metadata
        const { caption, hashtags: hashtagsJson, mentions: mentionsJson } = req.body;
        const hashtags = hashtagsJson ? JSON.parse(hashtagsJson) : [];
        const mentions = mentionsJson ? JSON.parse(mentionsJson) : [];

        // Create reel in database
        const reel = await prisma.reel.create({
            data: {
                userId: user.id,
                videoUrl: videoResult.url!,
                videoStoragePath: videoResult.path!,
                thumbnail: thumbnailUrl,
                thumbnailStoragePath: thumbnailPath,
                caption,
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
        logger.error('Upload reel error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

export default router;
