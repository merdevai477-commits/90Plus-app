/**
 * File Validation Middleware
 * Validates file size and MIME type using magic bytes detection
 */

import { FILE_SIZE_LIMITS } from '../config/supabase.config';

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
