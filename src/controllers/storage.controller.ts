import { Request, Response } from 'express';
import { r2MediaStorage } from '../services/r2-media-storage.service';
import { STORAGE_BUCKETS } from '../config/storage.config';
import { logger } from '../utils/logger';

export class StorageController {
    /**
     * Upload Avatar
     */
    static async uploadAvatar(req: Request, res: Response) {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file uploaded' });
                return;
            }

            const userId = req.auth?.userId;

            if (!userId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await r2MediaStorage.uploadPublic(
                'avatars',
                userId,
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );

            res.status(200).json({
                message: 'Avatar uploaded successfully',
                data: result,
            });
        } catch (error: any) {
            logger.error('Avatar upload error:', error);
            res.status(500).json({ message: 'Failed to upload avatar', error: error.message });
        }
    }

    /**
     * Upload Reel
     */
    static async uploadReel(req: Request, res: Response) {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file uploaded' });
                return;
            }

            const userId = req.auth?.userId;

            if (!userId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await r2MediaStorage.uploadPublic(
                'reels',
                userId,
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );

            res.status(200).json({
                message: 'Reel uploaded successfully',
                data: result,
            });
        } catch (error: any) {
            logger.error('Reel upload error:', error);
            res.status(500).json({ message: 'Failed to upload reel', error: error.message });
        }
    }

    /**
     * Upload Thumbnail
     */
    static async uploadThumbnail(req: Request, res: Response) {
        try {
            if (!req.file) {
                res.status(400).json({ message: 'No file uploaded' });
                return;
            }

            const userId = req.auth?.userId;

            if (!userId) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }

            const result = await r2MediaStorage.uploadPublic(
                'thumbnails',
                userId,
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );

            res.status(200).json({
                message: 'Thumbnail uploaded successfully',
                data: result,
            });
        } catch (error: any) {
            logger.error('Thumbnail upload error:', error);
            res.status(500).json({ message: 'Failed to upload thumbnail', error: error.message });
        }
    }

    /**
     * Delete File
     * Authorization is handled by verifyFileOwnership middleware
     */
    static async deleteFile(req: Request, res: Response) {
        try {
            const { bucket, path } = req.params;

            // Validate bucket
            const validBuckets = Object.values(STORAGE_BUCKETS);
            if (!validBuckets.includes(bucket as any)) {
                res.status(400).json({ message: 'Invalid bucket' });
                return;
            }

            // Ensure path is a string
            const filePath = Array.isArray(path) ? path[0] : path;
            const ok = await r2MediaStorage.deleteObject(filePath);
            if (!ok) {
                res.status(500).json({ message: 'Failed to delete file' });
                return;
            }

            res.status(200).json({ message: 'File deleted successfully' });
        } catch (error: any) {
            logger.error('File delete error:', error);
            res.status(500).json({ message: 'Failed to delete file', error: error.message });
        }
    }
}
