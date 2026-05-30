import { Colors } from '../../constants/theme';

export const CHAT_ACCENT = '#A855F7';
export const CHAT_ACCENT_SOFT = '#C084FC';
export const CHAT_ACCENT_DEEP = '#7C3AED';
export const SCROLL_NEAR_BOTTOM_THRESHOLD = 120;
export const NUDGE_FLAG_PREFIX = '@chat_fifa_nudge_shown_v1_';
export const CHAT_INPUT_NATIVE_ID = 'chat-input';
export const CHAT_INPUT_MIN_HEIGHT = 52;
export const CHAT_BOTTOM_OFFSET_MARGIN = 8;
export const CHAT_OVERLAY_BOTTOM = 16;
export const CHAT_BANNER_BOTTOM = 24;
export const CHAT_DRAW_DISTANCE = 400;

export const chatColors = {
  accent: CHAT_ACCENT,
  accentSoft: CHAT_ACCENT_SOFT,
  accentDeep: CHAT_ACCENT_DEEP,
  bgBase: Colors.bgBase,
  bgElevated: '#0C0618',
  bgSurface: 'rgba(18,10,32,0.92)',
  bgSurfaceHover: 'rgba(28,16,48,0.95)',
  headerBackdrop: 'rgba(6,2,14,0.88)',
  headerBorder: 'rgba(255,255,255,0.04)',
  iconBg: 'rgba(255,255,255,0.06)',
  iconBorder: 'rgba(255,255,255,0.1)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.42)',
  textFaint: 'rgba(255,255,255,0.28)',
  nudgeTint: 'rgba(124,58,237,0.22)',
  nudgeBorder: 'rgba(167,139,250,0.35)',
  userBubble: ['#9333EA', '#7C3AED'] as const,
  aiGlow: 'rgba(168,85,247,0.35)',
  composerBorder: 'rgba(167,139,250,0.22)',
  composerGlow: 'rgba(124,58,237,0.15)',
};

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
