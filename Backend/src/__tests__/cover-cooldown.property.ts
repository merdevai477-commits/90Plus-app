/**
 * Property-Based Tests for Cover Change Cooldown Enforcement
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 11: Cover Change Cooldown Enforcement**
 * **Validates: Requirements 11.2, 11.3**
 */

import * as fc from 'fast-check';

// Constants matching the profile routes
const COVER_CHANGE_COOLDOWN_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate cooldown status for cover change
 * This mirrors the logic in profile.routes.ts
 */
export function calculateCoverCooldown(lastCoverChange: Date | null, currentTime: Date = new Date()): {
    canChange: boolean;
    daysRemaining: number;
    daysSinceLastChange: number;
} {
    if (!lastCoverChange) {
        return { canChange: true, daysRemaining: 0, daysSinceLastChange: -1 };
    }

    const msSinceLastChange = currentTime.getTime() - lastCoverChange.getTime();
    const daysSinceLastChange = Math.floor(msSinceLastChange / MS_PER_DAY);

    if (daysSinceLastChange >= COVER_CHANGE_COOLDOWN_DAYS) {
        return { canChange: true, daysRemaining: 0, daysSinceLastChange };
    }

    const daysRemaining = COVER_CHANGE_COOLDOWN_DAYS - daysSinceLastChange;
    return { canChange: false, daysRemaining, daysSinceLastChange };
}

/**
 * Simulate cover change request result
 * Returns the response that would be sent by the API
 */
export function simulateCoverChangeRequest(
    lastCoverChange: Date | null,
    currentTime: Date = new Date()
): {
    status: 'SUCCESS' | 'ERROR';
    code?: string;
    daysRemaining?: number;
} {
    const cooldownStatus = calculateCoverCooldown(lastCoverChange, currentTime);

    if (!cooldownStatus.canChange) {
        return {
            status: 'ERROR',
            code: 'COOLDOWN_ACTIVE',
            daysRemaining: cooldownStatus.daysRemaining,
        };
    }

    return { status: 'SUCCESS' };
}


describe('Cover Cooldown Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 11: Cover Change Cooldown Enforcement**
     * *For any* cover photo change request within 15 days of the last change, the system 
     * SHALL reject the request and return the remaining days in the response.
     * **Validates: Requirements 11.2, 11.3**
     */
    describe('Property 11: Cover Change Cooldown Enforcement', () => {
        it('should reject cover change requests within 15 days of last change', () => {
            fc.assert(
                fc.property(
                    // Generate days since last change (0 to 14 days - within cooldown)
                    fc.integer({ min: 0, max: 14 }),
                    // Generate hours within the day (0 to 23)
                    fc.integer({ min: 0, max: 23 }),
                    (daysSinceChange, hoursOffset) => {
                        const currentTime = new Date();
                        const lastCoverChange = new Date(
                            currentTime.getTime() - (daysSinceChange * MS_PER_DAY) - (hoursOffset * 60 * 60 * 1000)
                        );

                        const result = simulateCoverChangeRequest(lastCoverChange, currentTime);

                        // Should be rejected
                        expect(result.status).toBe('ERROR');
                        expect(result.code).toBe('COOLDOWN_ACTIVE');
                        expect(result.daysRemaining).toBeDefined();
                        expect(result.daysRemaining).toBeGreaterThan(0);
                        expect(result.daysRemaining).toBeLessThanOrEqual(COVER_CHANGE_COOLDOWN_DAYS);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return correct remaining days in rejection response', () => {
            fc.assert(
                fc.property(
                    // Generate days since last change (0 to 14 days - within cooldown)
                    fc.integer({ min: 0, max: 14 }),
                    (daysSinceChange) => {
                        const currentTime = new Date();
                        const lastCoverChange = new Date(
                            currentTime.getTime() - (daysSinceChange * MS_PER_DAY)
                        );

                        const result = simulateCoverChangeRequest(lastCoverChange, currentTime);
                        const expectedDaysRemaining = COVER_CHANGE_COOLDOWN_DAYS - daysSinceChange;

                        expect(result.daysRemaining).toBe(expectedDaysRemaining);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow cover change after 15 days cooldown period', () => {
            fc.assert(
                fc.property(
                    // Generate days since last change (15 to 365 days - after cooldown)
                    fc.integer({ min: 15, max: 365 }),
                    (daysSinceChange) => {
                        const currentTime = new Date();
                        const lastCoverChange = new Date(
                            currentTime.getTime() - (daysSinceChange * MS_PER_DAY)
                        );

                        const result = simulateCoverChangeRequest(lastCoverChange, currentTime);

                        // Should be allowed
                        expect(result.status).toBe('SUCCESS');
                        expect(result.code).toBeUndefined();
                        expect(result.daysRemaining).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow cover change when no previous change exists', () => {
            const result = simulateCoverChangeRequest(null);

            expect(result.status).toBe('SUCCESS');
            expect(result.code).toBeUndefined();
            expect(result.daysRemaining).toBeUndefined();
        });

        it('should correctly calculate days remaining at boundary', () => {
            // Test exactly at 15 days boundary
            const currentTime = new Date();
            const exactlyFifteenDaysAgo = new Date(
                currentTime.getTime() - (15 * MS_PER_DAY)
            );

            const result = simulateCoverChangeRequest(exactlyFifteenDaysAgo, currentTime);

            // Should be allowed at exactly 15 days
            expect(result.status).toBe('SUCCESS');
        });

        it('should reject at 14 days 23 hours 59 minutes', () => {
            const currentTime = new Date();
            // Just under 15 days (15 days minus 1 minute)
            const justUnderFifteenDays = new Date(
                currentTime.getTime() - (15 * MS_PER_DAY) + (60 * 1000)
            );

            const result = simulateCoverChangeRequest(justUnderFifteenDays, currentTime);

            // Should still be rejected (14 full days have passed)
            expect(result.status).toBe('ERROR');
            expect(result.daysRemaining).toBe(1);
        });

        it('should handle cooldown persistence across any time period', () => {
            fc.assert(
                fc.property(
                    // Generate a timestamp for last change (within last year)
                    // Filter out invalid dates (NaN)
                    fc.date({ min: new Date(Date.now() - 365 * MS_PER_DAY), max: new Date() })
                        .filter(d => !isNaN(d.getTime())),
                    (lastCoverChange) => {
                        const currentTime = new Date();
                        const cooldownStatus = calculateCoverCooldown(lastCoverChange, currentTime);

                        const daysSinceChange = Math.floor(
                            (currentTime.getTime() - lastCoverChange.getTime()) / MS_PER_DAY
                        );

                        if (daysSinceChange < COVER_CHANGE_COOLDOWN_DAYS) {
                            // Within cooldown - should not be able to change
                            expect(cooldownStatus.canChange).toBe(false);
                            expect(cooldownStatus.daysRemaining).toBe(
                                COVER_CHANGE_COOLDOWN_DAYS - daysSinceChange
                            );
                        } else {
                            // After cooldown - should be able to change
                            expect(cooldownStatus.canChange).toBe(true);
                            expect(cooldownStatus.daysRemaining).toBe(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
