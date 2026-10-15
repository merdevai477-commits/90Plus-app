import {
    BG_BASE,
    BG_MID,
    BG_SURFACE,
    BLUE_ELECTRIC,
    BLUE_PRIMARY,
    GLASS_BORDER_TOP,
    GLASS_CARD,
    GOLD_PRIMARY,
    LIVE_RED,
    PURPLE_DARK,
    PURPLE_GLOW,
    PURPLE_PRIMARY,
    PURPLE_SOFT,
    TEXT_MUTED,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
} from '../../constants/tokens';

// Reels / video UI — aligned with 90Plus brand tokens
export const COLORS = {
    brandPurple: PURPLE_PRIMARY,
    brandPurpleLight: PURPLE_SOFT,
    brandPurpleDark: PURPLE_DARK,
    neonGreen: PURPLE_PRIMARY,
    electricGreen: PURPLE_SOFT,
    darkGreen: PURPLE_DARK,
    neonBlue: BLUE_ELECTRIC,
    neonRed: LIVE_RED,

    // Base
    deepBlack: BG_BASE,
    darkGray: BG_MID,
    mediumGray: BG_SURFACE,

    // Semantic
    primary: PURPLE_PRIMARY,
    secondary: PURPLE_SOFT,
    accent: BLUE_ELECTRIC,
    error: LIVE_RED,
    warning: '#FF9500',
    success: PURPLE_PRIMARY,
    info: BLUE_PRIMARY,
    gold: GOLD_PRIMARY,

    // UI
    background: BG_BASE,
    backgroundLight: BG_MID,
    backgroundCard: 'rgba(14, 8, 28, 0.88)',
    white: '#FFFFFF',
    overlay: 'rgba(5, 1, 13, 0.62)',
    glass: GLASS_CARD,
    glassBlack: 'rgba(10, 5, 20, 0.92)',

    // Text
    textPrimary: TEXT_PRIMARY,
    textSecondary: TEXT_SECONDARY,
    textTertiary: TEXT_MUTED,

    // Overlay / glass
    overlayDark: 'rgba(5, 1, 13, 0.78)',
    overlayLight: 'rgba(255, 255, 255, 0.08)',
    glassBorder: GLASS_BORDER_TOP,
    purpleGlow: PURPLE_GLOW,

    // Trophy / gold
    goldenTrophy: GOLD_PRIMARY,
    pureWhite: '#FFFFFF',
};

export const GRADIENTS = {
    brandGlow: [PURPLE_PRIMARY, PURPLE_DARK] as const,
    /** @deprecated use brandGlow */
    greenGlow: [PURPLE_PRIMARY, PURPLE_DARK] as const,
    darkFade: ['rgba(5, 1, 13, 0.92)', 'rgba(5, 1, 13, 0.35)', 'transparent'] as const,
    bottomFade: ['transparent', 'rgba(5, 1, 13, 0.55)', 'rgba(5, 1, 13, 0.96)'] as const,
    heroAccent: ['rgba(236, 72, 153, 0.22)', 'rgba(124, 58, 237, 0.12)', 'transparent'] as const,
    cardGradient: ['rgba(124, 58, 237, 0.32)', 'rgba(59, 130, 246, 0.12)'] as const,
    glassCard: ['rgba(255, 255, 255, 0.14)', 'rgba(124, 58, 237, 0.08)'] as const,
    actionIdle: ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.06)'] as const,
    actionActive: ['rgba(124, 58, 237, 0.45)', 'rgba(91, 33, 182, 0.28)'] as const,
    /** Bio / caption panel */
    bioPanel: ['rgba(14, 8, 28, 0.82)', 'rgba(20, 12, 40, 0.55)'] as const,
    /** Hashtag chip fills */
    hashtagA: ['rgba(124, 58, 237, 0.42)', 'rgba(59, 130, 246, 0.18)'] as const,
    hashtagB: ['rgba(168, 85, 247, 0.32)', 'rgba(96, 165, 250, 0.16)'] as const,
};

export const ANIMATION = {
    fast: 200,
    normal: 300,
    slow: 500,
    verySlow: 800,
};

export const EFFECTS = {
    brandGlow: {
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 14,
        elevation: 8,
    },
    /** @deprecated use brandGlow */
    greenGlow: {
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 14,
        elevation: 8,
    },
    softShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
    },
    goldGlow: {
        textShadowColor: 'rgba(245, 197, 24, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
};

/** Clearance above the floating glass tab bar */
export const REELS_TAB_CLEARANCE = 78;
