/**
 * Property-Based Tests for File Ownership Verification
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 2: File Deletion Authorization**
 * **Feature: security-technical-fixes, Property 3: File Path Owner Extraction**
 * **Validates: Requirements 3.1, 3.2, 3.4**
 */

import * as fc from 'fast-check';
import {
    extractOwnerFromPath,
    verifyOwnership,
} from '../middleware/ownership.middleware';

// Arbitrary for generating valid user IDs (alphanumeric strings)
const userIdArbitrary = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);

// Arbitrary for generating valid filenames
const filenameArbitrary = fc.stringMatching(/^[a-zA-Z0-9_.-]{1,100}$/);

// Arbitrary for generating valid file paths in format {userId}/{filename}
const validFilePathArbitrary = fc.tuple(userIdArbitrary, filenameArbitrary)
    .map(([userId, filename]) => `${userId}/${filename}`);

// Arbitrary for generating valid file paths with subfolders
const validFilePathWithSubfolderArbitrary = fc.tuple(
    userIdArbitrary,
    fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
    filenameArbitrary
).map(([userId, subfolder, filename]) => `${userId}/${subfolder}/${filename}`);

describe('File Ownership Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 3: File Path Owner Extraction**
     * *For any* valid file path in the format `{userId}/{filename}`, the system 
     * SHALL correctly extract and return the owner ID.
     * **Validates: Requirements 3.4**
     */
    describe('Property 3: File Path Owner Extraction', () => {
        it('should correctly extract owner ID from any valid file path', () => {
            fc.assert(
                fc.property(
                    userIdArbitrary,
                    filenameArbitrary,
                    (userId, filename) => {
                        const filePath = `${userId}/${filename}`;
                        const extractedOwner = extractOwnerFromPath(filePath);
                        
                        expect(extractedOwner).toBe(userId);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should correctly extract owner ID from paths with subfolders', () => {
            fc.assert(
                fc.property(
                    validFilePathWithSubfolderArbitrary,
                    userIdArbitrary,
                    (filePath, expectedUserId) => {
                        // Create path with known userId
                        const pathWithKnownUser = `${expectedUserId}/subfolder/file.txt`;
                        const extractedOwner = extractOwnerFromPath(pathWithKnownUser);
                        
                        expect(extractedOwner).toBe(expectedUserId);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle paths with leading slashes', () => {
            fc.assert(
                fc.property(
                    userIdArbitrary,
                    filenameArbitrary,
                    (userId, filename) => {
                        const filePath = `/${userId}/${filename}`;
                        const extractedOwner = extractOwnerFromPath(filePath);
                        
                        expect(extractedOwner).toBe(userId);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle paths with trailing slashes', () => {
            fc.assert(
                fc.property(
                    userIdArbitrary,
                    filenameArbitrary,
                    (userId, filename) => {
                        const filePath = `${userId}/${filename}/`;
                        const extractedOwner = extractOwnerFromPath(filePath);
                        
                        expect(extractedOwner).toBe(userId);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return null for empty or invalid paths', () => {
            const invalidPaths = ['', '   ', null, undefined];
            
            for (const path of invalidPaths) {
                const result = extractOwnerFromPath(path as any);
                expect(result).toBeNull();
            }
        });
    });

    /**
     * **Feature: security-technical-fixes, Property 2: File Deletion Authorization**
     * *For any* file deletion request where the requesting user ID does not match 
     * the file owner ID, the system SHALL return a 403 Forbidden response.
     * **Validates: Requirements 3.1, 3.2**
     */
    describe('Property 2: File Deletion Authorization', () => {
        it('should authorize when requesting user matches file owner', () => {
            fc.assert(
                fc.property(
                    userIdArbitrary,
                    filenameArbitrary,
                    (userId, filename) => {
                        const filePath = `${userId}/${filename}`;
                        const isAuthorized = verifyOwnership(userId, filePath);
                        
                        expect(isAuthorized).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should deny authorization when requesting user does not match file owner', () => {
            fc.assert(
                fc.property(
                    userIdArbitrary,
                    userIdArbitrary,
                    filenameArbitrary,
                    (requestingUserId, fileOwnerId, filename) => {
                        // Skip if users happen to be the same
                        fc.pre(requestingUserId !== fileOwnerId);
                        
                        const filePath = `${fileOwnerId}/${filename}`;
                        const isAuthorized = verifyOwnership(requestingUserId, filePath);
                        
                        expect(isAuthorized).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should deny authorization for null or empty requesting user ID', () => {
            fc.assert(
                fc.property(
                    validFilePathArbitrary,
                    (filePath) => {
                        expect(verifyOwnership('', filePath)).toBe(false);
                        expect(verifyOwnership(null as any, filePath)).toBe(false);
                        expect(verifyOwnership(undefined as any, filePath)).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should deny authorization for invalid file paths', () => {
            fc.assert(
                fc.property(
                    userIdArbitrary,
                    (userId) => {
                        expect(verifyOwnership(userId, '')).toBe(false);
                        expect(verifyOwnership(userId, null as any)).toBe(false);
                        expect(verifyOwnership(userId, undefined as any)).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should correctly handle ownership verification for paths with subfolders', () => {
            fc.assert(
                fc.property(
                    userIdArbitrary,
                    fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/),
                    filenameArbitrary,
                    (userId, subfolder, filename) => {
                        const filePath = `${userId}/${subfolder}/${filename}`;
                        
                        // Same user should be authorized
                        expect(verifyOwnership(userId, filePath)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should be case-sensitive for user ID comparison', () => {
            fc.assert(
                fc.property(
                    fc.stringMatching(/^[a-z]{5,20}$/),
                    filenameArbitrary,
                    (lowercaseUserId, filename) => {
                        const uppercaseUserId = lowercaseUserId.toUpperCase();
                        const filePath = `${lowercaseUserId}/${filename}`;
                        
                        // Different case should not match
                        expect(verifyOwnership(uppercaseUserId, filePath)).toBe(false);
                        // Same case should match
                        expect(verifyOwnership(lowercaseUserId, filePath)).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
