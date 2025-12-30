/**
 * Property-Based Tests for GradientMatchCard Component
 *
 * **Feature: interactive-bottom-nav, Property 5: Match card team information display**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * **Feature: interactive-bottom-nav, Property 6: Live match indicator consistency**
 * **Validates: Requirements 5.4, 5.5**
 *
 * **Feature: interactive-bottom-nav, Property 7: Gradient variety across cards**
 * **Validates: Requirements 6.3**
 */

import * as fc from 'fast-check';
import {
  Match,
  TeamInfo,
  extractTeamDisplayData,
  extractLiveIndicatorData,
  getGradientColors,
  GRADIENT_SCHEMES,
} from '../matchCardUtils';

// Arbitrary for generating valid team info
const teamInfoArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  logo: fc.webUrl(),
});

// Arbitrary for generating valid match status
const matchStatusArbitrary = fc.constantFrom('live', 'upcoming', 'finished') as fc.Arbitrary<'live' | 'upcoming' | 'finished'>;

// Arbitrary for generating valid match minute (for live matches)
const matchMinuteArbitrary = fc.oneof(
  fc.constant(undefined),
  fc.integer({ min: 0, max: 90 }).map(m => `${m}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`),
  fc.integer({ min: 0, max: 90 }).map(m => `${m}'`),
);

// Arbitrary for generating valid match data
const matchArbitrary: fc.Arbitrary<Match> = fc.record({
  id: fc.uuid(),
  homeTeam: teamInfoArbitrary,
  awayTeam: teamInfoArbitrary,
  score: fc.record({
    home: fc.integer({ min: 0, max: 15 }),
    away: fc.integer({ min: 0, max: 15 }),
  }),
  status: matchStatusArbitrary,
  minute: matchMinuteArbitrary,
  league: fc.record({
    id: fc.integer({ min: 1, max: 1000 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    logo: fc.webUrl(),
  }),
});

// Arbitrary for generating live matches specifically
const liveMatchArbitrary: fc.Arbitrary<Match> = matchArbitrary.map(match => ({
  ...match,
  status: 'live' as const,
}));

// Arbitrary for generating non-live matches
const nonLiveMatchArbitrary: fc.Arbitrary<Match> = matchArbitrary.map(match => ({
  ...match,
  status: fc.sample(fc.constantFrom('upcoming', 'finished') as fc.Arbitrary<'upcoming' | 'finished'>, 1)[0],
}));

describe('GradientMatchCard Property Tests', () => {
  /**
   * **Feature: interactive-bottom-nav, Property 5: Match card team information display**
   *
   * For any Match object with valid team data, the GradientMatchCard SHALL display:
   * - Home team logo and name on the left
   * - Away team logo and name on the right
   * - Score in the center (if available)
   *
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  describe('Property 5: Match card team information display', () => {
    it('should extract home team name and logo for any valid match (100 iterations)', () => {
      fc.assert(
        fc.property(matchArbitrary, (match: Match) => {
          const displayData = extractTeamDisplayData(match);

          // Property: Home team name should match input
          expect(displayData.homeTeamName).toBe(match.homeTeam.name);

          // Property: Home team logo should match input
          expect(displayData.homeTeamLogo).toBe(match.homeTeam.logo);
        }),
        { numRuns: 100 }
      );
    });

    it('should extract away team name and logo for any valid match (100 iterations)', () => {
      fc.assert(
        fc.property(matchArbitrary, (match: Match) => {
          const displayData = extractTeamDisplayData(match);

          // Property: Away team name should match input
          expect(displayData.awayTeamName).toBe(match.awayTeam.name);

          // Property: Away team logo should match input
          expect(displayData.awayTeamLogo).toBe(match.awayTeam.logo);
        }),
        { numRuns: 100 }
      );
    });

    it('should format score correctly for any valid match (100 iterations)', () => {
      fc.assert(
        fc.property(matchArbitrary, (match: Match) => {
          const displayData = extractTeamDisplayData(match);

          // Property: Score should be formatted as "home:away"
          const expectedScore = `${match.score.home}:${match.score.away}`;
          expect(displayData.score).toBe(expectedScore);
        }),
        { numRuns: 100 }
      );
    });

    it('should contain all required team information for any valid match (100 iterations)', () => {
      fc.assert(
        fc.property(matchArbitrary, (match: Match) => {
          const displayData = extractTeamDisplayData(match);

          // Property: All required fields should be present and non-empty
          expect(displayData.homeTeamName).toBeTruthy();
          expect(displayData.homeTeamLogo).toBeTruthy();
          expect(displayData.awayTeamName).toBeTruthy();
          expect(displayData.awayTeamLogo).toBeTruthy();
          expect(displayData.score).toBeTruthy();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: interactive-bottom-nav, Property 6: Live match indicator consistency**
   *
   * For any Match with status === 'live', the GradientMatchCard SHALL display:
   * - A red "Live" badge
   * - The current match minute (if available)
   *
   * **Validates: Requirements 5.4, 5.5**
   */
  describe('Property 6: Live match indicator consistency', () => {
    it('should indicate live status for any live match (100 iterations)', () => {
      fc.assert(
        fc.property(liveMatchArbitrary, (match: Match) => {
          const indicatorData = extractLiveIndicatorData(match);

          // Property: isLive should be true for live matches
          expect(indicatorData.isLive).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should not indicate live status for non-live matches (100 iterations)', () => {
      fc.assert(
        fc.property(
          matchArbitrary.filter(m => m.status !== 'live'),
          (match: Match) => {
            const indicatorData = extractLiveIndicatorData(match);

            // Property: isLive should be false for non-live matches
            expect(indicatorData.isLive).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include minute data when available for live matches (100 iterations)', () => {
      fc.assert(
        fc.property(
          liveMatchArbitrary.chain(match =>
            fc.constant({
              ...match,
              minute: `${fc.sample(fc.integer({ min: 1, max: 90 }), 1)[0]}:00`,
            })
          ),
          (match: Match) => {
            const indicatorData = extractLiveIndicatorData(match);

            // Property: minute should be passed through when present
            expect(indicatorData.minute).toBe(match.minute);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle undefined minute gracefully (100 iterations)', () => {
      fc.assert(
        fc.property(
          liveMatchArbitrary.map(match => ({ ...match, minute: undefined })),
          (match: Match) => {
            const indicatorData = extractLiveIndicatorData(match);

            // Property: minute should be undefined when not provided
            expect(indicatorData.minute).toBeUndefined();
            // Property: isLive should still be true
            expect(indicatorData.isLive).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: interactive-bottom-nav, Property 7: Gradient variety across cards**
   *
   * For any list of N matches (N > 1), the gradient indices assigned to consecutive
   * cards SHALL differ, ensuring visual variety.
   *
   * **Validates: Requirements 6.3**
   */
  describe('Property 7: Gradient variety across cards', () => {
    it('should return valid gradient colors for any index (100 iterations)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (index: number) => {
          const colors = getGradientColors(index);

          // Property: Should return exactly 2 colors
          expect(colors).toHaveLength(2);

          // Property: Colors should be valid hex strings
          expect(colors[0]).toMatch(/^#[0-9a-fA-F]{6}$/);
          expect(colors[1]).toMatch(/^#[0-9a-fA-F]{6}$/);
        }),
        { numRuns: 100 }
      );
    });

    it('should cycle through gradient schemes correctly (100 iterations)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), (index: number) => {
          const colors = getGradientColors(index);
          const expectedScheme = GRADIENT_SCHEMES[index % GRADIENT_SCHEMES.length];

          // Property: Colors should match the expected scheme based on index
          expect(colors[0]).toBe(expectedScheme[0]);
          expect(colors[1]).toBe(expectedScheme[1]);
        }),
        { numRuns: 100 }
      );
    });

    it('should provide different gradients for consecutive indices (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          (index: number) => {
            const colors1 = getGradientColors(index);
            const colors2 = getGradientColors(index + 1);

            // Property: Consecutive indices should have different gradients
            // (unless we've wrapped around to the same scheme, which only happens
            // when GRADIENT_SCHEMES.length === 1)
            if (GRADIENT_SCHEMES.length > 1) {
              const isDifferent = colors1[0] !== colors2[0] || colors1[1] !== colors2[1];
              expect(isDifferent).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure visual variety for a list of matches (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.array(matchArbitrary, { minLength: 2, maxLength: 20 }),
          (matches: Match[]) => {
            // Simulate assigning gradient indices to matches
            const gradientIndices = matches.map((_, i) => i);

            // Property: No two consecutive matches should have the same gradient
            for (let i = 1; i < gradientIndices.length; i++) {
              const prevColors = getGradientColors(gradientIndices[i - 1]);
              const currColors = getGradientColors(gradientIndices[i]);

              if (GRADIENT_SCHEMES.length > 1) {
                const isDifferent = prevColors[0] !== currColors[0] || prevColors[1] !== currColors[1];
                expect(isDifferent).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
