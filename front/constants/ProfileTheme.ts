/**
 * ProfileTheme
 *
 * Shared color palette + spacing tokens for the profile-related UI.
 * Light mode with strong borders so cards and chips stay clearly visible.
 */

export const ProfileTheme = {
  colors: {
    // Base surfaces — gray page so white cards read with clear edges
    deepBlack: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#F2F2F5',

    // Text
    textPrimary: '#0F0F12',
    textSecondary: 'rgba(15, 15, 18, 0.72)',
    textTertiary: 'rgba(15, 15, 18, 0.52)',
    textDisabled: 'rgba(15, 15, 18, 0.36)',

    // Borders / dividers — high-contrast strokes on white cards
    border: 'rgba(15, 15, 18, 0.42)',
    borderSoft: 'rgba(15, 15, 18, 0.24)',

    // Brand accents
    neonGreen: '#22A822',
    neonBlue: '#0090C8',
    neonPurple: '#7C3AED',
    neonRed: '#E11D48',
    gold: '#D4A017',

    // Profile v2 — light mode, defined edges
    profileBg: '#E8E8EE',
    profileCard: '#FFFFFF',
    profileCardBorder: '#3A3A44',
    profileChip: '#FFFFFF',
    profileFilledChip: '#FFFFFF',
    profileEmptyChip: '#F5F5F8',
    profileMuted: '#55555F',
    profileHandle: '#4A4A54',
    profileTabBar: '#FFFFFF',
    profileTabBorder: '#3A3A44',
    profilePrimary: '#7C3AED',
    avatarRing: '#7C3AED',

    // Semantic
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#2196F3',

    // Glass overlays (light surfaces)
    glass: 'rgba(15, 15, 18, 0.05)',
    glassMedium: 'rgba(15, 15, 18, 0.09)',
    glassDark: 'rgba(15, 15, 18, 0.04)',
    glassWhite: 'rgba(255, 255, 255, 0.94)',
    glassBlack: 'rgba(255, 255, 255, 0.9)',
    glassBorder: 'rgba(15, 15, 18, 0.22)',
  },

  gradients: {
    primary: ['#7C3AED', '#5B21B6'] as const,
    cover: ['rgba(232,232,238,0)', 'rgba(232,232,238,1)'] as const,
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
