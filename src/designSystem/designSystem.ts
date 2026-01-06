/**
 * Material Design 3 Design System
 * Comprehensive design tokens for consistent UI/UX
 */

import { Platform, StyleSheet } from 'react-native';

// ============================================================================
// COLOR SYSTEM - Material Design 3 with Dark Mode Support
// ============================================================================

export const Colors = {
  // Primary Colors
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#32CD32', // Main primary (neon green)
    600: '#22c55e',
    700: '#16a34a',
    800: '#15803d',
    900: '#166534',
  },
  
  // Secondary Colors
  secondary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#00D9FF', // Neon blue
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  
  // Surface Colors (Dark Mode)
  surface: {
    dim: '#000000',
    default: '#0A0A0A',
    bright: '#1A1A1A',
    container: '#2A2A2A',
    containerHigh: '#3A3A3A',
    containerHighest: '#4A4A4A',
  },
  
  // Background Colors
  background: {
    default: '#000000',
    secondary: '#0A0A0A',
    tertiary: '#1A1A1A',
    card: 'rgba(26, 26, 26, 0.8)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayDark: 'rgba(0, 0, 0, 0.75)',
    overlayLight: 'rgba(255, 255, 255, 0.1)',
  },
  
  // Semantic Colors
  error: {
    light: '#FF6B6B',
    default: '#FF3B30',
    dark: '#D32F2F',
  },
  warning: {
    light: '#FFB84D',
    default: '#FF9500',
    dark: '#F57C00',
  },
  success: {
    light: '#66BB6A',
    default: '#34C759',
    dark: '#2E7D32',
  },
  info: {
    light: '#64B5F6',
    default: '#2196F3',
    dark: '#1976D2',
  },
  
  // Text Colors (Semantic)
  onSurface: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    disabled: 'rgba(255, 255, 255, 0.38)',
  },
  
  onPrimary: '#000000',
  onSecondary: '#000000',
  onError: '#FFFFFF',
  onWarning: '#000000',
  onSuccess: '#FFFFFF',
  onInfo: '#FFFFFF',
  
  // Glassmorphism
  glass: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    dark: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.15)',
    black: 'rgba(10, 10, 10, 0.95)',
  },
  
  // Legacy support (for gradual migration)
  neonGreen: '#32CD32',
  electricGreen: '#39FF14',
  neonBlue: '#00D9FF',
  neonRed: '#FF3B30',
  deepBlack: '#000000',
  darkGray: '#1A1A1A',
  mediumGray: '#2A2A2A',
  white: '#FFFFFF',
} as const;

// ============================================================================
// TYPOGRAPHY SYSTEM - Material Design 3
// ============================================================================

export const Typography = {
  // Display (largest)
  display: {
    large: {
      fontSize: 57,
      lineHeight: 64,
      fontWeight: '400' as const,
      letterSpacing: -0.25,
    },
    medium: {
      fontSize: 45,
      lineHeight: 52,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    small: {
      fontSize: 36,
      lineHeight: 44,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
  },
  
  // Headline
  headline: {
    large: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    medium: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    small: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
  },
  
  // Title
  title: {
    large: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '500' as const,
      letterSpacing: 0,
    },
    medium: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500' as const,
      letterSpacing: 0.15,
    },
    small: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500' as const,
      letterSpacing: 0.1,
    },
  },
  
  // Body
  body: {
    large: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400' as const,
      letterSpacing: 0.5,
    },
    medium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
      letterSpacing: 0.25,
    },
    small: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400' as const,
      letterSpacing: 0.4,
    },
  },
  
  // Label
  label: {
    large: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500' as const,
      letterSpacing: 0.1,
    },
    medium: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,
      letterSpacing: 0.5,
    },
    small: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '500' as const,
      letterSpacing: 0.5,
    },
  },
} as const;

// Font weights
export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

// ============================================================================
// SPACING SYSTEM - 8px Grid
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// ============================================================================
// BORDER RADIUS SYSTEM
// ============================================================================

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  round: 9999,
} as const;

// ============================================================================
// ELEVATION SYSTEM - Material Design 3
// ============================================================================

export const Elevation = {
  0: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  4: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  6: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  8: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 6.27,
    elevation: 8,
  },
  12: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 8.46,
    elevation: 12,
  },
  16: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 10.32,
    elevation: 16,
  },
  24: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.45,
    shadowRadius: 12.46,
    elevation: 24,
  },
} as const;

// Special effects
export const Effects = {
  greenGlow: {
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  softShadow: Elevation[4],
  cardShadow: Elevation[6],
  modalShadow: Elevation[12],
} as const;

// ============================================================================
// ANIMATION SYSTEM - React Native Reanimated
// ============================================================================

export const Animation = {
  // Durations (ms)
  duration: {
    short: 150,
    standard: 300,
    long: 500,
    extraLong: 800,
  },
  
  // Easing curves (cubic-bezier)
  easing: {
    standard: { x1: 0.4, y1: 0.0, x2: 0.2, y2: 1.0 }, // Material standard
    decelerate: { x1: 0.0, y1: 0.0, x2: 0.2, y2: 1.0 }, // Material decelerate
    accelerate: { x1: 0.4, y1: 0.0, x2: 1.0, y2: 1.0 }, // Material accelerate
    sharp: { x1: 0.4, y1: 0.0, x2: 0.6, y2: 1.0 }, // Material sharp
  },
  
  // Spring configs
  spring: {
    gentle: {
      damping: 20,
      stiffness: 100,
      mass: 1,
    },
    standard: {
      damping: 15,
      stiffness: 150,
      mass: 1,
    },
    bouncy: {
      damping: 10,
      stiffness: 200,
      mass: 1,
    },
  },
} as const;

// ============================================================================
// GRADIENTS
// ============================================================================

export const Gradients = {
  primary: [Colors.primary[500], Colors.primary[600]] as const,
  secondary: [Colors.secondary[500], Colors.secondary[600]] as const,
  greenGlow: [Colors.neonGreen, Colors.electricGreen] as const,
  darkFade: ['rgba(0, 0, 0, 0.9)', 'transparent'] as const,
  bottomFade: ['transparent', 'rgba(0, 0, 0, 0.95)'] as const,
  cardGradient: ['rgba(50, 205, 50, 0.2)', 'rgba(57, 255, 20, 0.1)'] as const,
  glass: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] as const,
  overlay: ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)'] as const,
} as const;

// ============================================================================
// OPACITY VALUES
// ============================================================================

export const Opacity = {
  disabled: 0.38,
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
  overlay: 0.6,
  glass: {
    light: 0.1,
    medium: 0.15,
    dark: 0.05,
  },
} as const;

// ============================================================================
// TOUCH TARGETS (Accessibility)
// ============================================================================

export const TouchTargets = {
  minimum: 44, // iOS/Android minimum
  comfortable: 48,
  large: 56,
} as const;

// ============================================================================
// BORDER WIDTHS
// ============================================================================

export const BorderWidth = {
  thin: 0.5,
  default: 1,
  medium: 1.5,
  thick: 2,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get elevation style by level
 */
export const getElevation = (level: keyof typeof Elevation) => Elevation[level];

/**
 * Get typography style
 */
export const getTypography = (
  variant: 'display' | 'headline' | 'title' | 'body' | 'label',
  size: 'large' | 'medium' | 'small'
) => Typography[variant][size];

/**
 * Create text shadow for text on complex backgrounds
 */
export const createTextShadow = (color: string = 'rgba(0,0,0,0.5)') => ({
  textShadowColor: color,
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
});

/**
 * Create glassmorphism style
 */
export const createGlassStyle = (intensity: 'light' | 'medium' | 'dark' = 'medium') => ({
  backgroundColor: Colors.glass[intensity],
  borderWidth: BorderWidth.default,
  borderColor: Colors.glass.border,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ColorToken = typeof Colors;
export type TypographyToken = typeof Typography;
export type SpacingToken = typeof Spacing;
export type ElevationToken = typeof Elevation;
export type AnimationToken = typeof Animation;

