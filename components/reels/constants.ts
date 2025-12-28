// Modern Sports App Color Palette 🎨
export const COLORS = {
    // Primary Colors (matching app screenshot)
    neonGreen: '#32CD32',         // Primary neon green
    electricGreen: '#39FF14',     // Brighter green for accents
    darkGreen: '#228B22',         // Darker green for gradients
    neonBlue: '#00D9FF',          // Neon Blue
    neonRed: '#FF3B30',           // Neon Red

    // Base Colors
    deepBlack: '#000000',         // Pure black background
    darkGray: '#1A1A1A',          // Secondary background
    mediumGray: '#2A2A2A',        // Card backgrounds

    // Semantic Colors
    primary: '#32CD32',            // Neon green
    secondary: '#39FF14',          // Electric green
    accent: '#00D9FF',             // Electric blue (stats)
    error: '#FF3B30',              // Red for errors
    warning: '#FF9500',            // Orange warnings
    success: '#34C759',            // Success green
    info: '#2196F3',               // Info blue

    // UI Colors
    background: '#000000',
    backgroundLight: '#1A1A1A',
    backgroundCard: 'rgba(26, 26, 26, 0.8)',
    white: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.6)',
    glass: 'rgba(255,255,255,0.1)',

    // Text Colors
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textTertiary: 'rgba(255, 255, 255, 0.5)',

    // Overlay Colors
    overlayDark: 'rgba(0, 0, 0, 0.75)',
    overlayLight: 'rgba(255, 255, 255, 0.1)',

    // Glassmorphism
    glassBorder: 'rgba(255, 255, 255, 0.15)',
};

// Premium Gradients
export const GRADIENTS = {
    greenGlow: ['#32CD32', '#39FF14'] as const,
    darkFade: ['rgba(0, 0, 0, 0.9)', 'transparent'] as const,
    bottomFade: ['transparent', 'rgba(0, 0, 0, 0.95)'] as const,
    cardGradient: ['rgba(50, 205, 50, 0.2)', 'rgba(57, 255, 20, 0.1)'] as const,
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
    greenGlow: {
        shadowColor: '#32CD32',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
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
};
