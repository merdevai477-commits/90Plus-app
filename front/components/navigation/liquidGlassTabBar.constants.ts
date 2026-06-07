import type { LiquidTabItem } from './liquidGlassTabBar.types';

export const TAB_BAR_HEIGHT = 58;
export const TAB_BAR_HORIZONTAL_MARGIN = 24;
export const TAB_BAR_PADDING_H = 8;

/** Compact bubble diameter — ~22% wider than original 54px. */
export const TAB_BUBBLE_WIDTH = 66;
export const TAB_BUBBLE_HEIGHT = 66;
/** @deprecated Use TAB_BUBBLE_WIDTH */
export const TAB_BUBBLE_SIZE = TAB_BUBBLE_WIDTH;

export const TAB_BUBBLE_EXPANDED_WIDTH = {
  matches: 118,
  ai: 86,
} as const;

export const TAB_BUBBLE_EXPAND_HOLD_MS = 1000;

export const BUBBLE_GLASS_TINT = 'rgba(255,255,255,0.10)';
export const BUBBLE_BORDER_COLOR = 'rgba(255,255,255,0.18)';
export const BUBBLE_BORDER_WIDTH = 1;

export const EXPANDABLE_TAB_IDS = new Set<LiquidTabItem['id']>(['matches', 'ai']);

export const TAB_LONG_PRESS_MS = 280;
export const TAB_FLOAT_OFFSET = -18;
export const TAB_ICON_SIZE = 22;

export const TAB_SPRING = {
  damping: 16,
  stiffness: 220,
  mass: 0.85,
} as const;

export const TAB_BLOB_SPAWN_SPRING = {
  damping: 14,
  stiffness: 260,
  mass: 0.75,
} as const;

export const TAB_EXPAND_SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.9,
} as const;

export const LIQUID_TAB_ITEMS: LiquidTabItem[] = [
  {
    id: 'home',
    label: 'Home',
    route: '/(tabs)/Home',
    accent: '#FFFFFF',
    icon: 'home',
  },
  {
    id: 'matches',
    label: 'Matches',
    route: '/(tabs)/matches',
    accent: '#22C55E',
    icon: 'matches',
  },
  {
    id: 'ai',
    label: 'AI',
    route: '/(tabs)/chat',
    accent: '#A855F7',
    icon: 'ai',
  },
  {
    id: 'rankings',
    label: 'Rankings',
    route: '/(tabs)/rank',
    accent: '#F97316',
    icon: 'rankings',
  },
  {
    id: 'profile',
    label: 'Profile',
    route: '/(tabs)/profile',
    accent: '#3B82F6',
    icon: 'profile',
  },
];

export const ICON_INACTIVE = 'rgba(255,255,255,0.5)';
export const ICON_ACTIVE_FALLBACK = '#FFFFFF';
