/**
 * Notifications inbox palette — mirrors community light identity so the feed
 * and notifications feel like one product surface.
 */

import { StyleSheet } from 'react-native';
import { COMMUNITY_THEME } from '../community/theme';
import {
  BG_BASE,
  GRADIENT_BG_COLORS,
  GRADIENT_BG_LOCATIONS,
  GOLD_PRIMARY,
  BLUE_PRIMARY,
  PURPLE_SOFT,
  PURPLE_PRIMARY,
  TEXT_MUTED,
} from '../../constants/tokens';

export type NotificationsTheme = {
  isDark: boolean;
  screen: string;
  headerBg: string;
  headerGradient: readonly [string, string];
  card: string;
  cardBorder: string;
  cardUnread: string;
  cardUnreadBorder: string;
  text: string;
  textSecondary: string;
  muted: string;
  accent: string;
  accentSoft: string;
  backBtnBg: string;
  backBtnBorder: string;
  markAllBg: string;
  markAllBorder: string;
  hairline: string;
  skelBg: string;
  skelFill: string;
  emptyIconBg: string;
  emptyIconBorder: string;
  emptyTitle: string;
  retryBg: string;
  retryBorder: string;
  refreshBg: string;
  bgGradient: readonly [string, string, string, string];
  bgLocations: readonly [number, number, number, number];
  systemIcon: string;
  elevationCard: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  } | null;
  elevationSoft: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  } | null;
  statusBar: 'light' | 'dark';
};

export function getNotificationsTheme(isDark: boolean): NotificationsTheme {
  const c = isDark ? COMMUNITY_THEME.dark : COMMUNITY_THEME.light;
  if (isDark) {
    return {
      isDark: true,
      screen: BG_BASE,
      headerBg: 'rgba(8,5,16,0.97)',
      headerGradient: ['rgba(124,58,237,0.22)', 'rgba(10,6,18,0.96)'],
      card: 'rgba(16,12,28,0.94)',
      cardBorder: 'rgba(255,255,255,0.1)',
      cardUnread: 'rgba(42,24,72,0.92)',
      cardUnreadBorder: 'rgba(139,92,246,0.45)',
      text: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.75)',
      muted: TEXT_MUTED,
      accent: PURPLE_PRIMARY,
      accentSoft: PURPLE_SOFT,
      backBtnBg: 'rgba(255,255,255,0.06)',
      backBtnBorder: 'rgba(255,255,255,0.1)',
      markAllBg: 'rgba(124,58,237,0.18)',
      markAllBorder: 'rgba(167,139,250,0.35)',
      hairline: 'rgba(255,255,255,0.08)',
      skelBg: 'rgba(16,12,26,0.6)',
      skelFill: 'rgba(255,255,255,0.08)',
      emptyIconBg: 'rgba(124,58,237,0.12)',
      emptyIconBorder: 'rgba(124,58,237,0.3)',
      emptyTitle: 'rgba(167,139,250,0.8)',
      retryBg: 'rgba(124,58,237,0.12)',
      retryBorder: 'rgba(167,139,250,0.3)',
      refreshBg: BG_BASE,
      bgGradient: GRADIENT_BG_COLORS,
      bgLocations: GRADIENT_BG_LOCATIONS,
      systemIcon: TEXT_MUTED,
      elevationCard: null,
      elevationSoft: null,
      statusBar: 'light',
    };
  }

  /** Crisp card lift — tighter than community feed so rows don't look like a glow. */
  const cardElevation = {
    shadowColor: '#1A0A3C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  } as const;
  const softElevation = {
    shadowColor: '#1A0A3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  } as const;

  return {
    isDark: false,
    // Cool grey-lavender page so pure white cards separate cleanly.
    screen: '#E9E4F4',
    headerBg: '#E9E4F4',
    headerGradient: ['rgba(106,43,217,0.06)', '#E9E4F4'],
    card: '#FFFFFF',
    cardBorder: 'rgba(75,31,163,0.16)',
    // Unread stays white — only border + dot mark state (no muddy purple wash).
    cardUnread: '#FFFFFF',
    cardUnreadBorder: 'rgba(106,43,217,0.38)',
    text: c.textStrong,
    textSecondary: c.muted,
    muted: c.muted,
    accent: c.accent,
    accentSoft: c.accentSoft,
    backBtnBg: '#FFFFFF',
    backBtnBorder: 'rgba(75,31,163,0.2)',
    markAllBg: '#FFFFFF',
    markAllBorder: 'rgba(106,43,217,0.28)',
    hairline: 'rgba(75,31,163,0.14)',
    skelBg: '#FFFFFF',
    skelFill: 'rgba(75,31,163,0.1)',
    emptyIconBg: '#FFFFFF',
    emptyIconBorder: 'rgba(75,31,163,0.2)',
    emptyTitle: c.accentDeep,
    retryBg: '#FFFFFF',
    retryBorder: 'rgba(75,31,163,0.2)',
    refreshBg: '#E9E4F4',
    bgGradient: ['#E9E4F4', '#E9E4F4', '#EDE8F7', '#E9E4F4'],
    bgLocations: GRADIENT_BG_LOCATIONS,
    systemIcon: c.muted,
    elevationCard: cardElevation,
    elevationSoft: softElevation,
    statusBar: 'dark',
  };
}

/** Kind icon chip tints — separate dark/light so chips stay readable on both surfaces. */
export const KIND_TINTS = {
  match: { color: GOLD_PRIMARY, dark: 'rgba(245,197,24,0.16)', light: 'rgba(245,197,24,0.16)' },
  quiz: { color: PURPLE_SOFT, dark: 'rgba(167,139,250,0.16)', light: 'rgba(106,43,217,0.12)' },
  social: { color: BLUE_PRIMARY, dark: 'rgba(59,130,246,0.16)', light: 'rgba(59,130,246,0.12)' },
  system: { colorDark: TEXT_MUTED, colorLight: '#6B7280', dark: 'rgba(255,255,255,0.08)', light: 'rgba(75,31,163,0.08)' },
  like: { color: '#ef4444', dark: 'rgba(239,68,68,0.16)', light: 'rgba(239,68,68,0.12)' },
  comment: { color: BLUE_PRIMARY, dark: 'rgba(59,130,246,0.16)', light: 'rgba(59,130,246,0.12)' },
  mention: { color: PURPLE_SOFT, dark: 'rgba(167,139,250,0.16)', light: 'rgba(106,43,217,0.12)' },
  moderation: { color: '#fcd34d', dark: 'rgba(252,211,77,0.14)', light: 'rgba(245,197,24,0.16)' },
  report: { color: '#fb923c', dark: 'rgba(251,146,60,0.16)', light: 'rgba(251,146,60,0.14)' },
  avatar: { color: BLUE_PRIMARY, dark: 'rgba(59,130,246,0.16)', light: 'rgba(59,130,246,0.12)' },
  ai: { color: PURPLE_PRIMARY, dark: 'rgba(124,58,237,0.16)', light: 'rgba(106,43,217,0.12)' },
  leaderboard: { color: GOLD_PRIMARY, dark: 'rgba(245,197,24,0.16)', light: 'rgba(245,197,24,0.16)' },
  levelup: { color: '#22c55e', dark: 'rgba(34,197,94,0.16)', light: 'rgba(34,197,94,0.12)' },
  video: { color: PURPLE_SOFT, dark: 'rgba(167,139,250,0.16)', light: 'rgba(106,43,217,0.12)' },
  gift: { color: '#ec4899', dark: 'rgba(236,72,153,0.16)', light: 'rgba(236,72,153,0.12)' },
  lucky: { color: GOLD_PRIMARY, dark: 'rgba(245,197,24,0.16)', light: 'rgba(245,197,24,0.16)' },
} as const;

export function kindVisual(
  kind: keyof typeof KIND_TINTS,
  isDark: boolean,
): { color: string; tint: string } {
  const meta = KIND_TINTS[kind];
  if (kind === 'system') {
    const s = meta as typeof KIND_TINTS.system;
    return {
      color: isDark ? s.colorDark : s.colorLight,
      tint: isDark ? s.dark : s.light,
    };
  }
  const m = meta as { color: string; dark: string; light: string };
  return { color: m.color, tint: isDark ? m.dark : m.light };
}

export const notifHairline = StyleSheet.hairlineWidth;
