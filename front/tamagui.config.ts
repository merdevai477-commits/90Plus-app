import { config as defaultConfig } from '@tamagui/config/v3'
import { createAnimations } from '@tamagui/animations-react-native'
import { createTamagui } from 'tamagui'

// ============================================================================
// 90Plus Design Tokens — Based on existing designSystem.ts
// ============================================================================

const tokens = {
  // Colors — Dark luxury sports theme
  color: {
    // Primary (Neon Green)
    primary50: '#f0fdf4',
    primary100: '#dcfce7',
    primary200: '#bbf7d0',
    primary300: '#86efac',
    primary400: '#4ade80',
    primary500: '#32CD32', // Main
    primary600: '#22c55e',
    primary700: '#16a34a',
    primary800: '#15803d',
    primary900: '#166534',

    // Secondary (Neon Blue)
    secondary50: '#f0f9ff',
    secondary100: '#e0f2fe',
    secondary200: '#bae6fd',
    secondary300: '#7dd3fc',
    secondary400: '#38bdf8',
    secondary500: '#00D9FF',
    secondary600: '#0284c7',
    secondary700: '#0369a1',
    secondary800: '#075985',
    secondary900: '#0c4a6e',

    // Accent colors for sections
    orange: '#FF7A3D',
    orangeDark: '#fc4d00',
    teal: '#11998E',
    tealLight: '#38ef7d',
    purple: '#8E54E9',
    purpleDark: '#6b21a8',
    pink: '#F5576C',
    pinkLight: '#f093fb',

    // Surface (Dark)
    surfaceDim: '#000000',
    surface: '#0A0A0A',
    surfaceBright: '#1A1A1A',
    surfaceContainer: '#2A2A2A',
    surfaceHigh: '#3A3A3A',
    surfaceHighest: '#4A4A4A',

    // Background
    background: '#000000',
    backgroundSecondary: '#0A0A0A',
    backgroundTertiary: '#1A1A1A',

    // Glass
    glass: 'rgba(255,255,255,0.08)',
    glassMedium: 'rgba(255,255,255,0.12)',
    glassDark: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.12)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.7)',
    textTertiary: 'rgba(255,255,255,0.5)',
    textDisabled: 'rgba(255,255,255,0.38)',

    // Semantic
    error: '#FF3B30',
    errorLight: '#FF6B6B',
    errorDark: '#D32F2F',
    warning: '#FF9500',
    warningLight: '#FFB84D',
    warningDark: '#F57C00',
    success: '#34C759',
    successLight: '#66BB6A',
    successDark: '#2E7D32',
    info: '#2196F3',
    infoLight: '#64B5F6',
    infoDark: '#1976D2',
  },

  // Spacing — 8px grid
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96,
    true: 16, // default
  },

  // Sizes (for width/height)
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44, // minimum touch target
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    28: 112,
    32: 128,
    36: 144,
    40: 160,
    44: 176,
    48: 192,
    56: 224,
    64: 256,
    true: 44, // default touch target
  },

  // Border radius
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 999, // pill/round
    true: 12, // default
  },

  // Z-index
  zIndex: {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    10: 10,
    20: 20,
    50: 50,
    100: 100,
  },
}

// ============================================================================
// Themes — Dark mode with accent variations
// ============================================================================

const themes = {
  dark: {
    background: tokens.color.background,
    backgroundHover: tokens.color.backgroundSecondary,
    backgroundPress: tokens.color.backgroundTertiary,
    backgroundFocus: tokens.color.backgroundSecondary,
    backgroundStrong: tokens.color.surfaceBright,
    backgroundTransparent: 'transparent',
    
    color: tokens.color.textPrimary,
    colorHover: tokens.color.textPrimary,
    colorPress: tokens.color.textSecondary,
    colorFocus: tokens.color.textPrimary,
    colorTransparent: 'transparent',
    
    borderColor: tokens.color.glassBorder,
    borderColorHover: tokens.color.glassMedium,
    borderColorFocus: tokens.color.primary500,
    borderColorPress: tokens.color.glassMedium,
    
    placeholderColor: tokens.color.textTertiary,
    
    // Shadows
    shadowColor: '#000000',
    shadowColorHover: '#000000',
    shadowColorPress: '#000000',
    shadowColorFocus: '#000000',
  },
  
  // Accent theme variations
  dark_green: {
    background: tokens.color.background,
    color: tokens.color.textPrimary,
    borderColor: tokens.color.primary500,
    colorFocus: tokens.color.primary500,
    backgroundFocus: 'rgba(50, 205, 50, 0.1)',
  },
  
  dark_orange: {
    background: tokens.color.background,
    color: tokens.color.textPrimary,
    borderColor: tokens.color.orange,
    colorFocus: tokens.color.orange,
    backgroundFocus: 'rgba(255, 122, 61, 0.1)',
  },
  
  dark_purple: {
    background: tokens.color.background,
    color: tokens.color.textPrimary,
    borderColor: tokens.color.purple,
    colorFocus: tokens.color.purple,
    backgroundFocus: 'rgba(142, 84, 233, 0.1)',
  },
  
  dark_pink: {
    background: tokens.color.background,
    color: tokens.color.textPrimary,
    borderColor: tokens.color.pink,
    colorFocus: tokens.color.pink,
    backgroundFocus: 'rgba(245, 87, 108, 0.1)',
  },
}

// ============================================================================
// Media Queries — Responsive breakpoints
// ============================================================================

const media = {
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1420 },
  xxl: { maxWidth: 1600 },
  gtXs: { minWidth: 660 + 1 },
  gtSm: { minWidth: 800 + 1 },
  gtMd: { minWidth: 1020 + 1 },
  gtLg: { minWidth: 1280 + 1 },
  short: { maxHeight: 820 },
  tall: { minHeight: 820 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
}

// ============================================================================
// Animations — React Native Reanimated config
// ============================================================================

const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  tooltip: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  // Tamagui requires a `default` animation as the fallback for any transition
  // that doesn't specify an animation name explicitly.
  default: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
})

// ============================================================================
// Shorthands — Convenient prop aliases
// ============================================================================

const shorthands = {
  px: 'paddingHorizontal',
  py: 'paddingVertical',
  mx: 'marginHorizontal',
  my: 'marginVertical',
  bg: 'backgroundColor',
  br: 'borderRadius',
  bw: 'borderWidth',
  bc: 'borderColor',
  w: 'width',
  h: 'height',
  f: 'flex',
  ai: 'alignItems',
  jc: 'justifyContent',
  fd: 'flexDirection',
  fw: 'flexWrap',
  gap: 'gap',
} as const

// ============================================================================
// Create Tamagui Config
// ============================================================================

const config = createTamagui({
  ...defaultConfig,
  tokens,
  themes,
  media,
  animations,
  shorthands,
  settings: {
    allowedStyleValues: 'somewhat-strict',
    autocompleteSpecificTokens: 'except-special',
  },
})

export type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
