// Type definitions for league center components

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface UserPrediction {
  type: 'home' | 'draw' | 'away';
  points?: number;
}

export interface LeagueSection {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: any[];
  isFavorite?: boolean;
}

