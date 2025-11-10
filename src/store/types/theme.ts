export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface ThemeState {
  mode: 'light' | 'dark' | 'auto';
  fontScale: number;
  colors: ThemeColors;
  customThemes?: Record<string, Partial<ThemeColors>>;
  activeTheme?: string;
}