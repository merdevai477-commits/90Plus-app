import { Dimensions } from 'react-native';

import {
  TAB_BAR_HORIZONTAL_MARGIN,
  TAB_BAR_HEIGHT,
  TAB_BAR_PADDING_H,
  TAB_BUBBLE_WIDTH,
} from './liquidGlassTabBar.constants';
import type { TabBarLayoutMetrics } from './liquidGlassTabBar.types';

export function getTabBarLayout(tabCount: number): TabBarLayoutMetrics {
  const screenWidth = Dimensions.get('window').width;
  return {
    navWidth: screenWidth - TAB_BAR_HORIZONTAL_MARGIN * 2,
    navHeight: TAB_BAR_HEIGHT,
    paddingHorizontal: TAB_BAR_PADDING_H,
    bubbleSize: TAB_BUBBLE_WIDTH,
    tabCount,
  };
}

export function tabWidthForLayout(layout: TabBarLayoutMetrics): number {
  'worklet';
  return (layout.navWidth - layout.paddingHorizontal * 2) / layout.tabCount;
}

/** Left edge of the bubble for a given tab index (inside the bar). */
export function bubbleLeftForIndex(index: number, layout: TabBarLayoutMetrics): number {
  'worklet';
  const tabWidth = tabWidthForLayout(layout);
  return (
    layout.paddingHorizontal +
    index * tabWidth +
    (tabWidth - layout.bubbleSize) / 2
  );
}

/** Horizontal center of a tab slot. */
export function tabCenterX(index: number, layout: TabBarLayoutMetrics): number {
  'worklet';
  const tabWidth = tabWidthForLayout(layout);
  return layout.paddingHorizontal + index * tabWidth + tabWidth / 2;
}

export function clampBubbleLeft(
  left: number,
  layout: TabBarLayoutMetrics,
): number {
  'worklet';
  const min = bubbleLeftForIndex(0, layout);
  const max = bubbleLeftForIndex(layout.tabCount - 1, layout);
  return Math.min(Math.max(left, min), max);
}

/** Nearest tab index from bubble left position. */
export function indexFromBubbleLeft(
  left: number,
  layout: TabBarLayoutMetrics,
): number {
  'worklet';
  const tabWidth = tabWidthForLayout(layout);
  const centerX = left + layout.bubbleSize / 2;
  const raw = (centerX - layout.paddingHorizontal - tabWidth / 2) / tabWidth;
  return Math.min(layout.tabCount - 1, Math.max(0, Math.round(raw)));
}

/** Nearest tab index from a horizontal touch position inside the bar. */
export function indexFromTouchX(x: number, layout: TabBarLayoutMetrics): number {
  const tabWidth = tabWidthForLayout(layout);
  const raw = (x - layout.paddingHorizontal) / tabWidth;
  return Math.min(
    layout.tabCount - 1,
    Math.max(0, Math.floor(raw + 0.5)),
  );
}

/** Soft glass tint derived from tab accent color. */
export function accentToGlassTint(accent: string, alpha = 0.2): string {
  const hex = accent.replace('#', '');
  if (hex.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(255,255,255,${alpha})`;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}
