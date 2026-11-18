/**
 * Share & Win theme — Figma Frame123 (1997:5301) light tokens + dark adaptation.
 * Light variables from Figma `--90plus-*`. Dark mirrors AUTH_DARK / GATE_THEME.
 */

export type ShareWinTheme = {
  isDark: boolean;
  screen: string;
  ink: string;
  muted: string;
  primary: string;
  dark: string;
  secondary: string;
  pale: string;
  light: string;
  border: string;
  accent: string;
  card: string;
  cardAlt: string;
  rowBg: string;
  avatarBg: string;
  hintBg: string;
  /** Share-card footer copy — light ink in dark mode for contrast. */
  hintText: string;
  white: string;
  countdownGradient: readonly [string, string, string];
  pointsGradient: readonly [string, string];
  prizeFeaturedGradient: readonly [string, string, string];
  prizeSecondaryGradient: readonly [string, string];
  podiumGradient: readonly [string, string];
  statusBar: 'light' | 'dark';
  refresh: string;
  headerIcon: string;
};

export function getShareWinTheme(isDark: boolean): ShareWinTheme {
  if (isDark) {
    return {
      isDark: true,
      screen: '#08060F',
      ink: 'rgba(255,255,255,0.92)',
      muted: 'rgba(255,255,255,0.55)',
      primary: '#6A2BD9',
      dark: '#4B1FA3',
      secondary: '#A855F7',
      pale: '#1A0F30',
      light: '#E9D5FF',
      border: '#2A2040',
      accent: '#F5B301',
      card: '#120A22',
      cardAlt: '#160B2C',
      rowBg: 'rgba(243,237,255,0.08)',
      avatarBg: 'rgba(231,219,255,0.18)',
      hintBg: 'rgba(106,43,217,0.32)',
      white: '#FFFFFF',
      hintText: 'rgba(233,213,255,0.92)',
      countdownGradient: ['#A855F7', '#6A2BD9', '#4B1FA3'],
      pointsGradient: ['#A855F7', '#4B1FA3'],
      prizeFeaturedGradient: ['#6A2BD9', '#3B1480', '#1C0C3D'],
      prizeSecondaryGradient: ['#3B1480', '#1C0C3D'],
      podiumGradient: ['#4B1FA3', '#1C0C3D'],
      statusBar: 'light',
      refresh: '#A855F7',
      headerIcon: '#FFFFFF',
    };
  }

  return {
    isDark: false,
    screen: '#FCFCFC',
    ink: '#24104E',
    muted: '#6B7280',
    primary: '#6A2BD9',
    dark: '#4B1FA3',
    secondary: '#A855F7',
    pale: '#F3EDFF',
    light: '#E9D5FF',
    border: '#E5E7EB',
    accent: '#F5B301',
    card: '#FFFFFF',
    cardAlt: '#F9F5FE',
    rowBg: '#F9F5FE',
    avatarBg: '#E7DBFF',
    hintBg: '#F2ECFD',
    white: '#FFFFFF',
    hintText: '#4B1FA3',
    countdownGradient: ['#A855F7', '#6A2BD9', '#4B1FA3'],
    pointsGradient: ['#A855F7', '#4B1FA3'],
    prizeFeaturedGradient: ['#7C3AED', '#5B21B6', '#2E1065'],
    prizeSecondaryGradient: ['#4B1FA3', '#1C0C3D'],
    podiumGradient: ['#4B1FA3', '#1C0C3D'],
    statusBar: 'dark',
    refresh: '#6A2BD9',
    headerIcon: '#24104E',
  };
}
