/**
 * Property-Based Tests for File Validation
 * Using fast-check for property-based testing
 */

import * as fc from 'fast-check';
import {
    validateFileSize,
    validateMimeType,
    detectMimeType,
    VIDEO_SIGNATURES,
    ValidationResult,
} from '../middleware/file-validation.middleware';
import { FILE_SIZE_LIMITS } from '../config/app.config';

// Helper to create a buffer with specific magic bytes
function createBufferWithMagicBytes(magicBytes: number[], size: number): Buffer {
    const buffer = Buffer.alloc(size);
    for (let i = 0; i < magicBytes.length; i++) {
        buffer[i] = magicBytes[i];
    }
    return buffer;
}

// Helper to create valid MP4 magic bytes
function createValidMp4MagicBytes(): number[] {
    // ftyp signature: 00 00 00 XX 66 74 79 70 (XX is size byte)
    return [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70];
}

// Helper to create valid WebM magic bytes
function createValidWebMMagicBytes(): number[] {
    return [0x1A, 0x45, 0xDF, 0xA3];
}

// Helper to create valid QuickTime magic bytes
function createValidQuickTimeMagicBytes(): number[] {
    // moov signature
    return [0x00, 0x00, 0x00, 0x20, 0x6D, 0x6F, 0x6F, 0x76];
}

describe('File Validation Property Tests', () => {
    /**
     * **Feature: video-upload-security, Property 1: Size Limit Enforcement**
     * *For any* file buffer with size greater than 50MB, the validation function
     * SHALL return { valid: false, errorCode: 'FILE_TOO_LARGE' } and no data SHALL be stored.
     * **Validates: Requirements 1.2, 1.4**
     */
    describe('Property 1: Size Limit Enforcement', () => {
        it('should reject any file larger than 50MB', () => {
            fc.assert(
                fc.property(
                    // Generate sizes from 50MB + 1 byte to 100MB
                    fc.integer({ min: FILE_SIZE_LIMITS.REEL + 1, max: FILE_SIZE_LIMITS.REEL * 2 }),
                    (size) => {
                        // Create a buffer of the specified size (we don't need actual content)
                        const buffer = Buffer.alloc(size);
                        const result = validateFileSize(buffer);

                        expect(result.valid).toBe(false);
                        expect(result.errorCode).toBe('FILE_TOO_LARGE');
                    }
                ),
                { numRuns: 100 }
            );
        });


        it('should accept any file 50MB or smaller', () => {
            fc.assert(
                fc.property(
                    // Generate sizes from 1 byte to 50MB
                    fc.integer({ min: 1, max: FILE_SIZE_LIMITS.REEL }),
                    (size) => {
                        const buffer = Buffer.alloc(size);
                        const result = validateFileSize(buffer);

                        expect(result.valid).toBe(true);
                        expect(result.errorCode).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: video-upload-security, Property 2: Valid Video MIME Acceptance**
     * *For any* file buffer that starts with valid video magic bytes (MP4 ftyp, WebM, QuickTime),
     * the MIME validator SHALL return { valid: true } when the declared Content-Type matches.
     * **Validates: Requirements 2.2**
     */
    describe('Property 2: Valid Video MIME Acceptance', () => {
        it('should accept MP4 files with matching Content-Type', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 12, max: 1000 }),
                    (size) => {
                        const magicBytes = createValidMp4MagicBytes();
                        const buffer = createBufferWithMagicBytes(magicBytes, size);
                        const result = validateMimeType(buffer, 'video/mp4');

                        expect(result.valid).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should accept WebM files with matching Content-Type', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 12, max: 1000 }),
                    (size) => {
                        const magicBytes = createValidWebMMagicBytes();
                        const buffer = createBufferWithMagicBytes(magicBytes, size);
                        const result = validateMimeType(buffer, 'video/webm');

                        expect(result.valid).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should accept QuickTime files with matching Content-Type', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 12, max: 1000 }),
                    (size) => {
                        const magicBytes = createValidQuickTimeMagicBytes();
                        const buffer = createBufferWithMagicBytes(magicBytes, size);
                        const result = validateMimeType(buffer, 'video/quicktime');

                        expect(result.valid).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * **Feature: video-upload-security, Property 3: Invalid MIME Rejection**
     * *For any* file buffer that does not start with valid video magic bytes,
     * the MIME validator SHALL return { valid: false, errorCode: 'INVALID_FILE_TYPE' }.
     * **Validates: Requirements 2.3**
     */
    describe('Property 3: Invalid MIME Rejection', () => {
        it('should reject files with invalid magic bytes', () => {
            // Generate random bytes that don't match any video signature
            const invalidMagicBytesArb = fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 12, maxLength: 20 })
                .filter((bytes) => {
                    // Ensure it doesn't accidentally match any valid signature
                    const buffer = Buffer.from(bytes);
                    return detectMimeType(buffer) === null;
                });

            fc.assert(
                fc.property(
                    invalidMagicBytesArb,
                    (bytes) => {
                        const buffer = Buffer.from(bytes);
                        const result = validateMimeType(buffer);

                        expect(result.valid).toBe(false);
                        expect(result.errorCode).toBe('INVALID_FILE_TYPE');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should reject files that are too small to have valid magic bytes', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 11 }),
                    (size) => {
                        const buffer = Buffer.alloc(size);
                        const result = validateMimeType(buffer);

                        expect(result.valid).toBe(false);
                        expect(result.errorCode).toBe('INVALID_FILE_TYPE');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: video-upload-security, Property 4: MIME Mismatch Rejection**
     * *For any* file buffer where the detected MIME type from magic bytes differs
     * from the declared Content-Type, the validator SHALL reject the file.
     * **Validates: Requirements 2.4**
     */
    describe('Property 4: MIME Mismatch Rejection', () => {
        it('should reject MP4 files declared as WebM', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 12, max: 1000 }),
                    (size) => {
                        const magicBytes = createValidMp4MagicBytes();
                        const buffer = createBufferWithMagicBytes(magicBytes, size);
                        // Declare wrong MIME type
                        const result = validateMimeType(buffer, 'video/webm');

                        expect(result.valid).toBe(false);
                        expect(result.errorCode).toBe('INVALID_FILE_TYPE');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should reject WebM files declared as MP4', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 12, max: 1000 }),
                    (size) => {
                        const magicBytes = createValidWebMMagicBytes();
                        const buffer = createBufferWithMagicBytes(magicBytes, size);
                        // Declare wrong MIME type
                        const result = validateMimeType(buffer, 'video/mp4');

                        expect(result.valid).toBe(false);
                        expect(result.errorCode).toBe('INVALID_FILE_TYPE');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
