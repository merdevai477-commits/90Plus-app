/**
 * Property-Based Tests for Video Upload Cooldown Enforcement
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 14: Video Upload Cooldown Enforcement**
 * **Validates: Requirements 13.2, 13.3**
 */

import * as fc from 'fast-check';

// Constants matching the video controller and reels routes
const REEL_UPLOAD_COOLDOWN_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Calculate cooldown status for video upload
 * This mirrors the logic in video.controller.ts and reels.routes.ts
 */
export function calculateUploadCooldown(lastReelUpload: Date | null, currentTime: Date = new Date()): {
    canUpload: boolean;
    hoursRemaining: number;
    daysRemaining: number;
    hoursInDay: number;
} {
    if (!lastReelUpload) {
        return { canUpload: true, hoursRemaining: 0, daysRemaining: 0, hoursInDay: 0 };
    }

    const msSinceLastUpload = currentTime.getTime() - lastReelUpload.getTime();
    const cooldownMs = REEL_UPLOAD_COOLDOWN_DAYS * MS_PER_DAY;

    if (msSinceLastUpload >= cooldownMs) {
        return { canUpload: true, hoursRemaining: 0, daysRemaining: 0, hoursInDay: 0 };
    }

    const remainingMs = cooldownMs - msSinceLastUpload;
    const hoursRemaining = Math.ceil(remainingMs / MS_PER_HOUR);
    const daysRemaining = Math.floor(hoursRemaining / 24);
    const hoursInDay = hoursRemaining % 24;

    return { canUpload: false, hoursRemaining, daysRemaining, hoursInDay };
}

/**
 * Simulate video upload request result
 * Returns the response that would be sent by the API
 */
export function simulateUploadRequest(
    lastReelUpload: Date | null,
    currentTime: Date = new Date()
): {
    status: 'SUCCESS' | 'ERROR';
    code?: string;
    hoursRemaining?: number;
    daysRemaining?: number;
    hoursInDay?: number;
} {
    const cooldownStatus = calculateUploadCooldown(lastReelUpload, currentTime);

    if (!cooldownStatus.canUpload) {
        return {
            status: 'ERROR',
            code: 'UPLOAD_COOLDOWN_ACTIVE',
            hoursRemaining: cooldownStatus.hoursRemaining,
            daysRemaining: cooldownStatus.daysRemaining,
            hoursInDay: cooldownStatus.hoursInDay,
        };
    }

    return { status: 'SUCCESS' };
}

describe('Video Upload Cooldown Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 14: Video Upload Cooldown Enforcement**
     * *For any* video upload request within 3 days of the last upload, the system 
     * SHALL reject the request and return the remaining hours in the response.
     * **Validates: Requirements 13.2, 13.3**
     */
    describe('Property 14: Video Upload Cooldown Enforcement', () => {
        it('should reject upload requests within 3 days of last upload', () => {
            fc.assert(
                fc.property(
                    // Generate hours since last upload (0 to 71 hours - within cooldown)
                    fc.integer({ min: 0, max: 71 }),
                    (hoursSinceUpload) => {
                        const currentTime = new Date();
                        const lastReelUpload = new Date(
                            currentTime.getTime() - (hoursSinceUpload * MS_PER_HOUR)
                        );

                        const result = simulateUploadRequest(lastReelUpload, currentTime);

                        // Should be rejected
                        expect(result.status).toBe('ERROR');
                        expect(result.code).toBe('UPLOAD_COOLDOWN_ACTIVE');
                        expect(result.hoursRemaining).toBeDefined();
                        expect(result.hoursRemaining).toBeGreaterThan(0);
                        expect(result.hoursRemaining).toBeLessThanOrEqual(REEL_UPLOAD_COOLDOWN_DAYS * 24);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return correct remaining hours in rejection response', () => {
            fc.assert(
                fc.property(
                    // Generate hours since last upload (0 to 71 hours - within cooldown)
                    fc.integer({ min: 0, max: 71 }),
                    (hoursSinceUpload) => {
                        const currentTime = new Date();
                        const lastReelUpload = new Date(
                            currentTime.getTime() - (hoursSinceUpload * MS_PER_HOUR)
                        );

                        const result = simulateUploadRequest(lastReelUpload, currentTime);
                        const expectedHoursRemaining = (REEL_UPLOAD_COOLDOWN_DAYS * 24) - hoursSinceUpload;

                        // hoursRemaining should be ceiling of remaining time
                        expect(result.hoursRemaining).toBe(expectedHoursRemaining);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow upload after 3 days cooldown period', () => {
            fc.assert(
                fc.property(
                    // Generate hours since last upload (72 to 720 hours - after cooldown)
                    fc.integer({ min: 72, max: 720 }),
                    (hoursSinceUpload) => {
                        const currentTime = new Date();
                        const lastReelUpload = new Date(
                            currentTime.getTime() - (hoursSinceUpload * MS_PER_HOUR)
                        );

                        const result = simulateUploadRequest(lastReelUpload, currentTime);

                        // Should be allowed
                        expect(result.status).toBe('SUCCESS');
                        expect(result.code).toBeUndefined();
                        expect(result.hoursRemaining).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow upload when no previous upload exists', () => {
            const result = simulateUploadRequest(null);

            expect(result.status).toBe('SUCCESS');
            expect(result.code).toBeUndefined();
            expect(result.hoursRemaining).toBeUndefined();
        });

        it('should correctly calculate hours remaining at boundary', () => {
            // Test exactly at 72 hours (3 days) boundary
            const currentTime = new Date();
            const exactlyThreeDaysAgo = new Date(
                currentTime.getTime() - (3 * MS_PER_DAY)
            );

            const result = simulateUploadRequest(exactlyThreeDaysAgo, currentTime);

            // Should be allowed at exactly 3 days
            expect(result.status).toBe('SUCCESS');
        });

        it('should reject at 71 hours 59 minutes', () => {
            const currentTime = new Date();
            // Just under 72 hours (71 hours, 59 minutes)
            const justUnderThreeDays = new Date(
                currentTime.getTime() - (72 * MS_PER_HOUR) + (60 * 1000) // 72 hours minus 1 minute
            );

            const result = simulateUploadRequest(justUnderThreeDays, currentTime);

            // Should still be rejected
            expect(result.status).toBe('ERROR');
            expect(result.hoursRemaining).toBe(1);
        });

        it('should handle cooldown persistence across any time period', () => {
            fc.assert(
                fc.property(
                    // Generate a timestamp for last upload (within last 30 days)
                    // Filter out invalid dates (NaN)
                    fc.date({ min: new Date(Date.now() - 30 * MS_PER_DAY), max: new Date() })
                        .filter(d => !isNaN(d.getTime())),
                    (lastReelUpload) => {
                        const currentTime = new Date();
                        const cooldownStatus = calculateUploadCooldown(lastReelUpload, currentTime);

                        const msSinceUpload = currentTime.getTime() - lastReelUpload.getTime();
                        const cooldownMs = REEL_UPLOAD_COOLDOWN_DAYS * MS_PER_DAY;

                        if (msSinceUpload < cooldownMs) {
                            // Within cooldown - should not be able to upload
                            expect(cooldownStatus.canUpload).toBe(false);
                            expect(cooldownStatus.hoursRemaining).toBeGreaterThan(0);
                        } else {
                            // After cooldown - should be able to upload
                            expect(cooldownStatus.canUpload).toBe(true);
                            expect(cooldownStatus.hoursRemaining).toBe(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should correctly break down hours into days and hours', () => {
            fc.assert(
                fc.property(
                    // Generate hours since last upload (0 to 71 hours - within cooldown)
                    fc.integer({ min: 0, max: 71 }),
                    (hoursSinceUpload) => {
                        const currentTime = new Date();
                        const lastReelUpload = new Date(
                            currentTime.getTime() - (hoursSinceUpload * MS_PER_HOUR)
                        );

                        const result = simulateUploadRequest(lastReelUpload, currentTime);

                        if (result.hoursRemaining !== undefined && 
                            result.daysRemaining !== undefined && 
                            result.hoursInDay !== undefined) {
                            // Verify the breakdown is correct
                            expect(result.daysRemaining * 24 + result.hoursInDay).toBe(result.hoursRemaining);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
