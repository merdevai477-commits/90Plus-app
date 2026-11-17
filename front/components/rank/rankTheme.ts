/**
 * Rank tab palette — light matches Figma 1957:131; dark keeps the existing arena look.
 */

import { AUTH_LIGHT } from '../../src/components/auth/AuthTokens';
import { APP_BG } from '../../constants/ui';

export type RankTheme = {
  isDark: boolean;
  screen: string;
  headerTitle: string;
  headerMuted: string;
  searchBg: string;
  searchBorder: string;
  searchIcon: string;
  pillBg: string;
  pillBorder: string;
  coinBg: string;
  coinBorder: string;
  coinText: string;
  cardTint: string;
  cardGlow: [number, number, number];
  cardText: string;
  cardMuted: string;
  cardXpTrack: string;
  cardXpCur: string;
  cardXpMax: string;
  cardBorder: string;
  levelBadge: string;
  blurTint: 'light' | 'dark';
  blurIntensity: number;
  sheen: number;
  strength: number;
  stackCardBg: string;
  stackCardBorder: string;
  stackTitle: string;
  stackSub: string;
  stackCta: string;
  heroTitle: string;
  heroSub1: string;
  heroSub2: string;
  refresh: string;
};

export function getRankTheme(isDark: boolean): RankTheme {
  if (isDark) {
    return {
      isDark: true,
      screen: APP_BG,
      headerTitle: '#FFFFFF',
      headerMuted: 'rgba(255,255,255,0.55)',
      searchBg: 'rgba(168,85,247,0.15)',
      searchBorder: 'rgba(168,85,247,0.35)',
      searchIcon: '#e9d5ff',
      pillBg: 'rgba(255,255,255,0.07)',
      pillBorder: 'rgba(255,255,255,0.1)',
      coinBg: 'rgba(255,255,255,0.07)',
      coinBorder: 'rgba(255,255,255,0.1)',
      coinText: '#fff',
      cardTint: 'rgba(36, 14, 68, 0.22)',
      cardGlow: [0.72, 0.48, 1],
      cardText: '#fff',
      cardMuted: 'rgba(255,255,255,0.55)',
      cardXpTrack: 'rgba(255,255,255,0.14)',
      cardXpCur: '#A855F7',
      cardXpMax: 'rgba(255,255,255,0.55)',
      cardBorder: 'rgba(168,85,247,0.35)',
      levelBadge: '#A855F7',
      blurTint: 'dark',
      blurIntensity: 28,
      sheen: 0.85,
      strength: 0.34,
      stackCardBg: '#12081F',
      stackCardBorder: '#2E1F50',
      stackTitle: '#fff',
      stackSub: '#9E9E9E',
      stackCta: '#8C5CF5',
      heroTitle: '#fff',
      heroSub1: '#d4d4d4',
      heroSub2: '#a49bad',
      refresh: '#A855F7',
    };
  }

  return {
    isDark: false,
    screen: '#FCFCFC',
    headerTitle: AUTH_LIGHT.textPrimary,
    headerMuted: AUTH_LIGHT.textMuted,
    searchBg: '#FFFFFF',
    searchBorder: 'rgba(106,43,217,0.22)',
    searchIcon: AUTH_LIGHT.primary,
    pillBg: '#FFFFFF',
    pillBorder: 'rgba(106,43,217,0.18)',
    coinBg: '#FFFFFF',
    coinBorder: 'rgba(106,43,217,0.18)',
    coinText: AUTH_LIGHT.textPrimary,
    // Soft lavender glass so liquid frost reads on the light page.
    cardTint: 'rgba(246, 242, 253, 0.55)',
    cardGlow: [0.55, 0.3, 0.9],
    cardText: AUTH_LIGHT.textPrimary,
    cardMuted: AUTH_LIGHT.textSecondary,
    cardXpTrack: '#E9D5FF',
    cardXpCur: AUTH_LIGHT.primary,
    cardXpMax: AUTH_LIGHT.textMuted,
    cardBorder: 'rgba(106,43,217,0.16)',
    levelBadge: AUTH_LIGHT.primary,
    blurTint: 'light',
    blurIntensity: 42,
    sheen: 0.55,
    strength: 0.22,
    stackCardBg: '#FFFFFF',
    stackCardBorder: 'rgba(75,31,163,0.1)',
    stackTitle: AUTH_LIGHT.textPrimary,
    stackSub: AUTH_LIGHT.textSecondary,
    stackCta: AUTH_LIGHT.primary,
    heroTitle: AUTH_LIGHT.textPrimary,
    heroSub1: AUTH_LIGHT.textSecondary,
    heroSub2: AUTH_LIGHT.textMuted,
    refresh: AUTH_LIGHT.primary,
  };
}

export const RANK_LIGHT_ELEVATION = {
  card: {
    shadowColor: '#1A0A3C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  soft: {
    shadowColor: '#1A0A3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stack: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
} as const;
