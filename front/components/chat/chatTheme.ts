import { AUTH_LIGHT } from '../../src/components/auth/AuthTokens';
import { Colors } from '../../constants/theme';

export const CHAT_ACCENT = '#A855F7';
export const CHAT_ACCENT_SOFT = '#C084FC';
export const CHAT_ACCENT_DEEP = '#7C3AED';
export const SCROLL_NEAR_BOTTOM_THRESHOLD = 120;
export const NUDGE_FLAG_PREFIX = '@chat_fifa_nudge_shown_v1_';
export const CHAT_INPUT_NATIVE_ID = 'chat-input';
export const CHAT_INPUT_MIN_HEIGHT = 52;
export const CHAT_OVERLAY_BOTTOM = 16;
export const CHAT_BANNER_BOTTOM = 24;

export type ChatColors = {
  accent: string;
  accentSoft: string;
  accentDeep: string;
  pageBg: string;
  bgBase: string;
  bgElevated: string;
  bgSurface: string;
  bgSurfaceHover: string;
  rimButtonCore: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  textInverse: string;
  nudgeTint: string;
  nudgeBorder: string;
  nudgeDismissBg: string;
  userBubble: readonly [string, string];
  aiBubbleBg: string;
  aiBubbleBorder: string;
  aiGlow: string;
  composerBarTint: string;
  composerFieldTint: string;
  composerInputTint: string;
  composerBorder: string;
  composerGlow: string;
  composerPlaceholder: string;
  composerIconBtnBg: string;
  composerIconBtnBorder: string;
  chipTint: string;
  glassTint: string;
  typingPillTint: string;
  sheetBg: string;
  sheetOverlay: string;
  historySearchBg: string;
  historySearchBorder: string;
  historyRowBg: string;
  historyRowActiveBg: string;
  historyRowBorder: string;
  historyRowActiveBorder: string;
  codeBlockBg: string;
  codeBlockBorder: string;
  tableBg: string;
  tableBorder: string;
  tableHeadBg: string;
  tableRowAlt: string;
  tableFade: string;
  divider: string;
  icon: string;
  iconMuted: string;
  statusBar: 'light' | 'dark';
  blurTint: 'light' | 'dark';
  elevate: 'dark' | 'light' | 'none';
  bgGradient: readonly [string, string, string];
  glowStop: string;
  glowMid: string;
  glowFade: string;
  glowOpacity: number;
};

export const CHAT_THEME: { dark: ChatColors; light: ChatColors } = {
  dark: {
    accent: CHAT_ACCENT,
    accentSoft: CHAT_ACCENT_SOFT,
    accentDeep: CHAT_ACCENT_DEEP,
    pageBg: '#08070F',
    bgBase: Colors.bgBase,
    bgElevated: '#0C0618',
    bgSurface: 'rgba(18,10,32,0.92)',
    bgSurfaceHover: 'rgba(28,16,48,0.95)',
    rimButtonCore: 'rgba(3,2,8,0.94)',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.72)',
    textMuted: 'rgba(255,255,255,0.42)',
    textFaint: 'rgba(255,255,255,0.28)',
    textInverse: '#FFFFFF',
    nudgeTint: 'rgba(124,58,237,0.22)',
    nudgeBorder: 'rgba(167,139,250,0.35)',
    nudgeDismissBg: 'rgba(255,255,255,0.06)',
    userBubble: ['#9333EA', '#7C3AED'] as const,
    aiBubbleBg: 'rgba(3,2,8,0.94)',
    aiBubbleBorder: 'rgba(167,139,250,0.28)',
    aiGlow: 'rgba(168,85,247,0.35)',
    composerBarTint: 'rgba(20,12,40,0.42)',
    composerFieldTint: 'rgba(3,2,8,0.94)',
    composerInputTint: 'rgba(8,6,18,0.88)',
    composerBorder: 'rgba(167,139,250,0.22)',
    composerGlow: 'rgba(124,58,237,0.15)',
    composerPlaceholder: 'rgba(235,228,255,0.45)',
    composerIconBtnBg: 'rgba(255,255,255,0.07)',
    composerIconBtnBorder: 'rgba(210,190,255,0.3)',
    chipTint: 'rgba(3,2,8,0.9)',
    glassTint: 'rgba(14,10,22,0.72)',
    typingPillTint: 'rgba(3,2,8,0.92)',
    sheetBg: '#08070F',
    sheetOverlay: 'rgba(0,0,0,0.6)',
    historySearchBg: 'rgba(255,255,255,0.03)',
    historySearchBorder: 'rgba(163,221,249,0.14)',
    historyRowBg: 'rgba(255,255,255,0.025)',
    historyRowActiveBg: 'rgba(163,221,249,0.08)',
    historyRowBorder: 'rgba(255,255,255,0.06)',
    historyRowActiveBorder: 'rgba(163,221,249,0.18)',
    codeBlockBg: 'rgba(0,0,0,0.55)',
    codeBlockBorder: 'rgba(255,255,255,0.08)',
    tableBg: 'rgba(10,6,20,0.9)',
    tableBorder: 'rgba(167,139,250,0.35)',
    tableHeadBg: 'rgba(124,58,237,0.38)',
    tableRowAlt: 'rgba(124,58,237,0.10)',
    tableFade: 'rgba(8,4,16,0.92)',
    divider: 'rgba(255,255,255,0.1)',
    icon: '#FFFFFF',
    iconMuted: 'rgba(255,255,255,0.4)',
    statusBar: 'light',
    blurTint: 'dark',
    elevate: 'dark',
    bgGradient: ['#0D0A1A', '#08070F', '#060509'] as const,
    glowStop: '#6F24FB',
    glowMid: '#4A16B0',
    glowFade: '#1B0C33',
    glowOpacity: 0.2,
  },
  light: {
    accent: AUTH_LIGHT.primary,
    accentSoft: '#7C3AED',
    accentDeep: AUTH_LIGHT.primaryDark,
    pageBg: '#EEEAF6',
    bgBase: '#EEEAF6',
    bgElevated: '#FFFFFF',
    bgSurface: 'rgba(255,255,255,0.92)',
    bgSurfaceHover: 'rgba(245,241,251,0.98)',
    rimButtonCore: '#FFFFFF',
    textPrimary: AUTH_LIGHT.textPrimary,
    textSecondary: AUTH_LIGHT.textSecondary,
    textMuted: AUTH_LIGHT.textMuted,
    textFaint: 'rgba(36,16,78,0.35)',
    textInverse: '#FFFFFF',
    nudgeTint: 'rgba(106,43,217,0.1)',
    nudgeBorder: 'rgba(75,31,163,0.22)',
    nudgeDismissBg: 'rgba(75,31,163,0.08)',
    userBubble: ['#6A2BD9', '#4B1FA3'] as const,
    aiBubbleBg: 'rgba(255,255,255,0.94)',
    aiBubbleBorder: 'rgba(75,31,163,0.18)',
    aiGlow: 'rgba(106,43,217,0.18)',
    composerBarTint: 'rgba(252,252,252,0.72)',
    composerFieldTint: 'rgba(75,31,163,0.92)',
    composerInputTint: 'rgba(255,255,255,0.88)',
    composerBorder: 'rgba(75,31,163,0.2)',
    composerGlow: 'rgba(75,31,163,0.14)',
    composerPlaceholder: AUTH_LIGHT.textMuted,
    composerIconBtnBg: 'rgba(106,43,217,0.08)',
    composerIconBtnBorder: 'rgba(75,31,163,0.2)',
    chipTint: 'rgba(255,255,255,0.88)',
    glassTint: 'rgba(252,252,252,0.78)',
    typingPillTint: 'rgba(255,255,255,0.9)',
    sheetBg: '#FFFFFF',
    sheetOverlay: 'rgba(36,16,78,0.35)',
    historySearchBg: 'rgba(106,43,217,0.06)',
    historySearchBorder: 'rgba(75,31,163,0.18)',
    historyRowBg: 'rgba(106,43,217,0.04)',
    historyRowActiveBg: 'rgba(106,43,217,0.12)',
    historyRowBorder: 'rgba(75,31,163,0.12)',
    historyRowActiveBorder: 'rgba(75,31,163,0.28)',
    codeBlockBg: 'rgba(75,31,163,0.06)',
    codeBlockBorder: 'rgba(75,31,163,0.16)',
    tableBg: '#F8F5FC',
    tableBorder: 'rgba(75,31,163,0.22)',
    tableHeadBg: 'rgba(106,43,217,0.14)',
    tableRowAlt: 'rgba(106,43,217,0.06)',
    tableFade: 'rgba(238,234,246,0.96)',
    divider: 'rgba(75,31,163,0.14)',
    icon: AUTH_LIGHT.textPrimary,
    iconMuted: AUTH_LIGHT.textSecondary,
    statusBar: 'dark',
    blurTint: 'light',
    elevate: 'light',
    bgGradient: ['#F4F1FA', '#EEEAF6', '#E8E2F4'] as const,
    glowStop: '#6A2BD9',
    glowMid: '#8B5CF6',
    glowFade: '#EEEAF6',
    glowOpacity: 0.12,
  },
};

/** @deprecated Prefer `useChatTheme().colors` — kept as dark default for legacy imports. */
export const chatColors = CHAT_THEME.dark;

export const chatRadii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const chatSpacing = {
  screenHorizontal: 20,
  listHorizontal: 16,
  listTop: 12,
  listBottom: 16,
  listGap: 8,
  welcomeHorizontal: 24,
  welcomeTop: 24,
  welcomeBottom: 32,
  messageVertical: 10,
};

export const chatTypography = {
  welcomeTitle: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.6 },
  welcomeSubtitle: { fontSize: 17, fontWeight: '500' as const, letterSpacing: -0.2 },
  headerTitle: { fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.4 },
  chipTitle: { fontSize: 14, fontWeight: '600' as const },
  chipSubtitle: { fontSize: 12, fontWeight: '400' as const },
};
