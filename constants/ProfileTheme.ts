export const ProfileTheme = {
    colors: {
        deepBlack: '#050505',
        glassBlack: 'rgba(10, 10, 10, 0.8)',
        glassWhite: 'rgba(255, 255, 255, 0.1)',
        neonBlue: '#00f3ff',
        neonPurple: '#bc13fe',
        neonGreen: '#0aff0a',
        gold: '#ffd700',
        textPrimary: '#ffffff',
        textSecondary: '#a0a0a0',
        border: 'rgba(255, 255, 255, 0.15)',
        overlay: 'rgba(0, 0, 0, 0.6)',
    },
    gradients: {
        primary: ['#00f3ff', '#bc13fe'] as const,
        gold: ['#ffd700', '#ffaa00'] as const,
        darkOverlay: ['transparent', 'rgba(0,0,0,0.9)'] as const,
        glass: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] as const,
    },
    shadows: {
        glow: {
            shadowColor: '#00f3ff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 10,
            elevation: 5,
        },
        card: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
    },
    spacing: {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
    },
};
