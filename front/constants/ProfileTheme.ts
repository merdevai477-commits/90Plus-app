/**
 * ProfileTheme
 *
 * Shared color palette + spacing tokens for the profile-related UI.
 * Light matches Figma 90plus; dark uses the app Phantom black surfaces.
 */

export type ProfileColors = {
  deepBlack: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  border: string;
  borderSoft: string;
  neonGreen: string;
  neonBlue: string;
  neonPurple: string;
  neonRed: string;
  gold: string;
  profileBg: string;
  profileCard: string;
  profileCardBorder: string;
  profileChip: string;
  profileFilledChip: string;
  profileEmptyChip: string;
  profileMuted: string;
  profileHandle: string;
  profileTabBar: string;
  profileTabBorder: string;
  profilePrimary: string;
  profilePrimarySoft: string;
  profileSheet: string;
  avatarRing: string;
  avatarGlow: string;
  divider: string;
  xpTrack: string;
  achievementsCard: string;
  achievementsIconBg: string;
  navBtnBg: string;
  navBtnIcon: string;
  nameColor: string;
  bioColor: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  glass: string;
  glassMedium: string;
  glassDark: string;
  glassWhite: string;
  glassBlack: string;
  glassBorder: string;
  statusBar: 'light' | 'dark';
  coverFade: readonly [string, string, string];
  islandFill: readonly [string, string];
  islandFade: readonly [string, string, string];
  embossBorder: string;
  embossShadow: string;
};

const sharedAccents = {
  neonGreen: '#22A822',
  neonBlue: '#0090C8',
  neonPurple: '#6A2BD9',
  neonRed: '#E11D48',
  gold: '#D4A017',
  profilePrimary: '#6A2BD9',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#2196F3',
} as const;

export const PROFILE_THEME = {
  light: {
    ...sharedAccents,
    deepBlack: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#F3EDFF',
    textPrimary: '#23133C',
    textSecondary: 'rgba(35, 19, 60, 0.72)',
    textTertiary: 'rgba(35, 19, 60, 0.52)',
    textDisabled: 'rgba(35, 19, 60, 0.36)',
    border: 'rgba(35, 19, 60, 0.16)',
    borderSoft: 'rgba(35, 19, 60, 0.1)',
    profileBg: '#F9F6FE',
    profileCard: '#FFFFFF',
    profileCardBorder: '#E8E2F0',
    profileChip: '#FFFFFF',
    profileFilledChip: '#FFFFFF',
    profileEmptyChip: '#F5F0FF',
    profileMuted: '#827C94',
    profileHandle: '#6B7280',
    profileTabBar: '#FFFFFF',
    profileTabBorder: '#EDE7F6',
    profilePrimarySoft: '#F2ECFF',
    profileSheet: '#F9F6FE',
    avatarRing: '#FFFFFF',
    avatarGlow: 'rgba(106, 43, 217, 0.46)',
    divider: '#E0D9EC',
    xpTrack: '#E0D3F7',
    achievementsCard: '#F1E9FF',
    achievementsIconBg: '#DECDF7',
    navBtnBg: '#FFFFFF',
    navBtnIcon: '#23133C',
    nameColor: '#000000',
    bioColor: '#434343',
    glass: 'rgba(35, 19, 60, 0.05)',
    glassMedium: 'rgba(35, 19, 60, 0.09)',
    glassDark: 'rgba(35, 19, 60, 0.04)',
    glassWhite: 'rgba(255, 255, 255, 0.94)',
    glassBlack: 'rgba(255, 255, 255, 0.9)',
    glassBorder: 'rgba(35, 19, 60, 0.12)',
    statusBar: 'dark' as const,
    coverFade: ['rgba(249,246,254,0)', 'rgba(249,246,254,0.35)', '#F9F6FE'] as const,
    islandFill: ['rgba(255,255,255,0.94)', 'rgba(248,245,255,0.96)'] as const,
    islandFade: ['rgba(249,246,254,0.98)', 'rgba(249,246,254,0.88)', 'rgba(249,246,254,0)'] as const,
    embossBorder: 'rgba(106,43,217,0.12)',
    embossShadow: '#1E0844',
  },
  dark: {
    ...sharedAccents,
    neonPurple: '#8B5CF6',
    profilePrimary: '#8B5CF6',
    deepBlack: '#080608',
    surface: '#100D19',
    surfaceElevated: '#191326',
    textPrimary: 'rgba(255,255,255,0.92)',
    textSecondary: 'rgba(255,255,255,0.62)',
    textTertiary: 'rgba(255,255,255,0.45)',
    textDisabled: 'rgba(255,255,255,0.32)',
    border: 'rgba(255,255,255,0.12)',
    borderSoft: 'rgba(255,255,255,0.08)',
    profileBg: '#080608',
    profileCard: '#100D19',
    profileCardBorder: '#2A2040',
    profileChip: '#161024',
    profileFilledChip: '#161024',
    profileEmptyChip: '#120A22',
    profileMuted: 'rgba(255,255,255,0.55)',
    profileHandle: 'rgba(255,255,255,0.5)',
    profileTabBar: '#100D19',
    profileTabBorder: '#2A2040',
    profilePrimarySoft: 'rgba(139,92,246,0.18)',
    profileSheet: '#080608',
    avatarRing: 'rgba(255,255,255,0.92)',
    avatarGlow: 'rgba(139, 92, 246, 0.55)',
    divider: 'rgba(255,255,255,0.12)',
    xpTrack: 'rgba(139,92,246,0.22)',
    achievementsCard: 'rgba(139,92,246,0.16)',
    achievementsIconBg: 'rgba(139,92,246,0.28)',
    navBtnBg: 'rgba(22,16,36,0.92)',
    navBtnIcon: 'rgba(255,255,255,0.92)',
    nameColor: '#FFFFFF',
    bioColor: 'rgba(255,255,255,0.78)',
    glass: 'rgba(255,255,255,0.05)',
    glassMedium: 'rgba(255,255,255,0.08)',
    glassDark: 'rgba(0,0,0,0.35)',
    glassWhite: 'rgba(16,13,25,0.94)',
    glassBlack: 'rgba(8,6,8,0.92)',
    glassBorder: 'rgba(255,255,255,0.12)',
    statusBar: 'light' as const,
    coverFade: ['rgba(8,6,8,0)', 'rgba(8,6,8,0.55)', '#080608'] as const,
    islandFill: ['rgba(16,13,25,0.96)', 'rgba(12,8,22,0.98)'] as const,
    islandFade: ['rgba(8,6,8,0.98)', 'rgba(8,6,8,0.86)', 'rgba(8,6,8,0)'] as const,
    embossBorder: 'rgba(139,92,246,0.28)',
    embossShadow: '#000000',
  },
} as const satisfies { light: ProfileColors; dark: ProfileColors };

export function getProfileColors(isDark: boolean): ProfileColors {
  return isDark ? PROFILE_THEME.dark : PROFILE_THEME.light;
}

/** Backward-compatible light default used by static StyleSheets. */
export const ProfileTheme = {
  colors: PROFILE_THEME.light,
  gradients: {
    primary: ['#6A2BD9', '#4B1FA3'] as const,
    cover: ['rgba(249,246,254,0)', 'rgba(249,246,254,1)'] as const,
    darkOverlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)'] as const,
    gold: ['#FFD700', '#FFA500'] as const,
    highlight: ['#F5576C', '#8E54E9'] as const,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    sheet: 33,
    pill: 999,
  },
  typography: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
} as const;

export type ProfileThemeType = typeof ProfileTheme;

export default ProfileTheme;
