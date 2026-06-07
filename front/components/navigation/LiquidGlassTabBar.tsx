/**
 * Premium floating Liquid Glass tab bar for Expo Router.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Home, User, BarChart3, Sparkles } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';

import { LiquidGlassBlob } from './LiquidGlassBlob';
import {
  BUBBLE_GLASS_TINT,
  EXPANDABLE_TAB_IDS,
  ICON_ACTIVE_FALLBACK,
  ICON_INACTIVE,
  LIQUID_TAB_ITEMS,
  TAB_BAR_HEIGHT,
  TAB_BAR_HORIZONTAL_MARGIN,
  TAB_BAR_PADDING_H,
  TAB_BUBBLE_EXPAND_HOLD_MS,
  TAB_BUBBLE_EXPANDED_WIDTH,
  TAB_BUBBLE_WIDTH,
  TAB_EXPAND_SPRING,
  TAB_ICON_SIZE,
} from './liquidGlassTabBar.constants';
import type { LiquidGlassTabBarProps, LiquidTabIconKind } from './liquidGlassTabBar.types';
import { getTabBarLayout } from './liquidGlassTabBar.utils';
import { useLiquidTabBarGesture } from './useLiquidTabBarGesture';

const BAR_GLASS_PROPS = isLiquidGlassSupported
  ? {
      effect: 'clear' as const,
      interactive: false,
      tintColor: 'rgba(255,255,255,0.08)',
      colorScheme: 'dark' as const,
    }
  : { intensity: Platform.OS === 'android' ? 85 : 28, tint: 'dark' as const };

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
    case 'ai':
      return <Sparkles color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    case 'rankings':
      return <BarChart3 color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    case 'profile':
      if (avatarUrl) {
        return (
          <View style={[s.avatarRing, isActive && { borderColor: accent, borderWidth: 2 }]}>
            <Image
              source={{ uri: avatarUrl }}
              style={s.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
          </View>
        );
      }
      return <User color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    default:
      return null;
  }
}

const BubbleTabContent = memo(function BubbleTabContent({
  icon,
  label,
  accent,
  labelAnimatedStyle,
}: {
  icon: LiquidTabIconKind;
  label: string;
  accent: string;
  labelAnimatedStyle: AnimatedStyle<import('react-native').ViewStyle>;
}) {
  const iconSize = TAB_ICON_SIZE - 1;

  return (
    <>
      <TabIcon icon={icon} color={accent} size={iconSize} accent={accent} isActive />
      <Animated.View style={[s.bubbleLabelWrap, labelAnimatedStyle]}>
        <Text style={[s.bubbleLabel, { color: accent }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </>
  );
});

interface TabSlotProps {
  isHighlighted: boolean;
  hideIcon: boolean;
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
  hideIcon,
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
        <View style={[s.iconContainer, hideIcon && s.iconHidden]}>
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

function expandedWidthForTab(tabId: (typeof LIQUID_TAB_ITEMS)[number]['id']): number {
  if (tabId === 'matches') return TAB_BUBBLE_EXPANDED_WIDTH.matches;
  if (tabId === 'ai') return TAB_BUBBLE_EXPANDED_WIDTH.ai;
  return TAB_BUBBLE_WIDTH;
}

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
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHighlightChange = useCallback((index: number) => {
    setHighlightIndex(index);
  }, []);

  const {
    blobAnimatedStyle,
    labelAnimatedStyle,
    blobWidth,
    labelOpacity,
    createTabGesture,
  } = useLiquidTabBarGesture({
    layout,
    activeIndex,
    onNavigate,
    onHighlightChange: handleHighlightChange,
    onTabPressIn,
  });

  useEffect(() => {
    setHighlightIndex(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }

    const tab = LIQUID_TAB_ITEMS[activeIndex];
    if (!tab || !EXPANDABLE_TAB_IDS.has(tab.id)) {
      blobWidth.value = withSpring(TAB_BUBBLE_WIDTH, TAB_EXPAND_SPRING);
      labelOpacity.value = withTiming(0, { duration: 180 });
      return;
    }

    const expanded = expandedWidthForTab(tab.id);
    blobWidth.value = withSpring(expanded, TAB_EXPAND_SPRING);
    labelOpacity.value = withTiming(1, { duration: 260 });

    expandTimerRef.current = setTimeout(() => {
      blobWidth.value = withSpring(TAB_BUBBLE_WIDTH, TAB_EXPAND_SPRING);
      labelOpacity.value = withTiming(0, { duration: 320 });
      expandTimerRef.current = null;
    }, TAB_BUBBLE_EXPAND_HOLD_MS);

    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
    };
  }, [activeIndex, blobWidth, labelOpacity]);

  const activeTab = LIQUID_TAB_ITEMS[highlightIndex];
  const showBubbleContent =
    activeTab &&
    EXPANDABLE_TAB_IDS.has(activeTab.id) &&
    highlightIndex === activeIndex;

  const tabGestures = useMemo(
    () => LIQUID_TAB_ITEMS.map((_, index) => createTabGesture(index)),
    [createTabGesture],
  );

  return (
    <View
      style={[s.container, { bottom: Math.max(bottomInset, 16) }]}
      pointerEvents="box-none"
    >
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

        <LiquidGlassBlob tint={BUBBLE_GLASS_TINT} animatedStyle={blobAnimatedStyle} elevated>
          {showBubbleContent && activeTab ? (
            <BubbleTabContent
              icon={activeTab.icon}
              label={activeTab.label}
              accent={activeTab.accent}
              labelAnimatedStyle={labelAnimatedStyle}
            />
          ) : null}
        </LiquidGlassBlob>

        <View style={s.navItemsContainer}>
          {LIQUID_TAB_ITEMS.map((tab, index) => (
            <TabSlot
              key={tab.id}
              isHighlighted={highlightIndex === index}
              hideIcon={
                activeIndex === index &&
                highlightIndex === index &&
                EXPANDABLE_TAB_IDS.has(tab.id)
              }
              accent={tab.accent}
              icon={tab.icon}
              profileAvatarUrl={tab.icon === 'profile' ? profileAvatarUrl : undefined}
              gesture={tabGestures[index]!}
            />
          ))}
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
  navWrapper: {
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'visible',
    backgroundColor: isLiquidGlassSupported ? 'transparent' : 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
    }),
  },
  barGlassClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  androidBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  barRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconHidden: {
    opacity: 0,
  },
  bubbleLabelWrap: {
    marginLeft: 8,
    overflow: 'hidden',
  },
  bubbleLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  avatarRing: {
    width: TAB_ICON_SIZE + 6,
    height: TAB_ICON_SIZE + 6,
    borderRadius: (TAB_ICON_SIZE + 6) / 2,
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
