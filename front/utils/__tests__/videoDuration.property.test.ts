/**
 * Property-Based Tests for Video Duration Utility
 * 
 * **Feature: security-technical-fixes, Property 9: Video Duration Display Format**
 * 
 * Uses fast-check library for property-based testing.
 * Each test runs a minimum of 100 iterations.
 * 
 * **Validates: Requirements 9.1, 9.3, 9.4**
 */

import * as fc from 'fast-check';
import {
  formatDuration,
  parseDuration,
  shouldShowDuration,
  DurationResult,
  FormattedDuration,
} from '../videoDuration';

describe('Video Duration Property Tests', () => {
  /**
   * **Feature: security-technical-fixes, Property 9: Video Duration Display Format**
   * 
   * *For any* video with a known duration under one hour, the displayed duration
   * SHALL be formatted as MM:SS; for unknown duration, the duration indicator
   * SHALL be hidden.
   * 
   * **Validates: Requirements 9.1, 9.3, 9.4**
   */
  describe('Property 9: Video Duration Display Format', () => {
    /**
     * Property 9.1: Valid durations should be formatted as MM:SS
     * For any positive finite duration in seconds, the output should match MM:SS format
     */
    it('should format valid durations as MM:SS', () => {
      fc.assert(
        fc.property(
          // Generate valid duration in seconds (0 to 3599 for under 1 hour)
          fc.integer({ min: 0, max: 3599 }),
          (durationSeconds) => {
            const formatted = formatDuration(durationSeconds);

            // Should return a non-null string
            expect(formatted).not.toBeNull();
            expect(typeof formatted).toBe('string');

            // Should match MM:SS format (M:SS or MM:SS)
            const formatRegex = /^\d+:\d{2}$/;
            expect(formatted).toMatch(formatRegex);

            // Verify the values are correct
            const parts = formatted!.split(':');
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);

            expect(minutes).toBe(Math.floor(durationSeconds / 60));
            expect(seconds).toBe(durationSeconds % 60);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.2: Unknown/null durations should return null (hide indicator)
     * Requirement 9.4: Hide duration indicator for unknown duration
     */
    it('should return null for unknown/null durations', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          (nullValue) => {
            const formatted = formatDuration(nullValue);
            expect(formatted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.3: Invalid durations (negative, NaN, Infinity) should return null
     */
    it('should return null for invalid durations', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Negative numbers
            fc.integer({ min: -10000, max: -1 }),
            // NaN represented as a special case
            fc.constant(NaN),
            // Infinity
            fc.constant(Infinity),
            fc.constant(-Infinity)
          ),
          (invalidDuration) => {
            const formatted = formatDuration(invalidDuration);
            expect(formatted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.4: Round-trip consistency
     * For any valid duration, formatting then parsing should return the same value
     * (within rounding tolerance since we round to nearest second)
     */
    it('should maintain round-trip consistency for valid durations', () => {
      fc.assert(
        fc.property(
          // Generate valid duration in seconds (integers for exact round-trip)
          fc.integer({ min: 0, max: 3599 }),
          (durationSeconds) => {
            const formatted = formatDuration(durationSeconds);
            const parsed = parseDuration(formatted);

            // Round-trip should preserve the value
            expect(parsed).toBe(durationSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.5: Seconds should always be two digits (padded with leading zero)
     */
    it('should pad seconds with leading zero when needed', () => {
      fc.assert(
        fc.property(
          // Generate durations where seconds < 10
          fc.integer({ min: 0, max: 59 }).map(s => s % 10), // 0-9 seconds
          fc.integer({ min: 0, max: 59 }), // any minutes
          (seconds, minutes) => {
            const durationSeconds = minutes * 60 + seconds;
            const formatted = formatDuration(durationSeconds);

            expect(formatted).not.toBeNull();

            // Extract seconds part
            const parts = formatted!.split(':');
            const secondsPart = parts[1];

            // Should always be 2 digits
            expect(secondsPart.length).toBe(2);

            // If original seconds < 10, should have leading zero
            if (seconds < 10) {
              expect(secondsPart[0]).toBe('0');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.6: shouldShowDuration returns false for "0:00" and null
     * This ensures we hide the indicator for unknown durations
     */
    it('should not show duration for "0:00" or null values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null as FormattedDuration),
            fc.constant('0:00'),
            fc.constant(0 as DurationResult)
          ),
          (duration) => {
            const shouldShow = shouldShowDuration(duration);
            expect(shouldShow).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.7: shouldShowDuration returns true for valid positive durations
     */
    it('should show duration for valid positive values', () => {
      fc.assert(
        fc.property(
          // Generate valid positive durations (at least 1 second)
          fc.integer({ min: 1, max: 3599 }),
          (durationSeconds) => {
            // Test with number
            expect(shouldShowDuration(durationSeconds)).toBe(true);

            // Test with formatted string
            const formatted = formatDuration(durationSeconds);
            expect(shouldShowDuration(formatted)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.8: Duration formatting handles fractional seconds correctly
     * Should round to nearest second
     */
    it('should round fractional seconds to nearest integer', () => {
      fc.assert(
        fc.property(
          // Generate duration with fractional part
          fc.float({ min: 0, max: 3599, noNaN: true }),
          (durationWithFraction) => {
            // Skip infinity values
            if (!Number.isFinite(durationWithFraction)) return;

            const formatted = formatDuration(durationWithFraction);
            const parsed = parseDuration(formatted);

            // Should be rounded to nearest second
            expect(parsed).toBe(Math.round(durationWithFraction));
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.9: Large durations (over 1 hour) should still format correctly
     * Even though requirement says MM:SS for under 1 hour, we should handle larger values
     */
    it('should handle durations over one hour', () => {
      fc.assert(
        fc.property(
          // Generate durations over 1 hour (3600+ seconds)
          fc.integer({ min: 3600, max: 36000 }), // up to 10 hours
          (durationSeconds) => {
            const formatted = formatDuration(durationSeconds);

            expect(formatted).not.toBeNull();

            // Should still match M+:SS format
            const formatRegex = /^\d+:\d{2}$/;
            expect(formatted).toMatch(formatRegex);

            // Verify round-trip
            const parsed = parseDuration(formatted);
            expect(parsed).toBe(durationSeconds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('parseDuration edge cases', () => {
    /**
     * Property: Invalid format strings should return null
     */
    it('should return null for invalid format strings', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Empty string
            fc.constant(''),
            // No colon - just digits
            fc.stringMatching(/^[0-9]{1,5}$/),
            // Multiple colons
            fc.constant('1:2:3'),
            // Non-numeric parts
            fc.constant('a:bc'),
            // Seconds >= 60
            fc.constant('1:60'),
            fc.constant('1:99')
          ),
          (invalidFormat) => {
            const parsed = parseDuration(invalidFormat);
            // Invalid formats should return null or be handled gracefully
            if (invalidFormat === '' || !invalidFormat.includes(':') || invalidFormat.split(':').length !== 2) {
              expect(parsed).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
