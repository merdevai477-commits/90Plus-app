/**
 * Filter utility functions for LeagueCenterScreen
 * Separated from React component for testability
 */

import { Match } from './matchCardUtils';
import { isSameDay } from './dateUtils';

/**
 * Filter matches by selected date
 * Matches without fixtureDate are included (pass through)
 */
export const filterMatchesByDate = (matches: Match[], selectedDate: Date): Match[] => {
  return matches.filter((match) => {
    // If match has a date string, parse and compare
    if (match.fixtureDate) {
      const matchDate = new Date(match.fixtureDate);
      return isSameDay(matchDate, selectedDate);
    }
    return true; // Include matches without date info
  });
};

/**
 * Filter matches by selected leagues
 * Empty selectedLeagues array returns all matches (no filter)
 */
export const filterMatchesByLeagues = (
  matches: Match[],
  selectedLeagues: number[]
): Match[] => {
  if (selectedLeagues.length === 0) {
    return matches; // No filter applied, return all
  }
  return matches.filter((match) => selectedLeagues.includes(match.league.id));
};

/**
 * Combined filter function - applies both date and league filters
 */
export const filterMatches = (
  matches: Match[],
  selectedDate: Date,
  selectedLeagues: number[]
): Match[] => {
  let filtered = filterMatchesByDate(matches, selectedDate);
  filtered = filterMatchesByLeagues(filtered, selectedLeagues);
  return filtered;
};
