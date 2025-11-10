export interface PreferencesState {
  defaultTab: string;
  lastScrollPositions: Record<string, number>;
  themeOverrides?: Record<string, any>;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  measurementUnit: 'metric' | 'imperial';
  startPage?: string;
  compactMode: boolean;
  animations: boolean;
}