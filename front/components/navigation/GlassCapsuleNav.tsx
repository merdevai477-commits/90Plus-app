/**
 * Liquid-glass capsule switcher: a lit bubble springs to the chosen tab and
 * squishes as it moves; only that tab shows its label, the rest are icons.
 * Used by the main bottom nav and the "خماسي الهدافين" screens — callers place
 * it (it is not absolutely positioned itself).
 */

import { useEffect, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppFont } from '@/utils/fontSetup';

export const GLASS_ICON_ACTIVE = '#FFFFFF';
export const GLASS_ICON_IDLE = 'rgba(235,228,255,0.6)';

export type GlassCapsuleItem<K extends string> = {
  key: K;
  label: string;
  renderIcon: (active: boolean, size: number) => ReactElement;
  testID?: string;
};

/** Design units, multiplied by `scale`. */
export type GlassCapsuleMetrics = {
  height: number;
  pad: number;
  gap: number;
  /** Width of a closed (icon-only) slot. */
  idle: number;
  /** Floor for `idle` when the bar has to shrink into `maxWidth`. */
  minIdle: number;
  icon: number;
  font: number;
  labelGap: number;
  /** Space after the label in the open slot. */
  trail: number;
};

const DEFAULT_METRICS: GlassCapsuleMetrics = {
  height: 64,
  pad: 7,
  gap: 6,
  idle: 58,
  minIdle: 40,
  icon: 24,
  font: 13,
  labelGap: 8,
  trail: 18,
};

const FALLBACK_LABEL = 90;
const SPRING = { damping: 18, stiffness: 210, mass: 0.9 };

type GlassCapsuleNavProps<K extends string> = {
  items: readonly GlassCapsuleItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  onPressIn?: (key: K) => void;
  scale?: number;
  metrics?: Partial<GlassCapsuleMetrics>;
  /** Closed slots narrow (down to `minIdle`) so the bar fits this width in px. */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function GlassCapsuleNav<K extends string>({
  items,
  activeKey,
  onChange,
  onPressIn,
  scale = 1,
  metrics: metricsProp,
  maxWidth,
  style,
}: GlassCapsuleNavProps<K>) {
  const m = { ...DEFAULT_METRICS, ...metricsProp };
  const s = (value: number) => value * scale;
  const fontSemi = useAppFont(600);

  const [labelWidths, setLabelWidths] = useState<Partial<Record<K, number>>>({});

  const pad = s(m.pad);
  const gap = s(m.gap);
  const iconSize = s(m.icon);
  const labelOf = (key: K) => labelWidths[key] ?? s(FALLBACK_LABEL);
  const openTail = s(m.labelGap + m.trail);

  /** Closed slot width; the icon is centred in it and keeps that inset when the slot opens. */
  const idleFor = (openLabel: number) => {
    const wanted = s(m.idle);
    if (maxWidth == null || items.length < 2) return wanted;
    const others = items.length - 1;
    // open = inset + icon + tail + label, with inset = (idle - icon) / 2
    const room = maxWidth - pad * 2 - gap * others - (iconSize / 2 + openTail + openLabel);
    const fit = room / (others + 0.5);
    return Math.max(s(m.minIdle), Math.min(wanted, fit));
  };

  const idle = idleFor(labelOf(activeKey));
  const inset = (idle - iconSize) / 2;
  const widthOf = (key: K) => (key === activeKey ? inset + iconSize + openTail + labelOf(key) : idle);

  let bubbleX = pad;
  for (const item of items) {
    if (item.key === activeKey) break;
    bubbleX += widthOf(item.key) + gap;
  }
  const bubbleWidth = widthOf(activeKey);

  const x = useSharedValue(bubbleX);
  const width = useSharedValue(bubbleWidth);
  const stretchX = useSharedValue(1);
  const stretchY = useSharedValue(1);

  useEffect(() => {
    x.value = withSpring(bubbleX, SPRING);
    width.value = withSpring(bubbleWidth, SPRING);
  }, [bubbleX, bubbleWidth, x, width]);

  useEffect(() => {
    stretchX.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, SPRING));
    stretchY.value = withSequence(withTiming(0.92, { duration: 110 }), withSpring(1, SPRING));
  }, [activeKey, stretchX, stretchY]);

  const bubbleStyle = useAnimatedStyle(() => {
    const animated: ViewStyle = {
      left: x.value,
      width: width.value,
      transform: [{ scaleX: stretchX.value }, { scaleY: stretchY.value }],
    };
    return animated;
  });

  const height = s(m.height);
  const slotHeight = height - pad * 2;

  return (
    <View style={style} pointerEvents="box-none">
      {/* Off-screen copies of the labels, measured so each open slot fits its own text. */}
      <View pointerEvents="none" style={styles.measure}>
        {items.map((item) => (
          <Text
            key={item.key}
            style={[styles.label, { fontFamily: fontSemi, fontSize: s(m.font) }]}
            maxFontSizeMultiplier={1}
            onLayout={(event) => {
              const measured = Math.ceil(event.nativeEvent.layout.width);
              setLabelWidths((prev) => (prev[item.key] === measured ? prev : { ...prev, [item.key]: measured }));
            }}
          >
            {item.label}
          </Text>
        ))}
      </View>

      <View
        style={[
          styles.bar,
          { height, borderRadius: height / 2, paddingHorizontal: pad, columnGap: gap },
        ]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: height / 2, overflow: 'hidden' }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.08)']}
            locations={[0, 0.45, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View pointerEvents="none" style={[styles.rim, { borderRadius: height / 2 }]} />

        <Animated.View
          pointerEvents="none"
          style={[styles.bubble, { top: pad, height: slotHeight, borderRadius: slotHeight / 2 }, bubbleStyle]}
        >
          <View style={[StyleSheet.absoluteFill, { borderRadius: slotHeight / 2, overflow: 'hidden' }]}>
            <LinearGradient colors={['#A47BFF', '#7B4DF0', '#5B30C6']} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
              style={[styles.bubbleSheen, { height: slotHeight * 0.55 }]}
            />
          </View>
          <View pointerEvents="none" style={[styles.bubbleRim, { borderRadius: slotHeight / 2 }]} />
        </Animated.View>

        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <TabButton
              key={item.key}
              active={active}
              label={item.label}
              icon={item.renderIcon(active, iconSize)}
              width={widthOf(item.key)}
              height={slotHeight}
              inset={inset}
              labelGap={s(m.labelGap)}
              fontSize={s(m.font)}
              fontFamily={fontSemi}
              testID={item.testID}
              onPressIn={onPressIn ? () => onPressIn(item.key) : undefined}
              onPress={() => {
                if (!active) onChange(item.key);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

type TabButtonProps = {
  active: boolean;
  label: string;
  icon: ReactElement;
  width: number;
  height: number;
  inset: number;
  labelGap: number;
  fontSize: number;
  fontFamily: string;
  testID?: string;
  onPressIn?: () => void;
  onPress: () => void;
};

function TabButton({
  active,
  label,
  icon,
  width,
  height,
  inset,
  labelGap,
  fontSize,
  fontFamily,
  testID,
  onPressIn,
  onPress,
}: TabButtonProps) {
  const slotWidth = useSharedValue(width);
  const slotInset = useSharedValue(inset);
  const reveal = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    slotWidth.value = withSpring(width, SPRING);
    slotInset.value = withSpring(inset, SPRING);
  }, [width, inset, slotWidth, slotInset]);

  useEffect(() => {
    reveal.value = active ? withTiming(1, { duration: 220 }) : withTiming(0, { duration: 90 });
  }, [active, reveal]);

  const slotStyle = useAnimatedStyle(() => ({
    width: slotWidth.value,
    paddingLeft: slotInset.value,
    transform: [{ scale: press.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateX: (1 - reveal.value) * -6 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(0.9, SPRING);
        onPressIn?.();
      }}
      onPressOut={() => {
        press.value = withSpring(1, SPRING);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      testID={testID}
      hitSlop={6}
    >
      <Animated.View style={[styles.slot, { height }, slotStyle]}>
        {icon}
        <Animated.Text
          numberOfLines={1}
          style={[styles.label, { fontFamily, fontSize, marginLeft: labelGap }, labelStyle]}
          maxFontSizeMultiplier={1}
          importantForAccessibility="no"
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  measure: { position: 'absolute', top: -1000, left: 0, opacity: 0, flexDirection: 'row' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,12,28,0.8)',
    shadowColor: '#7C4DFF',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(190,160,255,0.18)',
    borderTopColor: 'rgba(255,255,255,0.32)',
  },
  bubble: {
    position: 'absolute',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    // No elevation: on Android it would lift the bubble over the tab icons.
  },
  bubbleSheen: { position: 'absolute', top: 0, left: 0, right: 0 },
  bubbleRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderTopColor: 'rgba(255,255,255,0.6)',
  },
  slot: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  label: { color: '#FFFFFF' },
});
