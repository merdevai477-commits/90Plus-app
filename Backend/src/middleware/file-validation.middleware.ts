/**
 * File Validation Middleware
 * Validates file size, MIME type using magic bytes detection, and video duration
 */

import { Request, Response, NextFunction } from 'express';
import { FILE_SIZE_LIMITS } from '../config/app.config';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ValidationResult {
    valid: boolean;
    error?: string;
    errorCode?: 'FILE_TOO_LARGE' | 'INVALID_FILE_TYPE';
}

export interface MimeSignature {
    bytes: (number | null)[];
    mimeType: string;
}

// Magic bytes signatures for video files
export const VIDEO_SIGNATURES: MimeSignature[] = [
    // MP4 (ftyp) - bytes 4-7 are 'ftyp'
    { bytes: [0x00, 0x00, 0x00, null, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4' },
    // WebM
    { bytes: [0x1A, 0x45, 0xDF, 0xA3], mimeType: 'video/webm' },
    // QuickTime (moov)
    { bytes: [0x00, 0x00, 0x00, null, 0x6D, 0x6F, 0x6F, 0x76], mimeType: 'video/quicktime' },
    // QuickTime (free)
    { bytes: [0x00, 0x00, 0x00, null, 0x66, 0x72, 0x65, 0x65], mimeType: 'video/quicktime' },
    // QuickTime (mdat)
    { bytes: [0x00, 0x00, 0x00, null, 0x6D, 0x64, 0x61, 0x74], mimeType: 'video/quicktime' },
    // QuickTime (wide)
    { bytes: [0x00, 0x00, 0x00, null, 0x77, 0x69, 0x64, 0x65], mimeType: 'video/quicktime' },
];

/**
 * Validates file size against the hard limit
 * @param buffer - File buffer to validate
 * @param maxSize - Maximum allowed size in bytes (default: 50MB for reels)
 * @returns ValidationResult
 */
export function validateFileSize(
    buffer: Buffer,
    maxSize: number = FILE_SIZE_LIMITS.REEL
): ValidationResult {
    if (buffer.length > maxSize) {
        return {
            valid: false,
            error: 'الملف كبير جداً. الحد الأقصى 50 ميجابايت',
            errorCode: 'FILE_TOO_LARGE',
        };
    }
    return { valid: true };
}


/**
 * Detects MIME type from magic bytes
 * @param buffer - File buffer to check
 * @returns Detected MIME type or null if not recognized
 */
export function detectMimeType(buffer: Buffer): string | null {
    if (buffer.length < 12) {
        return null;
    }

    for (const signature of VIDEO_SIGNATURES) {
        let matches = true;
        for (let i = 0; i < signature.bytes.length; i++) {
            const expectedByte = signature.bytes[i];
            // null means any byte is acceptable (wildcard)
            if (expectedByte !== null && buffer[i] !== expectedByte) {
                matches = false;
                break;
            }
        }
        if (matches) {
            return signature.mimeType;
        }
    }

    return null;
}

/**
 * Validates MIME type using magic bytes detection
 * @param buffer - File buffer to validate
 * @param declaredMimeType - The Content-Type declared by the client
 * @returns ValidationResult
 */
export function validateMimeType(
    buffer: Buffer,
    declaredMimeType?: string
): ValidationResult {
    const detectedMimeType = detectMimeType(buffer);

    // Check if magic bytes match any allowed video signature
    if (!detectedMimeType) {
        return {
            valid: false,
            error: 'نوع الملف غير مسموح. يُسمح فقط بملفات الفيديو (MP4, WebM, MOV)',
            errorCode: 'INVALID_FILE_TYPE',
        };
    }

    // If declared MIME type is provided, check for mismatch
    if (declaredMimeType) {
        const normalizedDeclared = normalizeMimeType(declaredMimeType);
        const normalizedDetected = normalizeMimeType(detectedMimeType);

        if (normalizedDeclared !== normalizedDetected) {
            return {
                valid: false,
                error: 'نوع الملف غير مسموح. يُسمح فقط بملفات الفيديو (MP4, WebM, MOV)',
                errorCode: 'INVALID_FILE_TYPE',
            };
        }
    }

    return { valid: true };
}

/**
 * Normalizes MIME type for comparison
 * video/quicktime and video/mp4 are treated as compatible
 */
function normalizeMimeType(mimeType: string): string {
    const normalized = mimeType.toLowerCase().trim();
    // QuickTime (.mov) files are often served as video/mp4 or video/quicktime
    if (normalized === 'video/quicktime' || normalized === 'video/mp4') {
        return 'video/mp4-compatible';
    }
    return normalized;
}

/**
 * Combined validation for file upload
 * @param buffer - File buffer to validate
 * @param declaredMimeType - The Content-Type declared by the client
 * @param maxSize - Maximum allowed size in bytes
 * @returns ValidationResult
 */
export function validateVideoFile(
    buffer: Buffer,
    declaredMimeType?: string,
    maxSize: number = FILE_SIZE_LIMITS.REEL
): ValidationResult {
    // First check size
    const sizeResult = validateFileSize(buffer, maxSize);
    if (!sizeResult.valid) {
        return sizeResult;
    }

    // Then check MIME type
    return validateMimeType(buffer, declaredMimeType);
}

/**
 * Validates video duration from uploaded file buffer
 * Rejects videos less than 5 seconds or more than 60 seconds
 * @param req - Express request object with file
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateVideoDuration = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get video file from multer - handle both single file and fields
        let videoFile = req.file;
        
        // If using upload.fields(), get the video from req.files
        if (!videoFile && req.files) {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            videoFile = files['video']?.[0];
        }
        
        if (!videoFile) {
            res.status(400).json({
                error: 'E007',
                message: 'No video file provided',
                timestamp: new Date().toISOString(),
                path: req.path
            });
            return;
        }

        // Create temporary file to extract duration
        // get-video-duration requires a file path, not a buffer
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `temp_video_${Date.now()}_${videoFile.originalname}`);
        
        try {
            // Write buffer to temporary file
            fs.writeFileSync(tempFilePath, videoFile.buffer);
            
            // Extract video duration
            const duration = await getVideoDurationInSeconds(tempFilePath);
            
            // Clean up temporary file
            fs.unlinkSync(tempFilePath);
            
            // Validate duration
            if (duration < 5) {
                logger.warn(`Video duration too short: ${duration}s (min: 5s)`, {
                    userId: req.auth?.userId,
                    fileName: videoFile.originalname,
                    duration
                });
                
                res.status(400).json({
                    error: 'E007',
                    message: 'Video duration must be at least 5 seconds',
                    details: { 
                        duration: Math.round(duration * 10) / 10, 
                        minDuration: 5 
                    },
                    timestamp: new Date().toISOString(),
                    path: req.path
                });
                return;
            }
            
            if (duration > 60) {
                logger.warn(`Video duration too long: ${duration}s (max: 60s)`, {
                    userId: req.auth?.userId,
                    fileName: videoFile.originalname,
                    duration
                });
                
                res.status(400).json({
                    error: 'E007',
                    message: 'Video duration must not exceed 60 seconds',
                    details: { 
                        duration: Math.round(duration * 10) / 10, 
                        maxDuration: 60 
                    },
                    timestamp: new Date().toISOString(),
                    path: req.path
                });
                return;
            }
            
            // Add duration to request for use in controller
            (req as any).videoDuration = duration;
            
            logger.info(`Video duration validated: ${duration}s`, {
                userId: req.auth?.userId,
                fileName: videoFile.originalname,
                duration
            });
            
            next();
        } catch (fileError: any) {
            // Clean up temporary file if it exists
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            throw fileError;
        }
    } catch (error: any) {
        logger.error('Error validating video duration:', {
            error: error.message,
            stack: error.stack,
            userId: req.auth?.userId,
            fileName: req.file?.originalname
        });
        
        res.status(500).json({
            error: 'E010',
            message: 'Failed to validate video duration',
            timestamp: new Date().toISOString(),
            path: req.path
        });
    }
};
