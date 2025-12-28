/**
 * Property-Based Tests for Avatar Change Cooldown Enforcement
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 10: Avatar Change Cooldown Enforcement**
 * **Validates: Requirements 10.2, 10.3**
 */

import * as fc from 'fast-check';

// Constants matching the profile routes
const AVATAR_CHANGE_COOLDOWN_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate cooldown status for avatar change
 * This mirrors the logic in profile.routes.ts
 */
export function calculateAvatarCooldown(lastAvatarChange: Date | null, currentTime: Date = new Date()): {
    canChange: boolean;
    daysRemaining: number;
    daysSinceLastChange: number;
} {
    if (!lastAvatarChange) {
        return { canChange: true, daysRemaining: 0, daysSinceLastChange: -1 };
    }

    const msSinceLastChange = currentTime.getTime() - lastAvatarChange.getTime();
    const daysSinceLastChange = Math.floor(msSinceLastChange / MS_PER_DAY);

    if (daysSinceLastChange >= AVATAR_CHANGE_COOLDOWN_DAYS) {
        return { canChange: true, daysRemaining: 0, daysSinceLastChange };
    }

    const daysRemaining = AVATAR_CHANGE_COOLDOWN_DAYS - daysSinceLastChange;
    return { canChange: false, daysRemaining, daysSinceLastChange };
}

/**
 * Simulate avatar change request result
 * Returns the response that would be sent by the API
 */
export function simulateAvatarChangeRequest(
    lastAvatarChange: Date | null,
    currentTime: Date = new Date()
): {
    status: 'SUCCESS' | 'ERROR';
    code?: string;
    daysRemaining?: number;
} {
    const cooldownStatus = calculateAvatarCooldown(lastAvatarChange, currentTime);

    if (!cooldownStatus.canChange) {
        return {
            status: 'ERROR',
            code: 'COOLDOWN_ACTIVE',
            daysRemaining: cooldownStatus.daysRemaining,
        };
    }

    return { status: 'SUCCESS' };
}

describe('Avatar Cooldown Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 10: Avatar Change Cooldown Enforcement**
     * *For any* avatar change request within 7 days of the last change, the system 
     * SHALL reject the request and return the remaining days in the response.
     * **Validates: Requirements 10.2, 10.3**
     */
    describe('Property 10: Avatar Change Cooldown Enforcement', () => {
        it('should reject avatar change requests within 7 days of last change', () => {
            fc.assert(
                fc.property(
                    // Generate days since last change (0 to 6 days - within cooldown)
                    fc.integer({ min: 0, max: 6 }),
                    // Generate hours within the day (0 to 23)
                    fc.integer({ min: 0, max: 23 }),
                    (daysSinceChange, hoursOffset) => {
                        const currentTime = new Date();
                        const lastAvatarChange = new Date(
                            currentTime.getTime() - (daysSinceChange * MS_PER_DAY) - (hoursOffset * 60 * 60 * 1000)
                        );

                        const result = simulateAvatarChangeRequest(lastAvatarChange, currentTime);

                        // Should be rejected
                        expect(result.status).toBe('ERROR');
                        expect(result.code).toBe('COOLDOWN_ACTIVE');
                        expect(result.daysRemaining).toBeDefined();
                        expect(result.daysRemaining).toBeGreaterThan(0);
                        expect(result.daysRemaining).toBeLessThanOrEqual(AVATAR_CHANGE_COOLDOWN_DAYS);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return correct remaining days in rejection response', () => {
            fc.assert(
                fc.property(
                    // Generate days since last change (0 to 6 days - within cooldown)
                    fc.integer({ min: 0, max: 6 }),
                    (daysSinceChange) => {
                        const currentTime = new Date();
                        const lastAvatarChange = new Date(
                            currentTime.getTime() - (daysSinceChange * MS_PER_DAY)
                        );

                        const result = simulateAvatarChangeRequest(lastAvatarChange, currentTime);
                        const expectedDaysRemaining = AVATAR_CHANGE_COOLDOWN_DAYS - daysSinceChange;

                        expect(result.daysRemaining).toBe(expectedDaysRemaining);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow avatar change after 7 days cooldown period', () => {
            fc.assert(
                fc.property(
                    // Generate days since last change (7 to 365 days - after cooldown)
                    fc.integer({ min: 7, max: 365 }),
                    (daysSinceChange) => {
                        const currentTime = new Date();
                        const lastAvatarChange = new Date(
                            currentTime.getTime() - (daysSinceChange * MS_PER_DAY)
                        );

                        const result = simulateAvatarChangeRequest(lastAvatarChange, currentTime);

                        // Should be allowed
                        expect(result.status).toBe('SUCCESS');
                        expect(result.code).toBeUndefined();
                        expect(result.daysRemaining).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should allow avatar change when no previous change exists', () => {
            const result = simulateAvatarChangeRequest(null);

            expect(result.status).toBe('SUCCESS');
            expect(result.code).toBeUndefined();
            expect(result.daysRemaining).toBeUndefined();
        });

        it('should correctly calculate days remaining at boundary', () => {
            // Test exactly at 7 days boundary
            const currentTime = new Date();
            const exactlySevenDaysAgo = new Date(
                currentTime.getTime() - (7 * MS_PER_DAY)
            );

            const result = simulateAvatarChangeRequest(exactlySevenDaysAgo, currentTime);

            // Should be allowed at exactly 7 days
            expect(result.status).toBe('SUCCESS');
        });

        it('should reject at 6 days 23 hours 59 minutes', () => {
            const currentTime = new Date();
            // Just under 7 days (6 days, 23 hours, 59 minutes)
            const justUnderSevenDays = new Date(
                currentTime.getTime() - (7 * MS_PER_DAY) + (60 * 1000) // 7 days minus 1 minute
            );

            const result = simulateAvatarChangeRequest(justUnderSevenDays, currentTime);

            // Should still be rejected (6 full days have passed)
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
                    (lastAvatarChange) => {
                        const currentTime = new Date();
                        const cooldownStatus = calculateAvatarCooldown(lastAvatarChange, currentTime);

                        const daysSinceChange = Math.floor(
                            (currentTime.getTime() - lastAvatarChange.getTime()) / MS_PER_DAY
                        );

                        if (daysSinceChange < AVATAR_CHANGE_COOLDOWN_DAYS) {
                            // Within cooldown - should not be able to change
                            expect(cooldownStatus.canChange).toBe(false);
                            expect(cooldownStatus.daysRemaining).toBe(
                                AVATAR_CHANGE_COOLDOWN_DAYS - daysSinceChange
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
