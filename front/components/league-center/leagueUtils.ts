/**
 * League Filter Utilities
 * Pure functions for league chip data handling
 */

export interface LeagueChip {
  id: number;
  name: string;
  logo: string;
  isSelected: boolean;
}

// Default major leagues data
export const DEFAULT_LEAGUES: LeagueChip[] = [
  {
    id: 39,
    name: 'Premier League',
    logo: 'https://media.api-sports.io/football/leagues/39.png',
    isSelected: false,
  },
  {
    id: 140,
    name: 'LA LIGA',
    logo: 'https://media.api-sports.io/football/leagues/140.png',
    isSelected: false,
  },
  {
    id: 135,
    name: 'Serie A',
    logo: 'https://media.api-sports.io/football/leagues/135.png',
    isSelected: false,
  },
  {
    id: 78,
    name: 'Bundesliga',
    logo: 'https://media.api-sports.io/football/leagues/78.png',
    isSelected: false,
  },
  {
    id: 61,
    name: 'Ligue 1',
    logo: 'https://media.api-sports.io/football/leagues/61.png',
    isSelected: false,
  },
];

/**
 * Renders a single league chip with logo and name
 * Returns the logo URL and name text for display
 */
export const renderLeagueChip = (league: LeagueChip): { logo: string; name: string } => {
  return {
    logo: league.logo,
    name: league.name,
  };
};
