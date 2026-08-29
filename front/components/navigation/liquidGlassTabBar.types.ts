import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Href } from 'expo-router';

export type LiquidTabId = 'matches' | 'rank' | 'sponsors' | 'reels' | 'ai' | 'profile';

export type LiquidTabIconKind = 'matches' | 'rank' | 'sponsors' | 'reels' | 'ai' | 'profile';

export type LiquidTabIconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export interface LiquidTabItem {
  id: LiquidTabId;
  label: string;
  route: Href;
  accent: string;
  icon: LiquidTabIconKind;
}

/** Tab definition for screens that reuse the liquid-glass bar outside the main routes. */
export interface ConfigurableLiquidTabItem {
  id: string;
  label: string;
  accent: string;
  icon: LiquidTabIconKind | LiquidTabIconComponent;
  /** Pill width when this tab is active; defaults to a label-based estimate. */
  bubbleWidth?: number;
  /** Override default tab icon size (e.g. bolder round icon). */
  iconSize?: number;
}

export interface LiquidGlassTabBarProps {
  /** Zero-based index of the currently active tab. */
  activeIndex: number;
  /** Called when the user selects a tab (tap or drag release). */
  onNavigate: (index: number) => void;
  /**
   * Optional custom tabs. When omitted, the main app `LIQUID_TAB_ITEMS` are used.
   */
  tabs?: ConfigurableLiquidTabItem[];
  /** Optional avatar URL for the Profile tab. Falls back to a default icon. */
  profileAvatarUrl?: string | null;
  /** Safe-area bottom inset used to position the floating bar. */
  bottomInset?: number;
  /** Narrow 2-slot bar (prediction groups, etc.). */
  compact?: boolean;
  /** Prefetch adjacent routes when a tab is pressed. */
  onTabPressIn?: (index: number) => void;
}

export interface LiquidGlassBlobProps {
  tint?: string;
  /** Accent used for the bubble border glow. */
  glowColor?: string;
  elevated?: boolean;
  animatedStyle?: StyleProp<ViewStyle>;
  /** Dynamic specular highlight — shifts with liquid morph velocity. */
  specularStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export interface TabBarLayoutMetrics {
  navWidth: number;
  navHeight: number;
  paddingHorizontal: number;
  bubbleSize: number;
  tabCount: number;
}
