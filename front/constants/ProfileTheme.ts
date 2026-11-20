/**
 * ProfileTheme
 *
 * Shared color palette + spacing tokens for the profile-related UI.
 * Tuned to the 90plus Figma profile (lavender surfaces, soft purple accents).
 */

export const ProfileTheme = {
  colors: {
    // Base surfaces
    deepBlack: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#F3EDFF',

    // Text
    textPrimary: '#23133C',
    textSecondary: 'rgba(35, 19, 60, 0.72)',
    textTertiary: 'rgba(35, 19, 60, 0.52)',
    textDisabled: 'rgba(35, 19, 60, 0.36)',

    // Borders / dividers
    border: 'rgba(35, 19, 60, 0.16)',
    borderSoft: 'rgba(35, 19, 60, 0.1)',

    // Brand accents
    neonGreen: '#22A822',
    neonBlue: '#0090C8',
    neonPurple: '#6A2BD9',
    neonRed: '#E11D48',
    gold: '#D4A017',

    // Profile v3 — Figma 90plus
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
    profilePrimary: '#6A2BD9',
    profilePrimarySoft: '#F2ECFF',
    profileSheet: '#F9F6FE',
    avatarRing: '#FFFFFF',
    avatarGlow: 'rgba(106, 43, 217, 0.46)',
    divider: '#E0D9EC',
    xpTrack: '#E0D3F7',
    achievementsCard: '#F1E9FF',
    achievementsIconBg: '#DECDF7',

    // Semantic
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#2196F3',

    // Glass overlays
    glass: 'rgba(35, 19, 60, 0.05)',
    glassMedium: 'rgba(35, 19, 60, 0.09)',
    glassDark: 'rgba(35, 19, 60, 0.04)',
    glassWhite: 'rgba(255, 255, 255, 0.94)',
    glassBlack: 'rgba(255, 255, 255, 0.9)',
    glassBorder: 'rgba(35, 19, 60, 0.12)',
  },

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
