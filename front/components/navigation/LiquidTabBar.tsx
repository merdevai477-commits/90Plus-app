/**
 * LiquidTabBar — a VisionOS-style liquid-glass tab bar (no Skia, so no native
 * rebuild needed). A frosted glass capsule slides behind the active tab with a
 * springy "liquid stretch", the active icon scales up + brightens by proximity,
 * the active label fades in, and a long-press splits the label into two copies
 * that drift apart and fade.
 *
 * All animation runs on the UI thread via Reanimated worklets — no legacy
 * Animated API. RTL-aware: the capsule travel direction mirrors when RTL.
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { I18nManager, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

import { PG, usePGFonts } from '../predictionGroups/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiquidTabIcon = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export interface LiquidTab {
  key: string;
  label: string;
  icon: LiquidTabIcon;
}

export interface LiquidTabBarProps {
  tabs: LiquidTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  /** Optional: fired when a tab is long-pressed (after the split animation). */
  onLongPressTab?: (key: string) => void;
  /** Safe-area bottom inset so the bar floats above the home indicator. */
  bottomInset?: number;
  /** Override RTL detection (defaults to I18nManager.isRTL). */
  isRTL?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MARGIN = 16;
const BAR_H = 70;
const BAR_RADIUS = 40;
const CAPSULE_MARGIN = 6; // inset of the capsule inside a tab slot
const CAPSULE_H = BAR_H - 14;

const CAPSULE_SPRING = { damping: 12, stiffness: 90 } as const;

/** Total vertical space the bar occupies — screens reserve this at the bottom. */
export const LIQUID_TAB_BAR_HEIGHT = BAR_H;

// ─── Single tab ─────────────────────────────────────────────────────────────

interface TabItemProps {
  item: LiquidTab;
  visualIndex: number;
  tabWidth: number;
  pos: SharedValue<number>;
  onTabChange: (key: string) => void;
  onLongPressTab?: (key: string) => void;
  fontMedium: string;
  fontBold: string;
}

function TabItem({
  item,
  visualIndex,
  tabWidth,
  pos,
  onTabChange,
  onLongPressTab,
  fontMedium,
  fontBold,
}: TabItemProps) {
  // 1 when the capsule is centered on this tab, 0 when a full slot away.
  const proximity = useDerivedValue(() => {
    if (tabWidth <= 0) return 0;
    const dist = Math.abs(visualIndex * tabWidth - pos.value);
    return Math.max(0, 1 - dist / tabWidth);
  });

  const iconScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + proximity.value * 0.15 }],
  }));
  const whiteIconStyle = useAnimatedStyle(() => ({ opacity: proximity.value }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: proximity.value,
    transform: [{ translateY: (1 - proximity.value) * 4 }],
  }));

  // Long-press label split.
  const splitActive = useSharedValue(0);
  const splitAnim = useSharedValue(0);

  const splitUpStyle = useAnimatedStyle(() => ({
    opacity: splitActive.value * (1 - splitAnim.value),
    transform: [{ translateY: -10 * splitAnim.value }],
  }));
  const splitDownStyle = useAnimatedStyle(() => ({
    opacity: splitActive.value * (1 - splitAnim.value),
    transform: [{ translateY: 10 * splitAnim.value }],
  }));

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(onTabChange)(item.key);
  });

  const longPress = Gesture.LongPress()
    .minDuration(280)
    .onStart(() => {
      splitActive.value = 1;
      splitAnim.value = 0;
      splitAnim.value = withTiming(1, { duration: 400 }, (finished) => {
        if (finished) splitActive.value = 0;
      });
    })
    .onEnd((_e, success) => {
      if (success && onLongPressTab) runOnJS(onLongPressTab)(item.key);
    });

  const gesture = Gesture.Exclusive(longPress, tap);
  const Icon = item.icon;

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.slot} accessibilityRole="button" accessibilityLabel={item.label}>
        <Animated.View style={[styles.iconWrap, iconScaleStyle]}>
          <Icon size={22} color={PG.textMuted} strokeWidth={2} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, whiteIconStyle]}>
            <Icon size={22} color="#FFFFFF" strokeWidth={2.4} />
          </Animated.View>
        </Animated.View>

        <Animated.Text
          style={[styles.label, { fontFamily: fontBold }, labelStyle]}
          numberOfLines={1}
        >
          {item.label}
        </Animated.Text>

        {/* Long-press split copies */}
        <Animated.Text
          style={[styles.splitLabel, { fontFamily: fontMedium }, splitUpStyle]}
          pointerEvents="none"
          numberOfLines={1}
        >
          {item.label}
        </Animated.Text>
        <Animated.Text
          style={[styles.splitLabel, { fontFamily: fontMedium }, splitDownStyle]}
          pointerEvents="none"
          numberOfLines={1}
        >
          {item.label}
        </Animated.Text>
      </View>
    </GestureDetector>
  );
}

// ─── Bar ──────────────────────────────────────────────────────────────────────

export function LiquidTabBar({
  tabs,
  activeTab,
  onTabChange,
  onLongPressTab,
  bottomInset = 0,
  isRTL = I18nManager.isRTL,
}: LiquidTabBarProps) {
  const { medium, bold } = usePGFonts();
  const [barW, setBarW] = useState(0);

  const count = tabs.length;
  const tabWidth = count > 0 ? barW / count : 0;

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeTab));
  const visualActive = isRTL ? count - 1 - activeIndex : activeIndex;

  const pos = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      pos.value = withSpring(visualActive * tabWidth, CAPSULE_SPRING);
    }
  }, [visualActive, tabWidth, pos]);

  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value + CAPSULE_MARGIN }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomInset + 8 }]}>
      <View style={styles.bar} onLayout={onLayout}>
        {/* Sliding glass capsule (behind the icons) */}
        {tabWidth > 0 && (
          <Animated.View
            style={[styles.capsule, { width: tabWidth - CAPSULE_MARGIN * 2 }, capsuleStyle]}
            pointerEvents="none"
          >
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.04)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.capsuleBorder} />
          </Animated.View>
        )}

        {/* Tab row */}
        <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {tabs.map((t, i) => (
            <TabItem
              key={t.key}
              item={t}
              visualIndex={isRTL ? count - 1 - i : i}
              tabWidth={tabWidth}
              pos={pos}
              onTabChange={onTabChange}
              onLongPressTab={onLongPressTab}
              fontMedium={medium}
              fontBold={bold}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: MARGIN,
    right: MARGIN,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 100,
  },
  bar: {
    width: '100%',
    height: BAR_H,
    borderRadius: BAR_RADIUS,
    backgroundColor: '#0B0B0F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
  },
  capsule: {
    position: 'absolute',
    left: 0,
    top: (BAR_H - CAPSULE_H) / 2,
    height: CAPSULE_H,
    borderRadius: CAPSULE_H / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 0,
  },
  capsuleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CAPSULE_H / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  row: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    zIndex: 1,
  },
  slot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: {
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  splitLabel: {
    position: 'absolute',
    bottom: 10,
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
