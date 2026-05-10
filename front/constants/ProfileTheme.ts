/**
 * ProfileTheme
 *
 * Shared color palette + spacing tokens for the profile-related UI.
 * Re-exports a focused subset of the main design system so profile
 * components don't have to import multiple places.
 *
 * This file was accidentally deleted from the working tree in a prior
 * cleanup commit. Restored with the same shape every profile component
 * expects: `ProfileTheme.colors.<key>`.
 */

export const ProfileTheme = {
  colors: {
    // Base surfaces
    deepBlack: '#000000',
    surface: '#0A0A0A',
    surfaceElevated: '#1A1A1A',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textTertiary: 'rgba(255, 255, 255, 0.5)',
    textDisabled: 'rgba(255, 255, 255, 0.38)',

    // Borders / dividers
    border: 'rgba(255, 255, 255, 0.12)',
    borderSoft: 'rgba(255, 255, 255, 0.08)',

    // Brand accents (matches the reels/home palette)
    neonGreen: '#32CD32',
    neonBlue: '#00D9FF',
    neonPurple: '#8E54E9',
    neonRed: '#FF3B30',
    gold: '#FFD700',

    // Semantic
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#2196F3',

    // Glass overlays
    glass: 'rgba(255, 255, 255, 0.08)',
    glassMedium: 'rgba(255, 255, 255, 0.12)',
    glassDark: 'rgba(255, 255, 255, 0.04)',
    glassWhite: 'rgba(255, 255, 255, 0.08)',
    glassBlack: 'rgba(0, 0, 0, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.15)',
  },

  gradients: {
    /** Neon-green → blue brand gradient used by action buttons. */
    primary: ['#32CD32', '#00D9FF'] as const,
    /** Subtle top-down dark gradient used on the cover image. */
    cover: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'] as const,
    /** Darker overlay used over the cover when buttons need contrast. */
    darkOverlay: ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.75)'] as const,
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
