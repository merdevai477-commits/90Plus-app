import type { Match } from '../components/Matches/matchCardUtils';

export interface GroupedMatches {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
}

/** Country → Leagues → Matches hierarchy */
export interface CountryGroup {
  country: string;
  countryFlag: string | null;
  leagues: GroupedMatches[];
}
