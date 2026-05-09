/**
 * Phantom Dark — Design System Tokens
 * Single source of truth for all visual values in the native chat app.
 * All components must import from here — no hardcoded values allowed.
 */

import { Platform } from 'react-native';

// ─── Base Colors ──────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  bgBase: '#080608',
  surfaceDark: 'rgba(13,10,20,0.92)',
  surfaceCard: 'rgba(22,16,36,0.98)',
  surfaceGlass: 'rgba(255,255,255,0.07)',
  surfacePanel: 'rgba(13,10,20,0.95)',

  // Purple system
  purplePrimary: '#7C3AED',
  purpleDark: '#5B21B6',
  purpleDeep: 'rgba(76,29,149,0.35)',
  purpleGlow: 'rgba(124,58,237,0.25)',
  purpleSoft: '#A78BFA',
  purpleMuted: 'rgba(167,139,250,0.2)',

  // Bubble backgrounds
  aiBubbleBg: 'rgba(124,58,237,0.18)',
  aiBubbleBgEnd: 'rgba(76,29,149,0.12)',
  aiBubbleBorder: 'rgba(167,139,250,0.2)',
  userBubbleStart: '#7C3AED',
  userBubbleEnd: '#5B21B6',

  // Semantic
  live: '#ef4444',
  gold: '#F5C518',
  goldDark: '#D4A017',
  ratingGold: '#FFD700',
  ratingGreen: '#32CD32',
  ratingTeal: '#11998E',

  // Text
  textPrimary: 'rgba(255,255,255,0.90)',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.25)',
  textDisabled: 'rgba(255,255,255,0.35)',

  // Borders
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.15)',
  borderMedium: 'rgba(255,255,255,0.20)',

  // Status colors
  success: '#10B981',
  successBg: 'rgba(16,185,129,0.25)',
  successBorder: 'rgba(16,185,129,0.5)',
  successGlow: 'rgba(16,185,129,0.6)',

  warning: '#EAB308',
  warningBg: 'rgba(234,179,8,0.25)',
  warningBorder: 'rgba(234,179,8,0.5)',
  warningGlow: 'rgba(234,179,8,0.6)',

  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.25)',
  errorBorder: 'rgba(239,68,68,0.5)',
  errorGlow: 'rgba(239,68,68,0.6)',
  errorDark: '#DC2626',

  info: '#3B82F6',
  infoBg: 'rgba(59,130,246,0.95)',

  // Tab colors
  tabHome: '#f59e0b',
  tabMatches: '#3B82F6',
  tabQuiz: '#3B82F6',
  tabAI: '#a855f7',
  tabReels: '#ef4444',
  tabStats: '#ec4899',

  // Overlay
  overlayDark: 'rgba(0,0,0,0.6)',
  overlayBlur: 'rgba(0,0,0,0.8)',

  // Context menu
  contextMenuBg: 'rgba(15,10,25,0.98)',
  contextMenuBorder: 'rgba(255,255,255,0.2)',

  // Inset highlight (glass surfaces)
  insetHighlight: 'rgba(255,255,255,0.1)',
  insetHighlightSubtle: 'rgba(255,255,255,0.06)',

  // White
  white: '#FFFFFF',
  white90: 'rgba(255,255,255,0.90)',
  white80: 'rgba(255,255,255,0.80)',
  white70: 'rgba(255,255,255,0.70)',
  white60: 'rgba(255,255,255,0.60)',
  white50: 'rgba(255,255,255,0.50)',
  white40: 'rgba(255,255,255,0.40)',
  white30: 'rgba(255,255,255,0.30)',
  white20: 'rgba(255,255,255,0.20)',
  white10: 'rgba(255,255,255,0.10)',
  white08: 'rgba(255,255,255,0.08)',
  white06: 'rgba(255,255,255,0.06)',
  white04: 'rgba(255,255,255,0.04)',
  white03: 'rgba(255,255,255,0.03)',
} as const;

// ─── Gradients ────────────────────────────────────────────────────────────────

export const Gradients = {
  // CTA button
  purpleCTA: ['#7C3AED', '#5B21B6'] as const,

  // AI bubble
  aiBubble: ['rgba(124,58,237,0.18)', 'rgba(76,29,149,0.12)'] as const,

  // User bubble
  userBubble: ['#7C3AED', '#5B21B6'] as const,

  // Ambient glow layers
  ambientTop: ['rgba(76,29,149,0.35)', 'transparent'] as const,
  ambientRight: ['rgba(124,58,237,0.25)', 'transparent'] as const,
  ambientBottomLeft: ['rgba(91,33,182,0.2)', 'transparent'] as const,

  // Vignette
  vignette: ['transparent', 'rgba(0,0,0,0.7)'] as const,

  // Shimmer
  shimmer: ['transparent', 'rgba(255,255,255,0.015)', 'transparent'] as const,

  // Video overlay
  videoOverlay: ['transparent', 'rgba(0,0,0,0.82)'] as const,

  // Pitch
  pitch: ['#165a2f', '#1e7239', '#1e7239', '#165a2f'] as const,

  // Status
  success: ['rgba(16,185,129,0.25)', 'rgba(5,150,105,0.2)'] as const,
  warning: ['rgba(234,179,8,0.25)', 'rgba(202,138,4,0.2)'] as const,
  error: ['rgba(239,68,68,0.25)', 'rgba(220,38,38,0.2)'] as const,

  // Stop button
  stopButton: ['#EF4444', '#DC2626'] as const,

  // Error banner
  errorBanner: ['rgba(239,68,68,0.15)', 'rgba(220,38,38,0.1)'] as const,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 56,
  '7xl': 64,
  '8xl': 80,
  '9xl': 88,
  '10xl': 96,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const Radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,

  // Component-specific
  button: 14,
  buttonRound: 22,
  card: 16,
  chip: 20,
  bubble: 24,
  bubbleTailUser: 8,   // borderBottomLeftRadius for user bubble
  bubbleTailAI: 8,     // borderBottomRightRadius for AI bubble
  input: 9999,         // fully rounded input
  contextMenu: 24,
  toast: 16,
  badge: 9999,
  bottomNav: 28,
  panel: 0,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const FontSize = {
  '2xs': 9,
  xs: 10,
  sm: 11,
  base: 12,
  md: 13,
  'md+': 13.5,
  lg: 14,
  xl: 15,
  '2xl': 16,
  '3xl': 18,
  '4xl': 20,
  '5xl': 24,
  '6xl': 28,
  '7xl': 32,
  '8xl': 36,
  '9xl': 40,
} as const;

export const FontWeight = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
} as const;

export const LineHeight = {
  tight: 16,
  snug: 18,
  normal: 20,
  relaxed: 22,
  loose: 26,
} as const;

export const LetterSpacing = {
  tight: -0.3,
  normal: 0,
  wide: 1.5,
  wider: 2,
  widest: 2.5,
} as const;

// ─── Shadows / Box Shadows ────────────────────────────────────────────────────

export const Shadows = {
  // React Native shadow props (iOS)
  card: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  contextMenu: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 30,
  },
  toast: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  scrollButton: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  errorBanner: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// ─── Animation Durations ──────────────────────────────────────────────────────

export const Duration = {
  instant: 0,
  fast: 150,
  normal: 200,
  medium: 300,
  slow: 400,
  slower: 500,
  shimmer: 2000,
  toast: 2000,
  thinking: 1400,
  thinkingStep: 2000,
  carousel: 350,
  carouselAuto: 5000,
  heartbeat: 2000,
} as const;

// ─── Blur Intensities ─────────────────────────────────────────────────────────

export const BlurIntensity = {
  glass: Platform.OS === 'ios' ? 20 : 50,
  header: Platform.OS === 'ios' ? 40 : 80,
  panel: Platform.OS === 'ios' ? 40 : 80,
  contextMenu: Platform.OS === 'ios' ? 60 : 100,
  overlay: Platform.OS === 'ios' ? 8 : 20,
} as const;

// ─── Layout ───────────────────────────────────────────────────────────────────

export const Layout = {
  headerHeight: 88,
  bottomNavHeight: 56,
  inputBarHeight: 52,
  inputBarPaddingBottom: 32,
  homeIndicatorHeight: 5,
  homeIndicatorWidth: 130,
  maxBubbleWidthAI: '85%' as const,
  maxBubbleWidthUser: '65%' as const,
  sidePanel: 320,
  /** Above composer + tab bar */
  scrollButtonBottom: 190,
} as const;

// ─── Fonts ────────────────────────────────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ─── Quick Chips ──────────────────────────────────────────────────────────────

/** Text-only quick prompts — no emoji */
export const QUICK_CHIPS = [
  { text: 'Football facts' },
  { text: 'League stats' },
  { text: 'Training plan' },
  { text: 'Nutrition tips' },
  { text: 'Recovery tips' },
  { text: 'Strength work' },
] as const;

// ─── WebSocket Config (deprecated — using SSE now) ───────────────────────────
// Kept for backward compatibility, not used by useAIChatNative

export const WS_CONFIG = {
  url: 'ws://localhost:3001',
  heartbeatInterval: 30_000,
  reconnectDelay: 3_000,
  maxReconnectAttempts: 5,
} as const;

export const API_CONFIG = {
  /**
   * Backend URL — loaded from EXPO_PUBLIC_BACKEND_URL env var.
   *
   * Setup in .env:
   *   iOS Simulator:    EXPO_PUBLIC_BACKEND_URL=http://localhost:3001
   *   Android Emulator: EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:3001
   *   Physical Device:  EXPO_PUBLIC_BACKEND_URL=http://<your-local-ip>:3001
   *
   * Fallback: auto-detects Android emulator and uses 10.0.2.2
   */
  baseUrl: process.env.EXPO_PUBLIC_BACKEND_URL
    ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001'),
  userIdKey: 'ai-chat-user-id',
} as const;
