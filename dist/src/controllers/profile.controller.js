"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const r2_media_storage_service_1 = require("../services/r2-media-storage.service");
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
class ProfileController {
    static async getMyProfile(req, res) {
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
                    email: true,
                    username: true,
                    displayName: true,
                    avatar: true,
                    bio: true,
                    coins: true,
                    level: true,
                    xp: true,
                    isVerified: true,
                    isDeveloper: true,
                    favoriteTeam: true,
                    settings: true,
                    createdAt: true,
                    lastUsernameChange: true,
                    position: true,
                    countryFlag: true,
                    age: true,
                    height: true,
                    weight: true,
                    preferredFoot: true,
                    clubLogo: true,
                    brandLogo: true,
                    coverImage: true,
                    socialLinks: true,
                    consecutiveLoginDays: true,
                    _count: {
                        select: {
                            followers: true,
                            following: true,
                            reels: true,
                        },
                    },
                },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            res.json({
                status: 'SUCCESS',
                data: {
                    ...user,
                    followersCount: user._count.followers,
                    followingCount: user._count.following,
                    videosCount: user._count.reels,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Get profile error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to get profile' });
        }
    }
    static async updateMyProfile(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            const { displayName, bio, favoriteTeam, socials, location } = req.body;
            const currentUser = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: { settings: true },
            });
            const currentSettings = currentUser?.settings || {};
            const updatedUser = await prisma_1.default.user.update({
                where: { clerkUserId },
                data: {
                    displayName,
                    bio,
                    favoriteTeam,
                    settings: {
                        ...currentSettings,
                        socials,
                        location,
                    },
                },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    bio: true,
                    favoriteTeam: true,
                    settings: true,
                },
            });
            res.json({
                status: 'SUCCESS',
                data: updatedUser,
                message: 'Profile updated successfully',
            });
        }
        catch (error) {
            logger_1.logger.error('Update profile error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to update profile' });
        }
    }
    static async uploadAvatar(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            if (!req.file) {
                res.status(400).json({ status: 'ERROR', message: 'No file uploaded' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: { id: true, avatarStoragePath: true },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            if (user.avatarStoragePath) {
                await r2_media_storage_service_1.r2MediaStorage.deleteFile(user.avatarStoragePath);
            }
            const result = await r2_media_storage_service_1.r2MediaStorage.uploadFile('avatars', req.file.buffer, `${user.id}/${Date.now()}.${req.file.mimetype.split('/')[1]}`, req.file.mimetype);
            if (!result.success) {
                res.status(500).json({ status: 'ERROR', message: result.error });
                return;
            }
            await prisma_1.default.user.update({
                where: { clerkUserId },
                data: {
                    avatar: result.url,
                    avatarStoragePath: result.path,
                },
            });
            res.json({
                status: 'SUCCESS',
                data: { avatarUrl: result.url },
                message: 'Avatar uploaded successfully',
            });
        }
        catch (error) {
            logger_1.logger.error('Upload avatar error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to upload avatar' });
        }
    }
    static async uploadCover(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            if (!req.file) {
                res.status(400).json({ status: 'ERROR', message: 'No file uploaded' });
                return;
            }
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: { id: true, settings: true },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            const currentSettings = user.settings || {};
            if (currentSettings.coverStoragePath) {
                await r2_media_storage_service_1.r2MediaStorage.deleteFile(currentSettings.coverStoragePath);
            }
            const result = await r2_media_storage_service_1.r2MediaStorage.uploadFile('covers', req.file.buffer, `${user.id}/${Date.now()}.${req.file.mimetype.split('/')[1]}`, req.file.mimetype);
            if (!result.success) {
                res.status(500).json({ status: 'ERROR', message: result.error });
                return;
            }
            await prisma_1.default.user.update({
                where: { clerkUserId },
                data: {
                    settings: {
                        ...currentSettings,
                        coverUrl: result.url,
                        coverStoragePath: result.path,
                    },
                },
            });
            res.json({
                status: 'SUCCESS',
                data: { coverUrl: result.url },
                message: 'Cover uploaded successfully',
            });
        }
        catch (error) {
            logger_1.logger.error('Upload cover error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to upload cover' });
        }
    }
    static async updateStats(req, res) {
        try {
            const clerkUserId = req.auth?.userId;
            if (!clerkUserId) {
                res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
                return;
            }
            const { age, height, weight, foot, position, country } = req.body;
            const user = await prisma_1.default.user.findUnique({
                where: { clerkUserId },
                select: { settings: true },
            });
            const currentSettings = user?.settings || {};
            await prisma_1.default.user.update({
                where: { clerkUserId },
                data: {
                    settings: {
                        ...currentSettings,
                        playerStats: { age, height, weight, foot, position, country },
                    },
                },
            });
            res.json({
                status: 'SUCCESS',
                data: { age, height, weight, foot, position, country },
                message: 'Stats updated successfully',
            });
        }
        catch (error) {
            logger_1.logger.error('Update stats error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to update stats' });
        }
    }
    static async getProfileByUsername(req, res) {
        try {
            const username = req.params.username;
            const clerkUserId = req.auth?.userId;
            const user = await prisma_1.default.user.findUnique({
                where: { username },
                include: {
                    _count: {
                        select: {
                            followers: true,
                            following: true,
                            reels: true,
                        },
                    },
                },
            });
            if (!user) {
                res.status(404).json({ status: 'ERROR', message: 'User not found' });
                return;
            }
            let isFollowing = false;
            if (clerkUserId) {
                const currentUser = await prisma_1.default.user.findUnique({
                    where: { clerkUserId },
                    select: { id: true },
                });
                if (currentUser) {
                    const follow = await prisma_1.default.follow.findUnique({
                        where: {
                            followerId_followingId: {
                                followerId: currentUser.id,
                                followingId: user.id,
                            },
                        },
                    });
                    isFollowing = !!follow;
                }
            }
            const { email, clerkUserId: _, avatarStoragePath, ...publicData } = user;
            res.json({
                status: 'SUCCESS',
                data: {
                    ...publicData,
                    followersCount: user._count.followers,
                    followingCount: user._count.following,
                    videosCount: user._count.reels,
                    isFollowing,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Get profile by username error:', error);
            res.status(500).json({ status: 'ERROR', message: 'Failed to get profile' });
        }
    }
}
exports.ProfileController = ProfileController;
//# sourceMappingURL=profile.controller.js.map