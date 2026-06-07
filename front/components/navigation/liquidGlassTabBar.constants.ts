import type { LiquidTabItem } from './liquidGlassTabBar.types';

export const TAB_BAR_HEIGHT = 58;
export const TAB_BAR_HORIZONTAL_MARGIN = 12;
export const TAB_BAR_PADDING_H = 4;

/** Pill capsule — icon + label like `( Home )` */
export const TAB_BUBBLE_HEIGHT = 42;
/** @deprecated Use per-tab TAB_BUBBLE_WIDTHS */
export const TAB_BUBBLE_WIDTH = 76;
/** @deprecated Use TAB_BUBBLE_WIDTH */
export const TAB_BUBBLE_SIZE = TAB_BUBBLE_WIDTH;

export const TAB_BUBBLE_WIDTHS: Record<LiquidTabItem['id'], number> = {
  home: 76,
  matches: 94,
  rank: 68,
  reels: 74,
  ai: 58,
  profile: 88,
};

export const BUBBLE_GLASS_TINT = 'rgba(255,255,255,0.04)';
export const BAR_GLASS_TINT = 'rgba(255,255,255,0.03)';
export const BUBBLE_BORDER_COLOR = 'rgba(255,255,255,0.22)';
export const BAR_BORDER_COLOR = 'rgba(255,255,255,0.20)';
export const BUBBLE_BORDER_WIDTH = 1;
export const TAB_BUBBLE_VERTICAL_OFFSET = 2;

export const TAB_LONG_PRESS_MS = 280;
export const TAB_FLOAT_OFFSET = -12;
export const TAB_ICON_SIZE = 20;
export const TAB_LABEL_FONT_SIZE = 11;

export const TAB_SPRING = {
  damping: 20,
  stiffness: 280,
  mass: 0.75,
} as const;

export const TAB_BLOB_SPAWN_SPRING = {
  damping: 14,
  stiffness: 260,
  mass: 0.75,
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
    id: 'rank',
    label: 'Rank',
    route: '/(tabs)/rank',
    accent: '#F97316',
    icon: 'rank',
  },
  {
    id: 'reels',
    label: 'Reels',
    route: '/(tabs)/reels',
    accent: '#EC4899',
    icon: 'reels',
  },
  {
    id: 'ai',
    label: 'AI',
    route: '/(tabs)/chat',
    accent: '#A855F7',
    icon: 'ai',
  },
  {
    id: 'profile',
    label: 'Profile',
    route: '/(tabs)/profile',
    accent: '#3B82F6',
    icon: 'profile',
  },
];

/** Width per tab index — worklet-safe lookup during drag. */
export const TAB_BUBBLE_WIDTH_BY_INDEX = LIQUID_TAB_ITEMS.map(
  (tab) => TAB_BUBBLE_WIDTHS[tab.id],
);

export const ICON_INACTIVE = 'rgba(255,255,255,0.5)';
export const ICON_ACTIVE_FALLBACK = '#FFFFFF';
