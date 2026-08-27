/**
 * Premium floating Liquid Glass tab bar — pill bubble with icon + label.
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Gift, User, BarChart3, Sparkles } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';
import { useAppFont } from '@/utils/fontSetup';

import { LiquidGlassBlob } from './LiquidGlassBlob';
import {
  BAR_BORDER_COLOR,
  BAR_GLASS_TINT,
  BUBBLE_GLASS_TINT,
  COMPACT_TAB_BAR_HEIGHT,
  ICON_ACTIVE_FALLBACK,
  ICON_INACTIVE,
  LIQUID_TAB_ITEMS,
  TAB_BAR_HEIGHT,
  TAB_BAR_HORIZONTAL_MARGIN,
  TAB_BAR_PADDING_H,
  TAB_ICON_SIZE,
  TAB_LABEL_FONT_SIZE,
  TAB_BUBBLE_WIDTHS,
} from './liquidGlassTabBar.constants';
import type {
  ConfigurableLiquidTabItem,
  LiquidGlassTabBarProps,
  LiquidTabIconComponent,
  LiquidTabIconKind,
} from './liquidGlassTabBar.types';
import { accentToGlassTint, getTabBarLayout, mainAppBubbleWidths, resolveBubbleWidths } from './liquidGlassTabBar.utils';
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

function isIconKind(icon: LiquidTabIconKind | LiquidTabIconComponent): icon is LiquidTabIconKind {
  return typeof icon === 'string';
}

function BuiltInTabIcon({
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
    case 'matches':
      return <PitchIcon color={color} size={size} />;
    case 'rank':
      return <BarChart3 color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
    case 'sponsors':
      return <Gift color={color} size={size} strokeWidth={isActive ? 2.5 : 2} />;
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

function TabIcon({
  icon,
  color,
  size,
  avatarUrl,
  accent,
  isActive,
}: {
  icon: LiquidTabIconKind | LiquidTabIconComponent;
  color: string;
  size: number;
  avatarUrl?: string | null;
  accent: string;
  isActive: boolean;
}) {
  if (!isIconKind(icon)) {
    const Icon = icon;
    return <Icon color={color} size={size} />;
  }

  return (
    <BuiltInTabIcon
      icon={icon}
      color={color}
      size={size}
      avatarUrl={avatarUrl}
      accent={accent}
      isActive={isActive}
    />
  );
}

interface TabSlotProps {
  index: number;
  activeIndex: number;
  highlightIndex: number;
  accent: string;
  icon: LiquidTabIconKind | LiquidTabIconComponent;
  iconSize?: number;
  profileAvatarUrl?: string | null;
  useProfileAvatar: boolean;
  gesture: ReturnType<typeof useLiquidTabBarGesture>['createTabGesture'] extends (
    index: number,
  ) => infer G
    ? G
    : never;
}

const TabSlot = memo(function TabSlot({
  index,
  activeIndex,
  highlightIndex,
  accent,
  icon,
  iconSize,
  profileAvatarUrl,
  useProfileAvatar,
  gesture,
}: TabSlotProps) {
  const isHighlighted = highlightIndex === index;
  const isTransitioning = highlightIndex !== activeIndex;
  const hideIcon =
    isHighlighted || (isTransitioning && activeIndex === index);
  const color = isHighlighted ? accent || ICON_ACTIVE_FALLBACK : ICON_INACTIVE;
  const avatarUrl = useProfileAvatar && isIconKind(icon) && icon === 'profile' ? profileAvatarUrl : undefined;

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
            size={iconSize ?? TAB_ICON_SIZE}
            avatarUrl={avatarUrl}
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
  tabs: tabsProp,
  profileAvatarUrl,
  bottomInset = 16,
  compact = false,
  onTabPressIn,
}: LiquidGlassTabBarProps) {
  const tabItems: ConfigurableLiquidTabItem[] = useMemo(
    () =>
      tabsProp ??
      LIQUID_TAB_ITEMS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        accent: tab.accent,
        icon: tab.icon,
        bubbleWidth: TAB_BUBBLE_WIDTHS[tab.id],
      })),
    [tabsProp],
  );

  const bubbleWidths = useMemo(
    () => (tabsProp ? resolveBubbleWidths(tabItems) : mainAppBubbleWidths()),
    [tabsProp, tabItems],
  );

  const layout = useMemo(
    () => getTabBarLayout(tabItems.length, compact),
    [tabItems.length, compact],
  );

  const barHeight = compact ? COMPACT_TAB_BAR_HEIGHT : TAB_BAR_HEIGHT;

  const [highlightIndex, setHighlightIndex] = useState(activeIndex);
  const pendingIndexRef = useRef<number | null>(null);

  const handleHighlightChange = useCallback((index: number) => {
    pendingIndexRef.current = index;
    setHighlightIndex((prev) => (prev === index ? prev : index));
  }, []);

  const { blobAnimatedStyle, blobSpecularStyle, createTabGesture } = useLiquidTabBarGesture({
    layout,
    activeIndex,
    bubbleWidths,
    onNavigate,
    onHighlightChange: handleHighlightChange,
    onTabPressIn,
  });

  useEffect(() => {
    if (
      pendingIndexRef.current === null ||
      pendingIndexRef.current === activeIndex
    ) {
      pendingIndexRef.current = null;
      setHighlightIndex((prev) => (prev === activeIndex ? prev : activeIndex));
    }
  }, [activeIndex]);

  const activeTab = tabItems[highlightIndex];
  const accent = activeTab?.accent ?? '#FFFFFF';
  const bubbleTint = accentToGlassTint(accent, 0.12);
  const bubbleLabelColor = accent || ICON_ACTIVE_FALLBACK;
  const useMainProfileAvatar = !tabsProp;
  // Explicit Cairo/Inter weight — iOS ignores fontWeight with custom fonts and
  // clips Arabic glyphs when lineHeight is missing in the tight bubble.
  const bubbleLabelFont = useAppFont(600);

  const tabGestures = useMemo(
    () => tabItems.map((_, index) => createTabGesture(index)),
    [createTabGesture, tabItems],
  );

  return (
    <View
      style={[
        s.container,
        compact && s.containerCompact,
        { bottom: Math.max(bottomInset, 16) },
      ]}
      pointerEvents="box-none"
    >
      <View style={s.barGlowShell}>
        <View
          style={[
            s.navWrapper,
            { width: layout.navWidth, height: layout.navHeight, borderRadius: barHeight / 2 },
          ]}
        >
        <View style={[s.barGlassClip, { borderRadius: barHeight / 2 }]} pointerEvents="none">
          <GlassWrapper
            {...(BAR_GLASS_PROPS as object)}
            style={StyleSheet.absoluteFill}
          />
          {!isLiquidGlassSupported && Platform.OS === 'android' ? (
            <View style={s.androidBarTint} />
          ) : null}
          <View style={[s.barRim, { borderRadius: barHeight / 2 }]} />
        </View>

        <LiquidGlassBlob
          tint={bubbleTint || BUBBLE_GLASS_TINT}
          glowColor={accent}
          animatedStyle={blobAnimatedStyle}
          specularStyle={blobSpecularStyle}
          elevated
        >
          {activeTab ? (
            <>
              <TabIcon
                icon={activeTab.icon}
                color={bubbleLabelColor}
                size={activeTab.iconSize ?? TAB_ICON_SIZE}
                avatarUrl={
                  useMainProfileAvatar &&
                  isIconKind(activeTab.icon) &&
                  activeTab.icon === 'profile'
                    ? profileAvatarUrl
                    : undefined
                }
                accent={accent}
                isActive
              />
              <Text
                style={[
                  s.bubbleLabel,
                  { color: bubbleLabelColor, fontFamily: bubbleLabelFont },
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {activeTab.label}
              </Text>
            </>
          ) : null}
        </LiquidGlassBlob>

        <View style={s.navItemsContainer}>
          {tabItems.map((tab, index) => (
            <TabSlot
              key={tab.id}
              index={index}
              activeIndex={activeIndex}
              highlightIndex={highlightIndex}
              accent={tab.accent}
              icon={tab.icon}
              iconSize={tab.iconSize}
              profileAvatarUrl={profileAvatarUrl}
              useProfileAvatar={useMainProfileAvatar}
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
  containerCompact: {
    left: 0,
    right: 0,
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
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  androidBarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  barRim: {
    ...StyleSheet.absoluteFillObject,
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
    lineHeight: TAB_LABEL_FONT_SIZE + 5,
    letterSpacing: 0.15,
    textAlign: 'center',
    includeFontPadding: false,
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
