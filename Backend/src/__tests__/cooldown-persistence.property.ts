/**
 * Property-Based Tests for Cooldown Persistence Across Sessions
 * Using fast-check for property-based testing
 * 
 * **Feature: security-technical-fixes, Property 13: Cooldown Persistence Across Sessions**
 * **Validates: Requirements 10.5, 11.5, 12.5**
 * 
 * This test verifies that cooldowns persist across user sessions (login/logout).
 * The key property is that cooldown calculations are purely based on stored timestamps,
 * not on any session state, ensuring consistent behavior regardless of when a user logs in.
 */

import * as fc from 'fast-check';

// Import cooldown calculation functions from existing tests
import { calculateAvatarCooldown } from './avatar-cooldown.property';
import { calculateCoverCooldown } from './cover-cooldown.property';
import { calculateUsernameCooldown } from './username-cooldown.property';

// Constants
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const AVATAR_COOLDOWN_DAYS = 7;
const COVER_COOLDOWN_DAYS = 15;
const USERNAME_COOLDOWN_DAYS = 15;

/**
 * Simulates a user session with stored timestamp data.
 * This represents the data that would be persisted in the database.
 */
interface UserCooldownData {
    lastAvatarChange: Date | null;
    lastCoverChange: Date | null;
    lastUsernameChange: Date | null;
}

/**
 * Simulates checking cooldowns at a specific "login" time.
 * This mimics what happens when a user logs in and the system
 * retrieves their stored timestamps from the database.
 */
function checkCooldownsAtLoginTime(
    userData: UserCooldownData,
    loginTime: Date
): {
    avatar: { canChange: boolean; daysRemaining: number };
    cover: { canChange: boolean; daysRemaining: number };
    username: { canChange: boolean; daysRemaining: number };
} {
    return {
        avatar: calculateAvatarCooldown(userData.lastAvatarChange, loginTime),
        cover: calculateCoverCooldown(userData.lastCoverChange, loginTime),
        username: calculateUsernameCooldown(userData.lastUsernameChange, loginTime),
    };
}

describe('Cooldown Persistence Property Tests', () => {
    /**
     * **Feature: security-technical-fixes, Property 13: Cooldown Persistence Across Sessions**
     * *For any* cooldown (avatar, cover, username), logging out and back in SHALL NOT reset 
     * the cooldown; the remaining time SHALL be calculated from the stored timestamp.
     * **Validates: Requirements 10.5, 11.5, 12.5**
     */
    describe('Property 13: Cooldown Persistence Across Sessions', () => {

        it('should persist avatar cooldown across multiple login sessions', () => {
            fc.assert(
                fc.property(
                    // Generate initial change timestamp (1-6 days ago, within cooldown)
                    fc.integer({ min: 1, max: 6 }),
                    // Generate first login offset (0-12 hours after change)
                    fc.integer({ min: 0, max: 12 }),
                    // Generate logout duration (1-48 hours)
                    fc.integer({ min: 1, max: 48 }),
                    (daysAgo, firstLoginHours, logoutHours) => {
                        const baseTime = new Date();
                        const lastAvatarChange = new Date(baseTime.getTime() - (daysAgo * MS_PER_DAY));
                        
                        // First login session
                        const firstLoginTime = new Date(lastAvatarChange.getTime() + (firstLoginHours * MS_PER_HOUR));
                        const firstSessionResult = calculateAvatarCooldown(lastAvatarChange, firstLoginTime);
                        
                        // Second login session (after logout period)
                        const secondLoginTime = new Date(firstLoginTime.getTime() + (logoutHours * MS_PER_HOUR));
                        const secondSessionResult = calculateAvatarCooldown(lastAvatarChange, secondLoginTime);
                        
                        // Calculate expected days remaining for each session
                        const daysSinceChangeAtFirst = Math.floor(
                            (firstLoginTime.getTime() - lastAvatarChange.getTime()) / MS_PER_DAY
                        );
                        const daysSinceChangeAtSecond = Math.floor(
                            (secondLoginTime.getTime() - lastAvatarChange.getTime()) / MS_PER_DAY
                        );
                        
                        // Verify cooldown is calculated from stored timestamp, not session
                        if (daysSinceChangeAtFirst < AVATAR_COOLDOWN_DAYS) {
                            expect(firstSessionResult.canChange).toBe(false);
                            expect(firstSessionResult.daysRemaining).toBe(AVATAR_COOLDOWN_DAYS - daysSinceChangeAtFirst);
                        }
                        
                        if (daysSinceChangeAtSecond < AVATAR_COOLDOWN_DAYS) {
                            expect(secondSessionResult.canChange).toBe(false);
                            expect(secondSessionResult.daysRemaining).toBe(AVATAR_COOLDOWN_DAYS - daysSinceChangeAtSecond);
                        }
                        
                        // Key property: second session should show less or equal remaining time
                        // (time progresses, cooldown doesn't reset)
                        if (!firstSessionResult.canChange && !secondSessionResult.canChange) {
                            expect(secondSessionResult.daysRemaining).toBeLessThanOrEqual(firstSessionResult.daysRemaining);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should persist cover cooldown across multiple login sessions', () => {
            fc.assert(
                fc.property(
                    // Generate initial change timestamp (1-14 days ago, within cooldown)
                    fc.integer({ min: 1, max: 14 }),
                    // Generate first login offset (0-12 hours after change)
                    fc.integer({ min: 0, max: 12 }),
                    // Generate logout duration (1-48 hours)
                    fc.integer({ min: 1, max: 48 }),
                    (daysAgo, firstLoginHours, logoutHours) => {
                        const baseTime = new Date();
                        const lastCoverChange = new Date(baseTime.getTime() - (daysAgo * MS_PER_DAY));
                        
                        // First login session
                        const firstLoginTime = new Date(lastCoverChange.getTime() + (firstLoginHours * MS_PER_HOUR));
                        const firstSessionResult = calculateCoverCooldown(lastCoverChange, firstLoginTime);
                        
                        // Second login session (after logout period)
                        const secondLoginTime = new Date(firstLoginTime.getTime() + (logoutHours * MS_PER_HOUR));
                        const secondSessionResult = calculateCoverCooldown(lastCoverChange, secondLoginTime);
                        
                        // Calculate expected days remaining for each session
                        const daysSinceChangeAtFirst = Math.floor(
                            (firstLoginTime.getTime() - lastCoverChange.getTime()) / MS_PER_DAY
                        );
                        const daysSinceChangeAtSecond = Math.floor(
                            (secondLoginTime.getTime() - lastCoverChange.getTime()) / MS_PER_DAY
                        );
                        
                        // Verify cooldown is calculated from stored timestamp, not session
                        if (daysSinceChangeAtFirst < COVER_COOLDOWN_DAYS) {
                            expect(firstSessionResult.canChange).toBe(false);
                            expect(firstSessionResult.daysRemaining).toBe(COVER_COOLDOWN_DAYS - daysSinceChangeAtFirst);
                        }
                        
                        if (daysSinceChangeAtSecond < COVER_COOLDOWN_DAYS) {
                            expect(secondSessionResult.canChange).toBe(false);
                            expect(secondSessionResult.daysRemaining).toBe(COVER_COOLDOWN_DAYS - daysSinceChangeAtSecond);
                        }
                        
                        // Key property: second session should show less or equal remaining time
                        if (!firstSessionResult.canChange && !secondSessionResult.canChange) {
                            expect(secondSessionResult.daysRemaining).toBeLessThanOrEqual(firstSessionResult.daysRemaining);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should persist username cooldown across multiple login sessions', () => {
            fc.assert(
                fc.property(
                    // Generate initial change timestamp (1-14 days ago, within cooldown)
                    fc.integer({ min: 1, max: 14 }),
                    // Generate first login offset (0-12 hours after change)
                    fc.integer({ min: 0, max: 12 }),
                    // Generate logout duration (1-48 hours)
                    fc.integer({ min: 1, max: 48 }),
                    (daysAgo, firstLoginHours, logoutHours) => {
                        const baseTime = new Date();
                        const lastUsernameChange = new Date(baseTime.getTime() - (daysAgo * MS_PER_DAY));
                        
                        // First login session
                        const firstLoginTime = new Date(lastUsernameChange.getTime() + (firstLoginHours * MS_PER_HOUR));
                        const firstSessionResult = calculateUsernameCooldown(lastUsernameChange, firstLoginTime);
                        
                        // Second login session (after logout period)
                        const secondLoginTime = new Date(firstLoginTime.getTime() + (logoutHours * MS_PER_HOUR));
                        const secondSessionResult = calculateUsernameCooldown(lastUsernameChange, secondLoginTime);
                        
                        // Calculate expected days remaining for each session
                        const daysSinceChangeAtFirst = Math.floor(
                            (firstLoginTime.getTime() - lastUsernameChange.getTime()) / MS_PER_DAY
                        );
                        const daysSinceChangeAtSecond = Math.floor(
                            (secondLoginTime.getTime() - lastUsernameChange.getTime()) / MS_PER_DAY
                        );
                        
                        // Verify cooldown is calculated from stored timestamp, not session
                        if (daysSinceChangeAtFirst < USERNAME_COOLDOWN_DAYS) {
                            expect(firstSessionResult.canChange).toBe(false);
                            expect(firstSessionResult.daysRemaining).toBe(USERNAME_COOLDOWN_DAYS - daysSinceChangeAtFirst);
                        }
                        
                        if (daysSinceChangeAtSecond < USERNAME_COOLDOWN_DAYS) {
                            expect(secondSessionResult.canChange).toBe(false);
                            expect(secondSessionResult.daysRemaining).toBe(USERNAME_COOLDOWN_DAYS - daysSinceChangeAtSecond);
                        }
                        
                        // Key property: second session should show less or equal remaining time
                        if (!firstSessionResult.canChange && !secondSessionResult.canChange) {
                            expect(secondSessionResult.daysRemaining).toBeLessThanOrEqual(firstSessionResult.daysRemaining);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should calculate all cooldowns consistently from stored timestamps regardless of session', () => {
            // Helper to generate nullable dates properly - filter out invalid dates (NaN)
            const nullableDate = fc.oneof(
                fc.constant(null),
                fc.date({ min: new Date(Date.now() - 30 * MS_PER_DAY), max: new Date() })
                    .filter(d => !isNaN(d.getTime()))
            );
            
            fc.assert(
                fc.property(
                    // Generate user cooldown data with various timestamps
                    fc.record({
                        lastAvatarChange: nullableDate,
                        lastCoverChange: nullableDate,
                        lastUsernameChange: nullableDate,
                    }),
                    // Generate multiple login times to simulate sessions - filter out invalid dates
                    fc.array(
                        fc.date({ min: new Date(), max: new Date(Date.now() + 30 * MS_PER_DAY) })
                            .filter(d => !isNaN(d.getTime())),
                        { minLength: 2, maxLength: 5 }
                    ),
                    (userData, loginTimes) => {
                        // Sort login times chronologically
                        const sortedLoginTimes = [...loginTimes].sort((a, b) => a.getTime() - b.getTime());
                        
                        // Check cooldowns at each login time
                        const results = sortedLoginTimes.map(loginTime => 
                            checkCooldownsAtLoginTime(userData, loginTime)
                        );
                        
                        // Verify monotonic decrease in remaining days across sessions
                        for (let i = 1; i < results.length; i++) {
                            const prev = results[i - 1];
                            const curr = results[i];
                            
                            // Avatar cooldown should decrease or stay same (never increase)
                            if (!prev.avatar.canChange && !curr.avatar.canChange) {
                                expect(curr.avatar.daysRemaining).toBeLessThanOrEqual(prev.avatar.daysRemaining);
                            }
                            
                            // Cover cooldown should decrease or stay same
                            if (!prev.cover.canChange && !curr.cover.canChange) {
                                expect(curr.cover.daysRemaining).toBeLessThanOrEqual(prev.cover.daysRemaining);
                            }
                            
                            // Username cooldown should decrease or stay same
                            if (!prev.username.canChange && !curr.username.canChange) {
                                expect(curr.username.daysRemaining).toBeLessThanOrEqual(prev.username.daysRemaining);
                            }
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should never reset cooldown due to logout/login cycle', () => {
            fc.assert(
                fc.property(
                    // Generate a change timestamp within cooldown period
                    fc.integer({ min: 1, max: 6 }), // days ago for avatar (within 7-day cooldown)
                    // Generate number of login/logout cycles
                    fc.integer({ min: 1, max: 10 }),
                    // Generate hours between each cycle
                    fc.array(fc.integer({ min: 1, max: 24 }), { minLength: 1, maxLength: 10 }),
                    (daysAgo, numCycles, hoursBetweenCycles) => {
                        const baseTime = new Date();
                        const lastAvatarChange = new Date(baseTime.getTime() - (daysAgo * MS_PER_DAY));
                        
                        let currentTime = new Date(lastAvatarChange.getTime() + MS_PER_HOUR); // Start 1 hour after change
                        let previousDaysRemaining = AVATAR_COOLDOWN_DAYS;
                        
                        // Simulate multiple login/logout cycles
                        for (let i = 0; i < Math.min(numCycles, hoursBetweenCycles.length); i++) {
                            const result = calculateAvatarCooldown(lastAvatarChange, currentTime);
                            
                            if (!result.canChange) {
                                // Cooldown should never increase (reset) after a login
                                expect(result.daysRemaining).toBeLessThanOrEqual(previousDaysRemaining);
                                previousDaysRemaining = result.daysRemaining;
                            }
                            
                            // Advance time for next "login"
                            currentTime = new Date(currentTime.getTime() + (hoursBetweenCycles[i] * MS_PER_HOUR));
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should transition from cooldown to allowed state based on stored timestamp only', () => {
            fc.assert(
                fc.property(
                    // Generate a timestamp that will cross the cooldown boundary
                    fc.integer({ min: 5, max: 6 }), // 5-6 days ago (close to 7-day boundary)
                    fc.integer({ min: 24, max: 72 }), // hours to add (will cross boundary)
                    (daysAgo, hoursToAdd) => {
                        const baseTime = new Date();
                        const lastAvatarChange = new Date(baseTime.getTime() - (daysAgo * MS_PER_DAY));
                        
                        // First check - should be in cooldown
                        const firstCheck = calculateAvatarCooldown(lastAvatarChange, baseTime);
                        
                        // Second check - after adding hours (may cross boundary)
                        const laterTime = new Date(baseTime.getTime() + (hoursToAdd * MS_PER_HOUR));
                        const secondCheck = calculateAvatarCooldown(lastAvatarChange, laterTime);
                        
                        const totalDaysSinceChange = Math.floor(
                            (laterTime.getTime() - lastAvatarChange.getTime()) / MS_PER_DAY
                        );
                        
                        // Verify state transition is based on timestamp calculation
                        if (totalDaysSinceChange >= AVATAR_COOLDOWN_DAYS) {
                            expect(secondCheck.canChange).toBe(true);
                            expect(secondCheck.daysRemaining).toBe(0);
                        } else {
                            expect(secondCheck.canChange).toBe(false);
                            expect(secondCheck.daysRemaining).toBe(AVATAR_COOLDOWN_DAYS - totalDaysSinceChange);
                        }
                        
                        // If first was in cooldown and second is allowed, verify proper transition
                        if (!firstCheck.canChange && secondCheck.canChange) {
                            // This is a valid transition - cooldown expired
                            expect(totalDaysSinceChange).toBeGreaterThanOrEqual(AVATAR_COOLDOWN_DAYS);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
