import { Request, Response, NextFunction } from 'express';
import { ALLOWED_FILE_TYPES } from '../config/supabase.config';

/**
 * Validate Avatar Upload
 */
export const validateAvatarUpload = (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }

    if (!ALLOWED_FILE_TYPES.IMAGES.includes(req.file.mimetype as any)) {
        res.status(400).json({
            message: 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF'
        });
        return;
    }

    next();
};

/**
 * Validate Reel Upload
 */
export const validateReelUpload = (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }

    if (!ALLOWED_FILE_TYPES.VIDEOS.includes(req.file.mimetype as any)) {
        res.status(400).json({
            message: 'Invalid file type. Allowed types: MP4, QuickTime, WebM'
        });
        return;
    }

    next();
};

/**
 * Validate Thumbnail Upload
 */
export const validateThumbnailUpload = (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }

    if (!ALLOWED_FILE_TYPES.IMAGES.includes(req.file.mimetype as any)) {
        res.status(400).json({
            message: 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF'
        });
        return;
    }

    next();
};
