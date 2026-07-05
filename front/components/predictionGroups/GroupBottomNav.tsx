/**
 * GroupBottomNav — floating liquid-glass bottom navigation for the prediction
 * group screens (الجروب / الجولة / الترتيب).
 *
 * The active item is lifted into a glass "bubble" that springs to its slot on
 * the UI thread (Reanimated). The bubble reuses the app's liquid-glass stack
 * (LiquidGlassView on iOS 26+, BlurView + gradient fallback elsewhere). The bar
 * itself is painted with the app's own dark purple surface color. Fully
 * RTL-aware: slot order and bubble position mirror when `isRTL`.
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, Trophy, Users } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { isLiquidGlassSupported, LiquidGlassView } from '@/utils/liquidGlassSafe';

import { PG, usePGFonts } from './theme';

export type GroupNavKey = 'group' | 'round' | 'standings';

type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface NavItem {
  key: GroupNavKey;
  label: string;
  Icon: IconCmp;
}

const ITEMS: NavItem[] = [
  { key: 'group', label: 'الجروب', Icon: Users },
  { key: 'round', label: 'الجولة', Icon: CalendarDays },
  { key: 'standings', label: 'الترتيب', Icon: Trophy },
];

const MARGIN = 16;
const BAR_H = 60;
const POP = 14;
const PAD = 6;
const BUBBLE_RADIUS = 24;
const CONTAINER_H = BAR_H + POP * 2;

/** Height a screen should reserve at the bottom so content clears the nav. */
export const GROUP_NAV_CLEARANCE = CONTAINER_H + 24;

const SPRING = { damping: 20, stiffness: 220, mass: 0.7 } as const;

export interface GroupBottomNavProps {
  activeKey: GroupNavKey;
  onChange: (key: GroupNavKey) => void;
  isRTL: boolean;
  bottomInset?: number;
}

export function GroupBottomNav({ activeKey, onChange, isRTL, bottomInset = 0 }: GroupBottomNavProps) {
  const { bold } = usePGFonts();

  const width = Dimensions.get('window').width - MARGIN * 2;
  const innerW = width - PAD * 2;
  const slotW = innerW / ITEMS.length;

  const activeIndex = Math.max(0, ITEMS.findIndex((i) => i.key === activeKey));
  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    progress.value = withSpring(activeIndex, SPRING);
  }, [activeIndex, progress]);

  const bubbleStyle = useAnimatedStyle(() => {
    const visual = isRTL ? ITEMS.length - 1 - progress.value : progress.value;
    return { transform: [{ translateX: PAD + visual * slotW }] };
  });

  const active = ITEMS[activeIndex];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomInset + 8 }]}>
      <View style={{ width, height: CONTAINER_H }}>
        {/* Solid app-colored bar */}
        <View style={styles.bar}>
          <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {ITEMS.map((it) => {
              const isActive = it.key === activeKey;
              const Icon = it.Icon;
              return (
                <Pressable
                  key={it.key}
                  style={styles.slot}
                  onPress={() => {
                    if (!isActive) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    onChange(it.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={it.label}
                >
                  <View style={{ opacity: isActive ? 0 : 1 }}>
                    <Icon size={22} color={PG.textMuted} strokeWidth={2} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Liquid-glass bubble that slides to the active slot */}
        <Animated.View style={[styles.bubble, { width: slotW }, bubbleStyle]} pointerEvents="none">
          <View style={styles.bubbleShell}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView
                effect="clear"
                interactive
                tintColor="rgba(159,90,251,0.16)"
                colorScheme="dark"
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <>
                <BlurView
                  intensity={Platform.OS === 'android' ? 42 : 26}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(159,90,251,0.32)', 'rgba(124,58,237,0.12)', 'rgba(255,255,255,0.03)']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </>
            )}
            <View style={styles.bubbleSpecular} pointerEvents="none" />
            <View style={styles.bubbleRim} pointerEvents="none" />

            <Animated.View
              key={active.key}
              entering={FadeIn.duration(200)}
              style={styles.bubbleContent}
            >
              <active.Icon size={22} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={[styles.bubbleLabel, { fontFamily: bold }]} numberOfLines={1}>
                {active.label}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
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
    position: 'absolute',
    top: POP,
    left: 0,
    right: 0,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    backgroundColor: '#140B22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  row: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: PAD,
  },
  slot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bubble: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: CONTAINER_H,
    ...Platform.select({
      ios: {
        shadowColor: PG.purple,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 16,
      },
      android: { elevation: 20 },
    }),
  },
  bubbleShell: {
    flex: 1,
    borderRadius: BUBBLE_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(124,58,237,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleSpecular: {
    position: 'absolute',
    top: 5,
    left: 12,
    right: 12,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  bubbleRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUBBLE_RADIUS,
    borderWidth: 0.5,
    borderColor: 'rgba(159,90,251,0.5)',
  },
  bubbleContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bubbleLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
