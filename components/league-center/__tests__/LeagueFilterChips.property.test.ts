/**
 * Property-Based Tests for LeagueFilterChips Component
 *
 * **Feature: interactive-bottom-nav, Property 4: League chip rendering completeness**
 * **Validates: Requirements 3.2**
 */

import * as fc from 'fast-check';
import { LeagueChip, renderLeagueChip, DEFAULT_LEAGUES } from '../leagueUtils';

// Custom arbitrary for generating valid LeagueChip objects
const leagueChipArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  logo: fc.webUrl(),
  isSelected: fc.boolean(),
});

describe('LeagueFilterChips Property Tests', () => {
  /**
   * **Feature: interactive-bottom-nav, Property 4: League chip rendering completeness**
   *
   * For any LeagueChip data object, the rendered chip SHALL contain both
   * the league logo URL and the league name text.
   *
   * **Validates: Requirements 3.2**
   */
  describe('Property 4: League chip rendering completeness', () => {
    it('should return both logo and name for any LeagueChip (100 iterations)', () => {
      fc.assert(
        fc.property(leagueChipArbitrary, (league: LeagueChip) => {
          const rendered = renderLeagueChip(league);

          // Property: Rendered output should contain the logo URL
          expect(rendered.logo).toBe(league.logo);
          expect(typeof rendered.logo).toBe('string');
          expect(rendered.logo.length).toBeGreaterThan(0);

          // Property: Rendered output should contain the name
          expect(rendered.name).toBe(league.name);
          expect(typeof rendered.name).toBe('string');
          expect(rendered.name.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve logo URL exactly as provided (100 iterations)', () => {
      fc.assert(
        fc.property(leagueChipArbitrary, (league: LeagueChip) => {
          const rendered = renderLeagueChip(league);

          // Property: Logo URL should be preserved exactly
          expect(rendered.logo).toStrictEqual(league.logo);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve name exactly as provided (100 iterations)', () => {
      fc.assert(
        fc.property(leagueChipArbitrary, (league: LeagueChip) => {
          const rendered = renderLeagueChip(league);

          // Property: Name should be preserved exactly
          expect(rendered.name).toStrictEqual(league.name);
        }),
        { numRuns: 100 }
      );
    });

    it('should work correctly for all DEFAULT_LEAGUES', () => {
      for (const league of DEFAULT_LEAGUES) {
        const rendered = renderLeagueChip(league);

        // Property: Each default league should render with logo and name
        expect(rendered.logo).toBe(league.logo);
        expect(rendered.name).toBe(league.name);
        expect(rendered.logo.length).toBeGreaterThan(0);
        expect(rendered.name.length).toBeGreaterThan(0);
      }
    });

    it('should handle various league name formats (100 iterations)', () => {
      const leagueNameArbitrary = fc.oneof(
        fc.constant('Premier League'),
        fc.constant('LA LIGA'),
        fc.constant('Serie A'),
        fc.constant('Bundesliga'),
        fc.constant('Ligue 1'),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0)
      );

      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: leagueNameArbitrary,
            logo: fc.webUrl(),
            isSelected: fc.boolean(),
          }),
          (league: LeagueChip) => {
            const rendered = renderLeagueChip(league);

            // Property: Name should be preserved regardless of format
            expect(rendered.name).toBe(league.name);
            expect(rendered.logo).toBe(league.logo);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
