/**
 * Premium floating Liquid Glass tab bar — pill bubble with icon + label.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Home, User, BarChart3, Sparkles, Clapperboard } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';

import { LiquidGlassBlob } from './LiquidGlassBlob';
import {
  BAR_BORDER_COLOR,
  BAR_GLASS_TINT,
  BUBBLE_GLASS_TINT,
  ICON_ACTIVE_FALLBACK,
  ICON_INACTIVE,
  LIQUID_TAB_ITEMS,
  TAB_BAR_HEIGHT,
  TAB_BAR_HORIZONTAL_MARGIN,
  TAB_BAR_PADDING_H,
  TAB_ICON_SIZE,
  TAB_LABEL_FONT_SIZE,
} from './liquidGlassTabBar.constants';
import type { LiquidGlassTabBarProps, LiquidTabIconKind } from './liquidGlassTabBar.types';
import { accentToGlassTint, getTabBarLayout } from './liquidGlassTabBar.utils';
import { useLiquidTabBarGesture } from './useLiquidTabBarGesture';

const BAR_GLASS_PROPS = isLiquidGlassSupported
  ? {
      effect: 'clear' as const,
      interactive: false,
      tintColor: BAR_GLASS_TINT,
      colorScheme: 'dark' as const,
    }
  : { intensity: Platform.OS === 'android' ? 28 : 18, tint: 'dark' as const };

const GlassWrapper = isLiquidGlassSupported ? LiquidGlassView : BlurView;

const PitchIcon = memo(function PitchIcon({
  color,
  size,
}: {
  color: string;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
      <Line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1.5" />
      <Circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.5" />
      <Rect x="2" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
      <Rect x="18" y="7" width="4" height="10" fill="none" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
});

function TabIcon({
  icon,
  color,
  size,
  avatarUrl,
  accent,
  isActive,
}: {
  icon: LiquidTabIconKind;
  color: string;
  size: number;
  avatarUrl?: string | null;
  accent: string;
  isActive: boolean;
}) {
  switch (icon) {
    case 'home':
      return <Home color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    case 'matches':
      return <PitchIcon color={color} size={size} />;
    case 'rank':
      return <BarChart3 color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    case 'reels':
      return <Clapperboard color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    case 'ai':
      return <Sparkles color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    case 'profile':
      if (avatarUrl) {
        return (
          <View style={[s.avatarRing, isActive && { borderColor: accent, borderWidth: 2 }]}>
            <Image
              source={{ uri: avatarUrl }}
              style={s.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
        );
      }
      return <User color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    default:
      return null;
  }
}

interface TabSlotProps {
  isHighlighted: boolean;
  accent: string;
  icon: LiquidTabIconKind;
  profileAvatarUrl?: string | null;
  gesture: ReturnType<typeof useLiquidTabBarGesture>['createTabGesture'] extends (
    index: number,
  ) => infer G
    ? G
    : never;
}

const TabSlot = memo(function TabSlot({
  isHighlighted,
  accent,
  icon,
  profileAvatarUrl,
  gesture,
}: TabSlotProps) {
  const color = isHighlighted ? accent || ICON_ACTIVE_FALLBACK : ICON_INACTIVE;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={s.navItem}
        accessibilityRole="button"
        accessibilityState={{ selected: isHighlighted }}
      >
        <View style={[s.iconContainer, isHighlighted && s.iconHidden]}>
          <TabIcon
            icon={icon}
            color={color}
            size={TAB_ICON_SIZE}
            avatarUrl={profileAvatarUrl}
            accent={accent}
            isActive={isHighlighted}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

export const LiquidGlassTabBar = memo(function LiquidGlassTabBar({
  activeIndex,
  onNavigate,
  profileAvatarUrl,
  bottomInset = 16,
  onTabPressIn,
}: LiquidGlassTabBarProps) {
  const layout = useMemo(
    () => getTabBarLayout(LIQUID_TAB_ITEMS.length),
    [],
  );

  const [highlightIndex, setHighlightIndex] = useState(activeIndex);

  const handleHighlightChange = useCallback((index: number) => {
    setHighlightIndex(index);
  }, []);

  const { blobAnimatedStyle, createTabGesture } = useLiquidTabBarGesture({
    layout,
    activeIndex,
    onNavigate,
    onHighlightChange: handleHighlightChange,
    onTabPressIn,
  });

  useEffect(() => {
    setHighlightIndex(activeIndex);
  }, [activeIndex]);

  const activeTab = LIQUID_TAB_ITEMS[highlightIndex];
  const accent = activeTab?.accent ?? '#FFFFFF';
  const bubbleTint = accentToGlassTint(accent, 0.12);
  const bubbleLabelColor = accent || ICON_ACTIVE_FALLBACK;

  const tabGestures = useMemo(
    () => LIQUID_TAB_ITEMS.map((_, index) => createTabGesture(index)),
    [createTabGesture],
  );

  return (
    <View
      style={[s.container, { bottom: Math.max(bottomInset, 16) }]}
      pointerEvents="box-none"
    >
      <View style={s.barGlowShell}>
        <View style={[s.navWrapper, { width: layout.navWidth, height: layout.navHeight }]}>
        <View style={s.barGlassClip} pointerEvents="none">
          <GlassWrapper
            {...(BAR_GLASS_PROPS as object)}
            style={StyleSheet.absoluteFill}
          />
          {!isLiquidGlassSupported && Platform.OS === 'android' ? (
            <View style={s.androidBarTint} />
          ) : null}
          <View style={s.barRim} />
        </View>

        <LiquidGlassBlob
          tint={bubbleTint || BUBBLE_GLASS_TINT}
          glowColor={accent}
          animatedStyle={blobAnimatedStyle}
          elevated
        >
          {activeTab ? (
            <>
              <TabIcon
                icon={activeTab.icon}
                color={bubbleLabelColor}
                size={TAB_ICON_SIZE}
                avatarUrl={activeTab.icon === 'profile' ? profileAvatarUrl : undefined}
                accent={accent}
                isActive
              />
              <Text
                style={[s.bubbleLabel, { color: bubbleLabelColor }]}
                numberOfLines={1}
              >
                {activeTab.label}
              </Text>
            </>
          ) : null}
        </LiquidGlassBlob>

        <View style={s.navItemsContainer}>
          {LIQUID_TAB_ITEMS.map((tab, index) => (
            <TabSlot
              key={tab.id}
              isHighlighted={highlightIndex === index}
              accent={tab.accent}
              icon={tab.icon}
              profileAvatarUrl={tab.icon === 'profile' ? profileAvatarUrl : undefined}
              gesture={tabGestures[index]!}
            />
          ))}
        </View>
        </View>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: TAB_BAR_HORIZONTAL_MARGIN,
    right: TAB_BAR_HORIZONTAL_MARGIN,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 100,
  },
  barGlowShell: Platform.select({
    ios: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
    },
    android: {},
    default: {},
  }),
  navWrapper: {
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'visible',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BAR_BORDER_COLOR,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  barGlassClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  androidBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  barRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  navItemsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: TAB_BAR_PADDING_H,
    zIndex: 20,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconHidden: {
    opacity: 0,
  },
  bubbleLabel: {
    fontSize: TAB_LABEL_FONT_SIZE,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  avatarRing: {
    width: TAB_ICON_SIZE + 4,
    height: TAB_ICON_SIZE + 4,
    borderRadius: (TAB_ICON_SIZE + 4) / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});

export { LIQUID_TAB_ITEMS };
