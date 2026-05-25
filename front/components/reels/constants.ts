import {
    PURPLE_PRIMARY,
    PURPLE_SOFT,
} from '../../constants/tokens';

const BRAND_PURPLE = PURPLE_PRIMARY;
const BRAND_PURPLE_LIGHT = PURPLE_SOFT;
const BRAND_PURPLE_DARK = '#5B21B6';

// Reels / video UI — purple brand identity
export const COLORS = {
    brandPurple: BRAND_PURPLE,
    brandPurpleLight: BRAND_PURPLE_LIGHT,
    brandPurpleDark: BRAND_PURPLE_DARK,
    neonGreen: BRAND_PURPLE,
    electricGreen: BRAND_PURPLE_LIGHT,
    darkGreen: BRAND_PURPLE_DARK,
    neonBlue: '#00D9FF',
    neonRed: '#FF3B30',

    // Base Colors
    deepBlack: '#000000',         // Pure black background
    darkGray: '#1A1A1A',          // Secondary background
    mediumGray: '#2A2A2A',        // Card backgrounds

    // Semantic Colors
    primary: BRAND_PURPLE,
    secondary: BRAND_PURPLE_LIGHT,
    accent: '#00D9FF',             // Electric blue (stats)
    error: '#FF3B30',              // Red for errors
    warning: '#FF9500',            // Orange warnings
    success: BRAND_PURPLE,
    info: '#2196F3',               // Info blue

    // UI Colors
    background: '#000000',
    backgroundLight: '#1A1A1A',
    backgroundCard: 'rgba(26, 26, 26, 0.8)',
    white: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.6)',
    glass: 'rgba(255,255,255,0.1)',
    glassBlack: 'rgba(10, 10, 10, 0.95)',

    // Text Colors
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textTertiary: 'rgba(255, 255, 255, 0.5)',

    // Overlay Colors
    overlayDark: 'rgba(0, 0, 0, 0.75)',
    overlayLight: 'rgba(255, 255, 255, 0.1)',

    // Glassmorphism
    glassBorder: 'rgba(255, 255, 255, 0.15)',
    
    // Trophy/Gold Colors
    goldenTrophy: '#FFD700',      // Gold color for trophy
    pureWhite: '#FFFFFF',         // Pure white
};

// Premium Gradients
export const GRADIENTS = {
    brandGlow: [BRAND_PURPLE, BRAND_PURPLE_LIGHT] as const,
    /** @deprecated use brandGlow */
    greenGlow: [BRAND_PURPLE, BRAND_PURPLE_LIGHT] as const,
    darkFade: ['rgba(0, 0, 0, 0.9)', 'transparent'] as const,
    bottomFade: ['transparent', 'rgba(0, 0, 0, 0.95)'] as const,
    cardGradient: ['rgba(124, 58, 237, 0.35)', 'rgba(124, 58, 237, 0.12)'] as const,
};

// Animation Timings
export const ANIMATION = {
    fast: 200,
    normal: 300,
    slow: 500,
    verySlow: 800,
};

// Shadows & Effects
export const EFFECTS = {
    brandGlow: {
        shadowColor: BRAND_PURPLE,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
        elevation: 8,
    },
    /** @deprecated use brandGlow */
    greenGlow: {
        shadowColor: BRAND_PURPLE,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
        elevation: 8,
    },
    softShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    goldGlow: {
        textShadowColor: 'rgba(255, 215, 0, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
};
