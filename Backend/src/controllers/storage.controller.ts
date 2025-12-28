import { Request, Response } from 'express';
import { StorageService } from '../utils/storage.service';
import { STORAGE_BUCKETS } from '../config/supabase.config';
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

            // Assuming user ID is attached to request by auth middleware
            // If not, we might need to get it from body or param, but usually it's req.user.id
            const userId = (req as any).user?.id || req.body.userId;

            if (!userId) {
                res.status(401).json({ message: 'User ID not found' });
                return;
            }

            const result = await StorageService.uploadAvatar(userId, req.file);

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

            const userId = (req as any).user?.id || req.body.userId;

            if (!userId) {
                res.status(401).json({ message: 'User ID not found' });
                return;
            }

            const result = await StorageService.uploadReel(userId, req.file);

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

            const userId = (req as any).user?.id || req.body.userId;

            if (!userId) {
                res.status(401).json({ message: 'User ID not found' });
                return;
            }

            const result = await StorageService.uploadThumbnail(userId, req.file);

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

            // Ownership verification is done by middleware before reaching here

            await StorageService.deleteFile(path, bucket as 'image' | 'video');

            res.status(200).json({ message: 'File deleted successfully' });
        } catch (error: any) {
            logger.error('File delete error:', error);
            res.status(500).json({ message: 'Failed to delete file', error: error.message });
        }
    }
}
