/**
 * ProfileTheme
 *
 * Shared color palette + spacing tokens for the profile-related UI.
 * Light / white surface so cards, chips, and borders stay clearly visible.
 */

export const ProfileTheme = {
  colors: {
    // Base surfaces
    deepBlack: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#F7F7F9',

    // Text
    textPrimary: '#111111',
    textSecondary: 'rgba(17, 17, 17, 0.68)',
    textTertiary: 'rgba(17, 17, 17, 0.48)',
    textDisabled: 'rgba(17, 17, 17, 0.34)',

    // Borders / dividers — stronger so edges read clearly on white
    border: 'rgba(17, 17, 17, 0.16)',
    borderSoft: 'rgba(17, 17, 17, 0.1)',

    // Brand accents (matches the reels/home palette)
    neonGreen: '#22A822',
    neonBlue: '#0090C8',
    neonPurple: '#7C3AED',
    neonRed: '#E11D48',
    gold: '#D4A017',

    // Profile v2 — white mode with defined edges
    profileBg: '#FFFFFF',
    profileCard: '#FFFFFF',
    profileCardBorder: '#D4D4DA',
    profileChip: '#FFFFFF',
    profileFilledChip: '#FFFFFF',
    profileEmptyChip: '#F3F3F6',
    profileMuted: '#6B6B73',
    profileHandle: '#6B6B73',
    profileTabBar: '#FFFFFF',
    profileTabBorder: '#D4D4DA',
    profilePrimary: '#7C3AED',
    avatarRing: '#7C3AED',

    // Semantic
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#2196F3',

    // Glass overlays (light surfaces)
    glass: 'rgba(17, 17, 17, 0.04)',
    glassMedium: 'rgba(17, 17, 17, 0.08)',
    glassDark: 'rgba(17, 17, 17, 0.03)',
    glassWhite: 'rgba(255, 255, 255, 0.92)',
    glassBlack: 'rgba(255, 255, 255, 0.88)',
    glassBorder: 'rgba(17, 17, 17, 0.14)',
  },

  gradients: {
    /** Brand gradient used by action buttons. */
    primary: ['#7C3AED', '#5B21B6'] as const,
    /** Soft fade under cover imagery into the white page. */
    cover: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.72)'] as const,
    /** Overlay used over the cover when buttons need contrast. */
    darkOverlay: ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.35)'] as const,
    /** Gold accent used on the FIFA card. */
    gold: ['#FFD700', '#FFA500'] as const,
    /** Pink → purple gradient for highlight sections. */
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
