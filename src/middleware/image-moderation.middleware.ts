/**
 * Image Moderation Middleware
 * Validates and moderates uploaded images
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import sharp from 'sharp';

// Allowed image types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_DIMENSIONS = { width: 4096, height: 4096 };

// Known club/team logos (basic detection)
const KNOWN_LOGOS = [
    'real-madrid', 'barcelona', 'manchester-united', 'liverpool', 'bayern',
    'juventus', 'psg', 'chelsea', 'arsenal', 'manchester-city'
];

interface ImageModerationResult {
    isValid: boolean;
    reason?: string;
    warnings?: string[];
}

/**
 * Validate image file type and size
 */
export async function validateImageFile(
    file: Express.Multer.File
): Promise<ImageModerationResult> {
    const warnings: string[] = [];

    // Check file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        return {
            isValid: false,
            reason: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        };
    }

    // Check file size
    if (file.size > MAX_IMAGE_SIZE) {
        return {
            isValid: false,
            reason: `File size exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        };
    }

    // Check image dimensions
    try {
        const metadata = await sharp(file.buffer).metadata();
        
        if (!metadata.width || !metadata.height) {
            return {
                isValid: false,
                reason: 'Unable to read image dimensions',
            };
        }

        if (metadata.width > MAX_IMAGE_DIMENSIONS.width || metadata.height > MAX_IMAGE_DIMENSIONS.height) {
            warnings.push(`Image dimensions exceed recommended size (${MAX_IMAGE_DIMENSIONS.width}x${MAX_IMAGE_DIMENSIONS.height})`);
        }

        // Check for extremely small images (likely invalid)
        if (metadata.width < 50 || metadata.height < 50) {
            return {
                isValid: false,
                reason: 'Image dimensions too small (minimum 50x50)',
            };
        }

    } catch (error) {
        logger.error('Error reading image metadata:', error);
        return {
            isValid: false,
            reason: 'Invalid or corrupted image file',
        };
    }

    return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}

/**
 * Resize and compress image
 */
export async function optimizeImage(
    buffer: Buffer,
    options: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
        format?: 'jpeg' | 'png' | 'webp';
    } = {}
): Promise<Buffer> {
    const {
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 85,
        format = 'jpeg',
    } = options;

    try {
        let pipeline = sharp(buffer);

        // Resize if needed
        const metadata = await pipeline.metadata();
        if (metadata.width && metadata.height) {
            if (metadata.width > maxWidth || metadata.height > maxHeight) {
                pipeline = pipeline.resize(maxWidth, maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true,
                });
            }
        }

        // Convert and compress
        if (format === 'jpeg') {
            pipeline = pipeline.jpeg({ quality, progressive: true });
        } else if (format === 'png') {
            pipeline = pipeline.png({ quality, compressionLevel: 9 });
        } else if (format === 'webp') {
            pipeline = pipeline.webp({ quality });
        }

        return await pipeline.toBuffer();
    } catch (error) {
        logger.error('Error optimizing image:', error);
        throw new Error('Failed to optimize image');
    }
}

/**
 * Basic logo/trademark detection (filename-based)
 * Note: This is a basic implementation. For production, consider using image recognition APIs
 */
export function detectLogoInFilename(filename: string): boolean {
    const lowerFilename = filename.toLowerCase();
    
    for (const logo of KNOWN_LOGOS) {
        if (lowerFilename.includes(logo)) {
            return true;
        }
    }

    return false;
}

/**
 * Middleware: Validate uploaded image
 */
export const validateUploadedImage = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const file = req.file;

        if (!file) {
            res.status(400).json({
                status: 'ERROR',
                message: 'No file uploaded',
            });
            return;
        }

        // Validate image
        const validation = await validateImageFile(file);

        if (!validation.isValid) {
            res.status(400).json({
                status: 'ERROR',
                message: validation.reason,
            });
            return;
        }

        // Log warnings if any
        if (validation.warnings) {
            logger.warn('[IMAGE_MODERATION] Warnings:', {
                filename: file.originalname,
                warnings: validation.warnings,
            });
        }

        // Check for logo in filename
        if (detectLogoInFilename(file.originalname)) {
            logger.warn('[IMAGE_MODERATION] Possible logo detected:', {
                filename: file.originalname,
            });
            // Don't block, just log for manual review
        }

        next();
    } catch (error: any) {
        logger.error('[IMAGE_MODERATION] Error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Failed to validate image',
        });
    }
};

/**
 * Middleware: Optimize uploaded image
 */
export const optimizeUploadedImage = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const file = req.file;

        if (!file || !file.buffer) {
            next();
            return;
        }

        // Optimize image
        const optimized = await optimizeImage(file.buffer, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 85,
            format: 'jpeg',
        });

        // Replace buffer with optimized version
        file.buffer = optimized;
        file.size = optimized.length;

        logger.info('[IMAGE_MODERATION] Image optimized:', {
            originalSize: file.size,
            optimizedSize: optimized.length,
            reduction: `${((1 - optimized.length / file.size) * 100).toFixed(1)}%`,
        });

        next();
    } catch (error: any) {
        logger.error('[IMAGE_MODERATION] Optimization error:', error);
        // Don't fail the request, just continue with original image
        next();
    }
};

export const ImageModerationService = {
    validateImageFile,
    optimizeImage,
    detectLogoInFilename,
};
