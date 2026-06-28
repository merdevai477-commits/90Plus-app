/**
 * Utility functions and types for GradientMatchCard component
 * Separated for testability (no JSX dependencies)
 */

// Gradient color schemes for visual variety - premium dark sports app style
export const GRADIENT_SCHEMES: [string, string][] = [
  ['#1E3A5F', '#0D2137'],  // Deep blue
  ['#2D1B4E', '#1A1A2E'],  // Dark purple
  ['#1A3A3A', '#0D1F1F'],  // Dark teal
  ['#3D2B1F', '#1A1510'],  // Dark brown
  ['#2E1A3D', '#1A1025'],  // Deep violet
  ['#1A2E3D', '#0D1820'],  // Ocean blue
];

export interface TeamInfo {
  name: string;
  logo: string;
}

export interface LeagueInfo {
  id: number;
  name: string;
  logo: string;
  country?: string;
  countryFlag?: string | null;
  /** Knockout round or group label from 365 (e.g. Round of 32, Group A). */
  round?: string;
}

export interface Match {
  id: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  score: {
    home: number;
    away: number;
  };
  status: 'live' | 'upcoming' | 'finished' | 'NS' | 'TBD' | 'PST';
  statusShort?: string; // Raw status from API (e.g., "1H", "2H", "HT")
  /** Raw elapsed minute from API — authoritative for live clock display */
  elapsed?: number | null;
  minute?: string;
  startTimestamp?: number; // Timestamp of period start
  corners?: { home: number; away: number };
  time?: string; // Match kickoff time (e.g., "20:00")
  league: LeagueInfo;
  fixtureDate?: string; // ISO date string for filtering
  isFavorited?: boolean; // ✅ Added isFavorited
}

export interface TeamDisplayData {
  homeTeamName: string;
  homeTeamLogo: string;
  awayTeamName: string;
  awayTeamLogo: string;
  score: string;
}

export interface LiveIndicatorData {
  isLive: boolean;
  minute: string | undefined;
}

/**
 * Returns gradient colors for a given index, cycling through available schemes
 */
export const getGradientColors = (index: number): [string, string] => {
  return GRADIENT_SCHEMES[index % GRADIENT_SCHEMES.length];
};

/**
 * Team color mapping for dynamic gradients
 */
export const TEAM_COLORS: Record<string, string> = {
  // English Clubs
  'Chelsea': '#034694',
  'تشيلسي': '#034694',
  'Liverpool': '#C8102E',
  'ليفربول': '#C8102E',
  'Manchester City': '#6CABDD',
  'مانشستر سيتي': '#6CABDD',
  'Manchester United': '#DA291C',
  'مانشستر يونايتد': '#DA291C',
  'Arsenal': '#EF0107',
  'أرسنال': '#EF0107',
  'Tottenham': '#132257',
  'توتنهام': '#132257',

  // Spanish Clubs
  'Real Madrid': '#FFFFFF',
  'ريال مدريد': '#FFFFFF',
  'Barcelona': '#A8224E',
  'برشلونة': '#A8224E',
  'Atletico Madrid': '#CB3524',
  'أتلتيكو مدريد': '#CB3524',

  // German Clubs
  'Bayern Munich': '#DC052D',
  'بايرن ميونخ': '#DC052D',
  'Dortmund': '#FDE100',
  'دورتموند': '#FDE100',

  // Italian Clubs
  'Juventus': '#FFFFFF',
  'يوفنتوس': '#FFFFFF',
  'Inter Milan': '#0062BD',
  'إنتر ميلان': '#0062BD',
  'AC Milan': '#FB090B',
  'ميلان': '#FB090B',

  // French Clubs
  'Paris Saint Germain': '#004170',
  'باريس سان جيرمان': '#004170',

  // National Teams
  'Egypt': '#CE1126',
  'مصر': '#CE1126',
  'Saudi Arabia': '#006C35',
  'السعودية': '#006C35',
  'Brazil': '#FFDC02',
  'البرازيل': '#FFDC02',
  'Argentina': '#75AADB',
  'الأرجنتين': '#75AADB',
  'France': '#002395',
  'فرنسا': '#002395',
  'Germany': '#FFFFFF',
  'ألمانيا': '#FFFFFF',
  'Spain': '#EF1E22',
  'إسبانيا': '#EF1E22',
  'Italy': '#0062AD',
  'إيطاليا': '#0062AD',
  'England': '#FFFFFF',
  'إنجلترا': '#FFFFFF',
  'Portugal': '#E42518',
  'البرتغال': '#E42518',
  'Morocco': '#C1272D',
  'المغرب': '#C1272D',

  // Arab Clubs
  'Al Ahly': '#CE1126',
  'الأهلي': '#CE1126',
  'Zamalek': '#FFFFFF',
  'الزمالك': '#FFFFFF',
  'Al Hilal': '#0069B1',
  'الهلال': '#0069B1',
  'Al Nassr': '#FFC20E',
  'النصر': '#FFC20E',
  'Al Ittihad': '#FFD800',
  'الاتحاد': '#FFD800',
  'Al Ahli': '#006C35',
  'الأهلي السعودي': '#006C35',
  'Ismaily': '#FFD800',
  'الإسمايلي': '#FFD800',
  'Pyramids': '#002E5D',
  'بيراميدز': '#002E5D',
};

/**
 * Gets dynamic team colors for a match
 * Returns [HomeColor, AwayColor] for a smooth melting effect
 */
export const getTeamGradients = (homeName: string, awayName: string): [string, string] => {
  const homeColor = TEAM_COLORS[homeName] || GRADIENT_SCHEMES[0][0];
  const awayColor = TEAM_COLORS[awayName] || GRADIENT_SCHEMES[0][1];

  return [homeColor, awayColor];
};

/**
 * Extracts team display data from a match for rendering
 */
export const extractTeamDisplayData = (match: Match): TeamDisplayData => {
  return {
    homeTeamName: match.homeTeam.name,
    homeTeamLogo: match.homeTeam.logo,
    awayTeamName: match.awayTeam.name,
    awayTeamLogo: match.awayTeam.logo,
    score: `${match.score.home}:${match.score.away}`,
  };
};

/**
 * Extracts live match indicator data
 */
export const extractLiveIndicatorData = (match: Match): LiveIndicatorData => {
  return {
    isLive: match.status === 'live',
    minute: match.minute,
  };
};
