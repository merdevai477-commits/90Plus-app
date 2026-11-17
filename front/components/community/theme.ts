/** Community (المجتمع) design tokens — dark from Figma X50fmaHSieVpdANUHVi3zL; light matches app AUTH/match light identity. */

import { AUTH_LIGHT } from '../../src/components/auth/AuthTokens';

export type CommunityColors = {
  screen: string;
  header: string;
  card: string;
  cardBorder: string;
  contentBox: string;
  composer: string;
  composerBorder: string;
  composerGlow: string;
  input: string;
  inputBorder: string;
  placeholder: string;
  composerHairline: string;
  text: string;
  textStrong: string;
  counter: string;
  muted: string;
  followBtn: string;
  followText: string;
  pollIdle: string;
  pollSelected: string;
  icon: string;
  iconDim: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  like: string;
  divider: string;
  danger: string;
  sheet: string;
  overlay: string;
  headerIcon: string;
  headerPillBg: string;
  headerPillBorder: string;
  headerTitle: string;
  chipBg: string;
  chipBorder: string;
  statusBar: 'light' | 'dark';
};

export const COMMUNITY_THEME: { dark: CommunityColors; light: CommunityColors } = {
  dark: {
    screen: '#090710',
    header: '#0C051A',
    card: '#100d19',
    cardBorder: '#38246B',
    contentBox: '#191326',
    composer: '#0C0620',
    composerBorder: '#1F065A',
    composerGlow: 'rgba(139,92,246,0.25)',
    input: '#130A34',
    inputBorder: '#2A2439',
    placeholder: '#A49BAD',
    composerHairline: '#39246B',
    text: '#E3E3E3',
    textStrong: '#FFFFFF',
    counter: '#a49bad',
    muted: '#a49bad',
    followBtn: '#21153c',
    followText: '#bdb6c3',
    pollIdle: '#241b36',
    pollSelected: 'rgba(94, 63, 190, 0.35)',
    icon: '#CCCCCC',
    iconDim: '#7E7E7E',
    accent: '#8B5CF6',
    accentSoft: '#B79AF8',
    accentDeep: '#513690',
    like: '#B72E24',
    divider: '#262626',
    danger: '#EF4444',
    sheet: '#0E0A18',
    overlay: 'rgba(0,0,0,0.6)',
    headerIcon: '#FFFFFF',
    headerPillBg: 'rgba(255,255,255,0.07)',
    headerPillBorder: 'rgba(255,255,255,0.1)',
    headerTitle: '#FFFFFF',
    chipBg: 'rgba(139,92,246,0.12)',
    chipBorder: 'rgba(139,92,246,0.35)',
    statusBar: 'light',
  },
  light: {
    screen: '#EEEAF6',
    header: '#EEEAF6',
    card: '#FFFFFF',
    cardBorder: 'rgba(75,31,163,0.18)',
    contentBox: '#F5F1FB',
    composer: '#FFFFFF',
    composerBorder: 'rgba(75,31,163,0.2)',
    composerGlow: 'rgba(75,31,163,0.14)',
    input: '#F1ECFA',
    inputBorder: 'rgba(75,31,163,0.2)',
    placeholder: AUTH_LIGHT.textMuted,
    composerHairline: 'rgba(75,31,163,0.16)',
    text: AUTH_LIGHT.textPrimary,
    textStrong: AUTH_LIGHT.textPrimary,
    counter: AUTH_LIGHT.textMuted,
    muted: AUTH_LIGHT.textSecondary,
    followBtn: 'rgba(106,43,217,0.1)',
    followText: AUTH_LIGHT.primary,
    pollIdle: '#F1ECFA',
    pollSelected: 'rgba(106,43,217,0.16)',
    icon: AUTH_LIGHT.textSecondary,
    iconDim: AUTH_LIGHT.textMuted,
    accent: AUTH_LIGHT.primary,
    accentSoft: '#7C3AED',
    accentDeep: AUTH_LIGHT.primaryDark,
    like: '#B72E24',
    divider: 'rgba(75,31,163,0.14)',
    danger: '#EF4444',
    sheet: '#FFFFFF',
    overlay: 'rgba(36,16,78,0.35)',
    headerIcon: AUTH_LIGHT.textPrimary,
    headerPillBg: '#FFFFFF',
    headerPillBorder: 'rgba(75,31,163,0.2)',
    headerTitle: AUTH_LIGHT.textPrimary,
    chipBg: 'rgba(106,43,217,0.08)',
    chipBorder: 'rgba(75,31,163,0.24)',
    statusBar: 'dark',
  },
};

/** Soft layered elevation for light feed surfaces — keeps dark mode flat. */
export const COMMUNITY_LIGHT_ELEVATION = {
  card: {
    shadowColor: '#2A1060',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  soft: {
    shadowColor: '#2A1060',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

/** Default dark tokens — prefer `useCommunityTheme().colors` for light/dark. */
export const C = COMMUNITY_THEME.dark;

export const POST_IMAGE_HEIGHT = 216;
export const POST_IMAGE_RADIUS = 16;
export const CARD_RADIUS = 17;
export const AVATAR_SIZE = 42;
export const COMMENT_AVATAR_SIZE = 36;

export const CI = {
  overflow: require('../../assets/community/overflow-menu.svg'),
  verified: require('../../assets/community/verified.svg'),
  earth: require('../../assets/community/earth.svg'),
  share: require('../../assets/community/share.svg'),
  comment: require('../../assets/community/comment.svg'),
  heartFilled: require('../../assets/community/heart-filled.svg'),
  heartOutlined: require('../../assets/community/heart-outlined.svg'),
  commentHeartOutlined: require('../../assets/community/comment-heart-outlined.svg'),
  back: require('../../assets/community/arrow-back.svg'),
  plus: require('../../assets/community/plus.svg'),
  smile: require('../../assets/community/smile.svg'),
  divider: require('../../assets/community/divider.svg'),
  image: require('../../assets/community/image.svg'),
  notification: require('../../assets/community/notification.svg'),
  composerPlus: require('../../assets/community/composer-plus.svg'),
  composerSmile: require('../../assets/community/composer-smile.svg'),
  composerPoll: require('../../assets/community/composer-poll.svg'),
} as const;
