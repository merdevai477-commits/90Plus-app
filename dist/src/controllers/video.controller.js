"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoController = exports.MAX_REEL_DELETES = void 0;
exports.checkDeleteLimit = checkDeleteLimit;
exports.shouldResetUploadCooldown = shouldResetUploadCooldown;
const r2_media_storage_service_1 = require("../services/r2-media-storage.service");
const prisma_1 = __importDefault(require("../lib/prisma"));
const file_validation_middleware_1 = require("../middleware/file-validation.middleware");
const logger_1 = require("../utils/logger");
const REEL_UPLOAD_COOLDOWN_DAYS = 3;
exports.MAX_REEL_DELETES = 2;
function checkDeleteLimit(deleteCount) {
    const canDelete = deleteCount < exports.MAX_REEL_DELETES;
    const remainingDeletes = Math.max(0, exports.MAX_REEL_DELETES - deleteCount);
    return {
        canDelete,
        remainingDeletes,
        deletesUsed: deleteCount,
        maxDeletes: exports.MAX_REEL_DELETES
    };
}
function shouldResetUploadCooldown(wasDeleted) {
    return wasDeleted;
}
class VideoController {
    static async getMyVideos(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: { id: true },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const [videos, total] = await Promise.all([
                prisma_1.default.reel.findMany({
                    where: { userId: user.id },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    include: {
                        _count: {
                            select: {
                                likes: true,
                                comments: true,
                            },
                        },
                    },
                }),
                prisma_1.default.reel.count({ where: { userId: user.id } }),
            ]);
            res.json({
                status: 'SUCCESS',
                data: {
                    videos: videos.map((v) => ({
                        id: v.id,
                        videoUrl: v.videoUrl,
                        thumbnail: v.thumbnail,
                        caption: v.caption,
                        views: v.views,
                        likes: v._count.likes,
                        comments: v._count.comments,
                        createdAt: v.createdAt,
                    })),
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Get videos error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to get videos' });
        }
    }
    static async getVideosByUsername(req, res) {
        try {
            const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
            const user = await prisma_1.default.user.findUnique({
                where: { username },
                select: { id: true },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const [videos, total] = await Promise.all([
                prisma_1.default.reel.findMany({
                    where: { userId: user.id },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    include: {
                        _count: {
                            select: {
                                likes: true,
                                comments: true,
                            },
                        },
                    },
                }),
                prisma_1.default.reel.count({ where: { userId: user.id } }),
            ]);
            res.json({
                status: 'SUCCESS',
                data: {
                    videos: videos.map((v) => ({
                        id: v.id,
                        videoUrl: v.videoUrl,
                        thumbnail: v.thumbnail,
                        caption: v.caption,
                        views: v.views,
                        likes: v._count.likes,
                        comments: v._count.comments,
                        createdAt: v.createdAt,
                    })),
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Get videos by username error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to get videos' });
        }
    }
    static async uploadVideo(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: { id: true, lastReelUpload: true },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            if (user.lastReelUpload) {
                const msSinceLastUpload = Date.now() - new Date(user.lastReelUpload).getTime();
                const cooldownMs = REEL_UPLOAD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
                if (msSinceLastUpload < cooldownMs) {
                    const remainingMs = cooldownMs - msSinceLastUpload;
                    const hoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000));
                    const daysRemaining = Math.floor(hoursRemaining / 24);
                    const hoursInDay = hoursRemaining % 24;
                    res.status(429).json({
                        status: 'ERROR',
                        code: 'UPLOAD_COOLDOWN_ACTIVE',
                        message: `يمكنك رفع فيديو جديد بعد ${hoursRemaining} ساعة`,
                        hoursRemaining,
                        daysRemaining,
                        hoursInDay,
                    });
                    return;
                }
            }
            const files = req.files;
            const videoFile = files?.['video']?.[0];
            const thumbnailFile = files?.['thumbnail']?.[0];
            if (!videoFile) {
                res.status(400).json({ status: 'ERROR', message: 'No video file uploaded' });
                return;
            }
            const sizeValidation = (0, file_validation_middleware_1.validateFileSize)(videoFile.buffer);
            if (!sizeValidation.valid) {
                res.status(413).json({
                    status: 'ERROR',
                    code: sizeValidation.errorCode,
                    message: sizeValidation.error,
                });
                return;
            }
            const mimeValidation = (0, file_validation_middleware_1.validateMimeType)(videoFile.buffer, videoFile.mimetype);
            if (!mimeValidation.valid) {
                res.status(415).json({
                    status: 'ERROR',
                    code: mimeValidation.errorCode,
                    message: mimeValidation.error,
                });
                return;
            }
            const { caption } = req.body;
            const timestamp = Date.now();
            const videoResult = await r2_media_storage_service_1.r2MediaStorage.uploadFile('videos', videoFile.buffer, `${user.id}/${timestamp}.${videoFile.mimetype.split('/')[1]}`, videoFile.mimetype);
            if (!videoResult.success) {
                res.status(500).json({ status: 'ERROR', message: videoResult.error });
                return;
            }
            let thumbnailUrl = null;
            let thumbnailPath = null;
            if (thumbnailFile) {
                const thumbResult = await r2_media_storage_service_1.r2MediaStorage.uploadFile('thumbnails', thumbnailFile.buffer, `${user.id}/${timestamp}_thumb.${thumbnailFile.mimetype.split('/')[1]}`, thumbnailFile.mimetype);
                if (thumbResult.success) {
                    thumbnailUrl = thumbResult.url;
                    thumbnailPath = thumbResult.path;
                }
            }
            const reel = await prisma_1.default.reel.create({
                data: {
                    userId: user.id,
                    videoUrl: videoResult.url,
                    videoStoragePath: videoResult.path,
                    thumbnail: thumbnailUrl,
                    thumbnailStoragePath: thumbnailPath,
                    caption,
                },
            });
            await prisma_1.default.$transaction([
                prisma_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        coins: { increment: 5 },
                        lastReelUpload: new Date(),
                    },
                }),
                prisma_1.default.coinTransaction.create({
                    data: {
                        userId: user.id,
                        amount: 5,
                        type: 'REEL_REWARD',
                        description: 'Uploaded a new reel',
                    },
                }),
            ]);
            res.status(201).json({
                status: 'SUCCESS',
                data: {
                    id: reel.id,
                    videoUrl: reel.videoUrl,
                    thumbnail: reel.thumbnail,
                    caption: reel.caption,
                    createdAt: reel.createdAt,
                },
                message: 'Video uploaded successfully! +5 coins',
            });
        }
        catch (error) {
            logger_1.logger.error('Upload video error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to upload video' });
        }
    }
    static async deleteVideo(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: { id: true, reelDeleteCount: true },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            if (user.reelDeleteCount >= exports.MAX_REEL_DELETES) {
                res.status(429).json({
                    status: 'ERROR',
                    message: 'لقد وصلت للحد الأقصى من مسح الفيديوهات (2 مرات)',
                    code: 'MAX_DELETES_REACHED',
                    deletesUsed: user.reelDeleteCount,
                    maxDeletes: exports.MAX_REEL_DELETES
                });
                return;
            }
            const reel = await prisma_1.default.reel.findUnique({
                where: { id },
                select: {
                    userId: true,
                    videoStoragePath: true,
                    thumbnailStoragePath: true,
                },
            });
            if (!reel) {
                res.status(404).json({ status: 'ERROR', message: 'Video not found' });
                return;
            }
            if (reel.userId !== user.id) {
                res.status(403).json({ status: 'ERROR', message: 'Not authorized to delete this video' });
                return;
            }
            let videoDeleted = false;
            let thumbnailDeleted = false;
            if (reel.videoStoragePath) {
                logger_1.logger.info(`Attempting to delete video: ${reel.videoStoragePath}`);
                videoDeleted = await r2_media_storage_service_1.r2MediaStorage.deleteFile(reel.videoStoragePath);
                if (!videoDeleted && !reel.videoStoragePath.startsWith('reels/')) {
                    logger_1.logger.info(`Trying with reels/ prefix`);
                    videoDeleted = await r2_media_storage_service_1.r2MediaStorage.deleteFile(`reels/${reel.videoStoragePath}`);
                }
                if (!videoDeleted) {
                    logger_1.logger.warn(`Failed to delete video file after trying both folders: ${reel.videoStoragePath}`);
                }
                else {
                    logger_1.logger.info(`Successfully deleted video file: ${reel.videoStoragePath}`);
                }
            }
            if (reel.thumbnailStoragePath) {
                logger_1.logger.info(`Attempting to delete thumbnail: ${reel.thumbnailStoragePath}`);
                thumbnailDeleted = await r2_media_storage_service_1.r2MediaStorage.deleteFile(reel.thumbnailStoragePath);
                if (!thumbnailDeleted) {
                    logger_1.logger.warn(`Failed to delete thumbnail file: ${reel.thumbnailStoragePath}`);
                }
                else {
                    logger_1.logger.info(`Successfully deleted thumbnail file: ${reel.thumbnailStoragePath}`);
                }
            }
            logger_1.logger.info(`Video deletion: ${videoDeleted ? 'success' : 'failed'}, Thumbnail deletion: ${thumbnailDeleted ? 'success' : 'failed'}`);
            await prisma_1.default.$transaction([
                prisma_1.default.reel.delete({ where: { id } }),
                prisma_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        reelDeleteCount: { increment: 1 },
                        lastReelUpload: null
                    }
                })
            ]);
            const remainingDeletes = exports.MAX_REEL_DELETES - (user.reelDeleteCount + 1);
            res.json({
                status: 'SUCCESS',
                message: 'Video deleted successfully',
                data: {
                    deletesUsed: user.reelDeleteCount + 1,
                    remainingDeletes,
                    maxDeletes: exports.MAX_REEL_DELETES,
                    uploadCooldownReset: true
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Delete video error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to delete video' });
        }
    }
    static async recordView(req, res) {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await prisma_1.default.reel.update({
                where: { id },
                data: { views: { increment: 1 } },
            });
            res.json({ status: 'SUCCESS' });
        }
        catch (error) {
            logger_1.logger.error('Record view error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to record view' });
        }
    }
    static async getDeleteStatus(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: {
                    id: true,
                    reelDeleteCount: true,
                    lastReelUpload: true
                },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            const deleteStatus = checkDeleteLimit(user.reelDeleteCount);
            let uploadCooldownActive = false;
            let uploadHoursRemaining = 0;
            if (user.lastReelUpload) {
                const msSinceLastUpload = Date.now() - new Date(user.lastReelUpload).getTime();
                const cooldownMs = REEL_UPLOAD_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
                if (msSinceLastUpload < cooldownMs) {
                    uploadCooldownActive = true;
                    const remainingMs = cooldownMs - msSinceLastUpload;
                    uploadHoursRemaining = Math.ceil(remainingMs / (60 * 60 * 1000));
                }
            }
            res.json({
                status: 'SUCCESS',
                data: {
                    ...deleteStatus,
                    uploadCooldownActive,
                    uploadHoursRemaining,
                    canUpload: !uploadCooldownActive
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get delete status error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to get delete status' });
        }
    }
}
exports.VideoController = VideoController;
//# sourceMappingURL=video.controller.js.map