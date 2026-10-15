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
    darkFade: ['rgba(5, 1, 13, 0.78)', 'rgba(5, 1, 13, 0.22)', 'transparent'] as const,
    bottomFade: ['transparent', 'rgba(5, 1, 13, 0.42)', 'rgba(5, 1, 13, 0.88)'] as const,
    heroAccent: ['rgba(124, 58, 237, 0.18)', 'rgba(124, 58, 237, 0.06)', 'transparent'] as const,
    cardGradient: ['rgba(124, 58, 237, 0.32)', 'rgba(59, 130, 246, 0.12)'] as const,
    glassCard: ['rgba(255, 255, 255, 0.12)', 'rgba(14, 8, 28, 0.55)'] as const,
    actionIdle: ['rgba(18, 10, 36, 0.55)', 'rgba(10, 5, 22, 0.38)'] as const,
    actionActive: ['rgba(124, 58, 237, 0.72)', 'rgba(91, 33, 182, 0.48)'] as const,
    /** Bio / caption panel — lighter so video stays visible */
    bioPanel: ['rgba(12, 6, 26, 0.52)', 'rgba(18, 10, 36, 0.28)'] as const,
    /** Hashtag chip fills */
    hashtagA: ['rgba(124, 58, 237, 0.55)', 'rgba(91, 33, 182, 0.28)'] as const,
    hashtagB: ['rgba(139, 92, 246, 0.42)', 'rgba(59, 130, 246, 0.18)'] as const,
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
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 6,
    },
    /** @deprecated use brandGlow */
    greenGlow: {
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 6,
    },
    softShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 3,
    },
    /** Compact action rail buttons */
    actionShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 4,
    },
    goldGlow: {
        textShadowColor: 'rgba(245, 197, 24, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
};

/** Clearance above the floating glass tab bar */
export const REELS_TAB_CLEARANCE = 82;

/** Action rail sizing — keep full stack above tab bar */
export const ACTION_BTN = 44;
export const ACTION_GAP = 10;
