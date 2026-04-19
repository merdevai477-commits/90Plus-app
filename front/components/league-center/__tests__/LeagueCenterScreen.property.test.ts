/**
 * Property-Based Tests for LeagueCenterScreen Component
 *
 * **Feature: interactive-bottom-nav, Property 3: Date selection filters matches correctly**
 * **Validates: Requirements 2.6**
 */

import * as fc from 'fast-check';
import { filterMatchesByDate, filterMatchesByLeagues, filterMatches } from '../filterUtils';
import { Match, LeagueInfo, TeamInfo } from '../matchCardUtils';
import { isSameDay } from '../dateUtils';

// Helper to create a valid TeamInfo
const createTeamInfo = (name: string): TeamInfo => ({
  name,
  logo: `https://example.com/logos/${name.toLowerCase().replace(/\s/g, '-')}.png`,
});

// Helper to create a valid LeagueInfo
const createLeagueInfo = (id: number, name: string): LeagueInfo => ({
  id,
  name,
  logo: `https://example.com/leagues/${id}.png`,
});

// Valid date arbitrary that filters out invalid dates
const validDateArbitraryForMatch = fc
  .date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) })
  .filter((d) => !isNaN(d.getTime()));

// Arbitrary for generating valid Match objects
const matchArbitrary = (fixtureDate?: Date): fc.Arbitrary<Match> =>
  fc.record({
    id: fc.uuid(),
    homeTeam: fc.string({ minLength: 1, maxLength: 20 }).map((name) => createTeamInfo(name)),
    awayTeam: fc.string({ minLength: 1, maxLength: 20 }).map((name) => createTeamInfo(name)),
    score: fc.record({
      home: fc.integer({ min: 0, max: 10 }),
      away: fc.integer({ min: 0, max: 10 }),
    }),
    status: fc.constantFrom('live', 'upcoming', 'finished') as fc.Arbitrary<'live' | 'upcoming' | 'finished'>,
    minute: fc.option(fc.string({ minLength: 1, maxLength: 5 }), { nil: undefined }),
    league: fc.record({
      id: fc.integer({ min: 1, max: 1000 }),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      logo: fc.webUrl(),
    }),
    fixtureDate: fixtureDate
      ? fc.constant(fixtureDate.toISOString())
      : fc.option(
          validDateArbitraryForMatch.map((d) => d.toISOString()),
          { nil: undefined }
        ),
  });

// Arbitrary for generating a list of matches with specific dates
const matchesWithDatesArbitrary = (dates: Date[]): fc.Arbitrary<Match[]> =>
  fc.array(
    fc.oneof(
      ...dates.map((date) => matchArbitrary(date))
    ),
    { minLength: 0, maxLength: 20 }
  );

// Valid date arbitrary
const validDateArbitrary = fc
  .date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) })
  .filter((d) => !isNaN(d.getTime()));

describe('LeagueCenterScreen Property Tests', () => {
  /**
   * **Feature: interactive-bottom-nav, Property 3: Date selection filters matches correctly**
   *
   * For any selected date and list of matches, all displayed matches SHALL have
   * a fixture date matching the selected date.
   *
   * **Validates: Requirements 2.6**
   */
  describe('Property 3: Date selection filters matches correctly', () => {
    it('should return only matches with fixture date matching selected date (100 iterations)', () => {
      fc.assert(
        fc.property(
          validDateArbitrary,
          fc.array(matchArbitrary(), { minLength: 0, maxLength: 20 }),
          (selectedDate: Date, matches: Match[]) => {
            const filtered = filterMatchesByDate(matches, selectedDate);

            // Property: All filtered matches should have a date matching the selected date
            // or have no fixtureDate (which means they pass through)
            for (const match of filtered) {
              if (match.fixtureDate) {
                const matchDate = new Date(match.fixtureDate);
                expect(isSameDay(matchDate, selectedDate)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any matches that match the selected date (100 iterations)', () => {
      fc.assert(
        fc.property(
          validDateArbitrary,
          fc.array(matchArbitrary(), { minLength: 0, maxLength: 20 }),
          (selectedDate: Date, matches: Match[]) => {
            const filtered = filterMatchesByDate(matches, selectedDate);

            // Property: All matches with matching date should be in the filtered result
            const matchingMatches = matches.filter((m) => {
              if (!m.fixtureDate) return true; // Matches without date pass through
              const matchDate = new Date(m.fixtureDate);
              return isSameDay(matchDate, selectedDate);
            });

            expect(filtered.length).toBe(matchingMatches.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter out matches with different dates (100 iterations)', () => {
      fc.assert(
        fc.property(
          validDateArbitrary,
          validDateArbitrary.filter((d) => d.getTime() !== new Date().setHours(0, 0, 0, 0)),
          fc.array(matchArbitrary(), { minLength: 1, maxLength: 10 }),
          (selectedDate: Date, differentDate: Date, baseMatches: Match[]) => {
            // Skip if dates happen to be the same day
            if (isSameDay(selectedDate, differentDate)) {
              return true;
            }

            // Create matches with the different date
            const matchesWithDifferentDate = baseMatches.map((m) => ({
              ...m,
              fixtureDate: differentDate.toISOString(),
            }));

            const filtered = filterMatchesByDate(matchesWithDifferentDate, selectedDate);

            // Property: No matches should be returned since all have different dates
            expect(filtered.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve match order after filtering (100 iterations)', () => {
      fc.assert(
        fc.property(
          validDateArbitrary,
          fc.array(matchArbitrary(), { minLength: 0, maxLength: 20 }),
          (selectedDate: Date, matches: Match[]) => {
            const filtered = filterMatchesByDate(matches, selectedDate);

            // Get the original indices of filtered matches
            const originalIndices = filtered.map((fm) =>
              matches.findIndex((m) => m.id === fm.id)
            );

            // Property: Indices should be in ascending order (preserves original order)
            for (let i = 1; i < originalIndices.length; i++) {
              expect(originalIndices[i]).toBeGreaterThan(originalIndices[i - 1]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle matches without fixtureDate by including them (100 iterations)', () => {
      fc.assert(
        fc.property(
          validDateArbitrary,
          fc.array(
            fc.record({
              id: fc.uuid(),
              homeTeam: fc.constant(createTeamInfo('Home Team')),
              awayTeam: fc.constant(createTeamInfo('Away Team')),
              score: fc.constant({ home: 0, away: 0 }),
              status: fc.constant('upcoming' as const),
              minute: fc.constant(undefined),
              league: fc.constant(createLeagueInfo(1, 'Test League')),
              fixtureDate: fc.constant(undefined),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (selectedDate: Date, matchesWithoutDate: Match[]) => {
            const filtered = filterMatchesByDate(matchesWithoutDate, selectedDate);

            // Property: Matches without fixtureDate should be included
            expect(filtered.length).toBe(matchesWithoutDate.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property tests for league filtering
   */
  describe('League filtering properties', () => {
    it('should return all matches when no leagues are selected (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.array(matchArbitrary(), { minLength: 0, maxLength: 20 }),
          (matches: Match[]) => {
            const filtered = filterMatchesByLeagues(matches, []);

            // Property: Empty league selection returns all matches
            expect(filtered.length).toBe(matches.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return only matches from selected leagues (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
          fc.array(matchArbitrary(), { minLength: 0, maxLength: 20 }),
          (selectedLeagues: number[], matches: Match[]) => {
            const filtered = filterMatchesByLeagues(matches, selectedLeagues);

            // Property: All filtered matches should have league ID in selected leagues
            for (const match of filtered) {
              expect(selectedLeagues).toContain(match.league.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Combined filtering properties
   */
  describe('Combined date and league filtering', () => {
    it('should apply both date and league filters correctly (100 iterations)', () => {
      fc.assert(
        fc.property(
          validDateArbitrary,
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
          fc.array(matchArbitrary(), { minLength: 0, maxLength: 20 }),
          (selectedDate: Date, selectedLeagues: number[], matches: Match[]) => {
            const filtered = filterMatches(matches, selectedDate, selectedLeagues);

            // Property: All filtered matches should satisfy both conditions
            for (const match of filtered) {
              // League filter
              expect(selectedLeagues).toContain(match.league.id);

              // Date filter (if fixtureDate exists)
              if (match.fixtureDate) {
                const matchDate = new Date(match.fixtureDate);
                expect(isSameDay(matchDate, selectedDate)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
