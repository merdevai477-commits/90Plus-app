/**
 * AnimatedTabs — segmented tab bar with a sliding underline.
 *
 * The underline position is driven by a Reanimated shared value that tweens to
 * the active index; `useAnimatedStyle` interpolates it to a translateX on the UI
 * thread (worklet). Fully RTL-aware: the left-edge slot for tab `i` is mirrored
 * when `isRTL` so the underline lands under the correct (visually reversed) tab.
 */

import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PG, PG_RADII, usePGFonts } from './theme';

export interface TabItem {
  key: string;
  label: string;
}

export interface AnimatedTabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  isRTL: boolean;
}

export function AnimatedTabs({ tabs, activeKey, onChange, isRTL }: AnimatedTabsProps) {
  const { medium, bold } = usePGFonts();
  const [width, setWidth] = useState(0);

  const count = tabs.length;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeKey));
  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    progress.value = withTiming(activeIndex, { duration: 260 });
  }, [activeIndex, progress]);

  const tabW = count > 0 ? width / count : 0;
  const barW = tabW * 0.5;

  const indicatorStyle = useAnimatedStyle(() => {
    // Left-edge slot index. In RTL the first tab sits on the right, so mirror.
    const visualIndex = isRTL ? count - 1 - progress.value : progress.value;
    const left = visualIndex * tabW + (tabW - barW) / 2;
    return {
      width: barW,
      transform: [{ translateX: left }],
    };
  });

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[styles.container, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { fontFamily: active ? bold : medium, color: active ? PG.text : PG.textMuted },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
      {width > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PG.glass,
    borderRadius: PG_RADII.md,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  label: { fontSize: 13 },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    borderRadius: 3,
    backgroundColor: PG.purpleLight,
  },
});
