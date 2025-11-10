// Match related types
export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  homeLogo: string;
  awayLogo: string;
  date: string;
  time: string;
  status: 'finished' | 'live' | 'upcoming';
  league: string;
  leagueLogo?: string;
  venue?: string;
  prediction?: {
    type: 'win' | 'draw' | 'lose';
    homeScore: number;
    awayScore: number;
    points?: number;
    isCorrect?: boolean;
  };
  odds?: {
    home: number;
    draw: number;
    away: number;
  };
}

// Prediction related types
export interface Prediction {
  id: string;
  matchId: string;
  userId: string;
  type: 'win' | 'draw' | 'lose';
  homeScore: number;
  awayScore: number;
  points: number;
  isCorrect?: boolean;
  submittedAt: Date;
  matchResult?: {
    homeScore: number;
    awayScore: number;
  };
}

// User statistics
export interface UserStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  totalPoints: number;
  streak: number;
  rank: number;
  level: number;
}

// League related types
export interface League {
  id: string;
  name: string;
  logo: string;
  country: string;
  season: string;
  isActive: boolean;
}

// Team related types
export interface Team {
  id: string;
  name: string;
  logo: string;
  league: string;
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

// Search and filter types
export interface SearchFilters {
  query: string;
  leagues: string[];
  status: 'all' | 'live' | 'finished' | 'upcoming';
  dateRange: 'today' | 'tomorrow' | 'week' | 'month';
  teams: string[];
}

// Animation types
export interface AnimationConfig {
  duration: number;
  delay: number;
  easing?: string;
  useNativeDriver?: boolean;
}

// Haptic feedback types
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
export type HapticPattern = number[];

// Theme types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    sm: object;
    md: object;
    lg: object;
    xl: object;
  };
}

// API response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Event types
export interface MatchEvent {
  id: string;
  matchId: string;
  type: 'goal' | 'card' | 'substitution' | 'penalty';
  player: string;
  team: 'home' | 'away';
  minute: number;
  description: string;
}

// Notification types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  action?: {
    type: string;
    data: any;
  };
}

// Settings types
export interface UserSettings {
  notifications: {
    matchReminders: boolean;
    predictionResults: boolean;
    achievements: boolean;
    news: boolean;
  };
  haptics: {
    enabled: boolean;
    intensity: 'light' | 'medium' | 'heavy';
  };
  theme: {
    mode: 'light' | 'dark' | 'auto';
    primaryColor: string;
  };
  language: string;
  timezone: string;
}

// Achievement types
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  unlocked: boolean;
  unlockedAt?: Date;
  category: 'prediction' | 'streak' | 'points' | 'special';
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  points: number;
  accuracy: number;
  predictions: number;
  streak: number;
}

// Statistics types
export interface Statistics {
  totalMatches: number;
  liveMatches: number;
  upcomingMatches: number;
  finishedMatches: number;
  totalPredictions: number;
  correctPredictions: number;
  averageAccuracy: number;
  topPerformers: LeaderboardEntry[];
  recentActivity: Activity[];
}

export interface Activity {
  id: string;
  type: 'prediction' | 'achievement' | 'match' | 'streak';
  title: string;
  description: string;
  timestamp: Date;
  points?: number;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error?: string;
  data?: any;
}

// Form types
export interface PredictionForm {
  matchId: string;
  type: 'win' | 'draw' | 'lose';
  homeScore: number;
  awayScore: number;
}

export interface SearchForm {
  query: string;
  filters: SearchFilters;
}

// Navigation types
export interface NavigationProps {
  navigation: any;
  route: any;
}

// Component props types
export interface BaseComponentProps {
  style?: any;
  children?: React.ReactNode;
  testID?: string;
}

export interface AnimatedComponentProps extends BaseComponentProps {
  animation?: AnimationConfig;
  delay?: number;
}

export interface InteractiveComponentProps extends BaseComponentProps {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  haptic?: boolean;
}
