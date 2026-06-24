import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Href } from 'expo-router';

export type LiquidTabId = 'home' | 'matches' | 'rank' | 'reels' | 'ai' | 'profile';

export type LiquidTabIconKind = 'home' | 'matches' | 'rank' | 'reels' | 'ai' | 'profile';

export interface LiquidTabItem {
  id: LiquidTabId;
  label: string;
  route: Href;
  accent: string;
  icon: LiquidTabIconKind;
}

export interface LiquidGlassTabBarProps {
  /** Zero-based index of the currently active tab. */
  activeIndex: number;
  /** Called when the user selects a tab (tap or drag release). */
  onNavigate: (index: number) => void;
  /** Optional avatar URL for the Profile tab. Falls back to a default icon. */
  profileAvatarUrl?: string | null;
  /** Optional pre-translated tab items (defaults to i18n labels). */
  tabItems?: LiquidTabItem[];
  /** Safe-area bottom inset used to position the floating bar. */
  bottomInset?: number;
  /** Prefetch adjacent routes when a tab is pressed. */
  onTabPressIn?: (index: number) => void;
}

export interface LiquidGlassBlobProps {
  tint?: string;
  /** Accent used for the bubble border glow. */
  glowColor?: string;
  elevated?: boolean;
  animatedStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export interface TabBarLayoutMetrics {
  navWidth: number;
  navHeight: number;
  paddingHorizontal: number;
  bubbleSize: number;
  tabCount: number;
}
