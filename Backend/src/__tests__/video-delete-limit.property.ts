/**
 * Property-Based Tests for Video Delete Limit Enforcement
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 15: Video Delete Limit Enforcement**
 * **Feature: security-technical-fixes, Property 16: Video Delete Resets Upload Cooldown**
 * **Validates: Requirements 13.4, 13.5, 13.6**
 */

import * as fc from 'fast-check';
import { checkDeleteLimit, shouldResetUploadCooldown, MAX_REEL_DELETES } from '../controllers/video.controller';

describe('Video Delete Limit Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 15: Video Delete Limit Enforcement**
     * *For any* user who has deleted 2 videos, the third deletion attempt SHALL be blocked
     * with an appropriate error message.
     * **Validates: Requirements 13.5, 13.6**
     */
    describe('Property 15: Video Delete Limit Enforcement', () => {
        it('should allow deletion when delete count is below limit', () => {
            fc.assert(
                fc.property(
                    // Generate delete counts from 0 to MAX_REEL_DELETES - 1 (0 to 1)
                    fc.integer({ min: 0, max: MAX_REEL_DELETES - 1 }),
                    (deleteCount) => {
                        const result = checkDeleteLimit(deleteCount);

                        // Should be allowed to delete
                        expect(result.canDelete).toBe(true);
                        expect(result.remainingDeletes).toBe(MAX_REEL_DELETES - deleteCount);
                        expect(result.deletesUsed).toBe(deleteCount);
                        expect(result.maxDeletes).toBe(MAX_REEL_DELETES);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should block deletion when delete count reaches or exceeds limit', () => {
            fc.assert(
                fc.property(
                    // Generate delete counts at or above the limit (2 to 10)
                    fc.integer({ min: MAX_REEL_DELETES, max: 10 }),
                    (deleteCount) => {
                        const result = checkDeleteLimit(deleteCount);

                        // Should NOT be allowed to delete
                        expect(result.canDelete).toBe(false);
                        expect(result.remainingDeletes).toBe(0);
                        expect(result.deletesUsed).toBe(deleteCount);
                        expect(result.maxDeletes).toBe(MAX_REEL_DELETES);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should correctly report remaining deletes for any delete count', () => {
            fc.assert(
                fc.property(
                    // Generate any non-negative delete count
                    fc.integer({ min: 0, max: 100 }),
                    (deleteCount) => {
                        const result = checkDeleteLimit(deleteCount);

                        // Remaining deletes should never be negative
                        expect(result.remainingDeletes).toBeGreaterThanOrEqual(0);
                        
                        // Remaining deletes should be correct
                        const expectedRemaining = Math.max(0, MAX_REEL_DELETES - deleteCount);
                        expect(result.remainingDeletes).toBe(expectedRemaining);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should block exactly at the limit (2 deletes)', () => {
            // Test exactly at the boundary
            const result = checkDeleteLimit(MAX_REEL_DELETES);

            expect(result.canDelete).toBe(false);
            expect(result.remainingDeletes).toBe(0);
            expect(result.deletesUsed).toBe(MAX_REEL_DELETES);
        });

        it('should allow at one below the limit (1 delete)', () => {
            // Test one below the boundary
            const result = checkDeleteLimit(MAX_REEL_DELETES - 1);

            expect(result.canDelete).toBe(true);
            expect(result.remainingDeletes).toBe(1);
            expect(result.deletesUsed).toBe(MAX_REEL_DELETES - 1);
        });

        it('should allow when no deletes have been made', () => {
            const result = checkDeleteLimit(0);

            expect(result.canDelete).toBe(true);
            expect(result.remainingDeletes).toBe(MAX_REEL_DELETES);
            expect(result.deletesUsed).toBe(0);
        });

        it('should have MAX_REEL_DELETES set to 2 per requirements', () => {
            // Verify the constant matches requirements 13.5, 13.6
            expect(MAX_REEL_DELETES).toBe(2);
        });
    });

    /**
     * **Feature: security-technical-fixes, Property 16: Video Delete Resets Upload Cooldown**
     * *For any* video deletion (within the 2-delete limit), the upload cooldown SHALL be reset,
     * allowing immediate upload.
     * **Validates: Requirements 13.4**
     */
    describe('Property 16: Video Delete Resets Upload Cooldown', () => {
        it('should indicate upload cooldown reset when deletion is successful', () => {
            fc.assert(
                fc.property(
                    // Generate boolean for whether deletion was successful
                    fc.boolean(),
                    (wasDeleted) => {
                        const shouldReset = shouldResetUploadCooldown(wasDeleted);

                        // Upload cooldown should be reset if and only if deletion was successful
                        expect(shouldReset).toBe(wasDeleted);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should reset upload cooldown when video is deleted', () => {
            const shouldReset = shouldResetUploadCooldown(true);
            expect(shouldReset).toBe(true);
        });

        it('should not reset upload cooldown when deletion fails', () => {
            const shouldReset = shouldResetUploadCooldown(false);
            expect(shouldReset).toBe(false);
        });

        it('should allow upload immediately after successful deletion within limit', () => {
            fc.assert(
                fc.property(
                    // Generate delete counts below the limit (0 to 1)
                    fc.integer({ min: 0, max: MAX_REEL_DELETES - 1 }),
                    (deleteCount) => {
                        const deleteResult = checkDeleteLimit(deleteCount);
                        
                        // If deletion is allowed
                        if (deleteResult.canDelete) {
                            // Simulate successful deletion
                            const shouldReset = shouldResetUploadCooldown(true);
                            
                            // Upload cooldown should be reset
                            expect(shouldReset).toBe(true);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should not reset upload cooldown when deletion is blocked due to limit', () => {
            fc.assert(
                fc.property(
                    // Generate delete counts at or above the limit (2 to 10)
                    fc.integer({ min: MAX_REEL_DELETES, max: 10 }),
                    (deleteCount) => {
                        const deleteResult = checkDeleteLimit(deleteCount);
                        
                        // Deletion should be blocked
                        expect(deleteResult.canDelete).toBe(false);
                        
                        // Since deletion is blocked, no reset should happen
                        // (deletion was not successful)
                        const shouldReset = shouldResetUploadCooldown(false);
                        expect(shouldReset).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
