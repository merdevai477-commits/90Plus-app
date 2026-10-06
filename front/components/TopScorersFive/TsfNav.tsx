/**
 * The switcher that floats over every "خماسي الهدافين" tab — a liquid-glass
 * capsule whose lit bubble slides to the chosen tab. Only that tab shows its
 * label; the others are icons until tapped. Lifted off the home indicator the
 * same way King of Predictions lifts its own so the two read as one system.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

export type TsfTabKey = 'matches' | 'pitch' | 'ranking';

const ICON_ACTIVE = '#FFFFFF';
const ICON_IDLE = 'rgba(235,228,255,0.6)';

const TAB_ICON: Record<TsfTabKey, (size: number, active: boolean) => ReactElement> = {
  matches: (size, active) => (
    <Ionicons name={active ? 'calendar' : 'calendar-outline'} size={size} color={active ? ICON_ACTIVE : ICON_IDLE} />
  ),
  pitch: (size, active) => (
    <MaterialCommunityIcons name="soccer-field" size={size} color={active ? ICON_ACTIVE : ICON_IDLE} />
  ),
  ranking: (size, active) => (
    <Ionicons name={active ? 'trophy' : 'trophy-outline'} size={size} color={active ? ICON_ACTIVE : ICON_IDLE} />
  ),
};

/** Design units, scaled by the host's `scale`. */
const BAR = { height: 64, pad: 7, gap: 6 };
const SLOT = { idle: 58, icon: 24, labelGap: 8, trail: 18, font: 13 };
/** The icon sits where it does in an idle slot, so it never jumps as the slot opens. */
const ICON_INSET = (SLOT.idle - SLOT.icon) / 2;
const FALLBACK_LABEL = 90;

const SPRING = { damping: 18, stiffness: 210, mass: 0.9 };

/** How far the bar sits off the foot of the screen. */
export function tsfNavBottom(insetBottom: number): number {
  return Math.max(insetBottom, 12) + 8;
}

type TsfNavProps = {
  activeTab: TsfTabKey;
  onChange: (tab: TsfTabKey) => void;
  /**
   * Design units → px. The host passes the same height-constrained scale its
   * content uses, so the bar can never outgrow the slot reserved for it.
   */
  scale: number;
};

export function TsfNav({ activeTab, onChange, scale }: TsfNavProps) {
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const tabsCopy = t.topScorersFive.pick.tabs;
  const fontSemi = useAppFont(600);

  const s = (value: number) => value * scale;

  /** Arabic design order (left → right); English reads the other way. */
  const tabs = useMemo<readonly TsfTabKey[]>(
    () => (language === 'ar' ? ['ranking', 'pitch', 'matches'] : ['matches', 'pitch', 'ranking']),
    [language],
  );

  const [labelWidths, setLabelWidths] = useState<Partial<Record<TsfTabKey, number>>>({});
  const openWidth = (tab: TsfTabKey) =>
    s(ICON_INSET + SLOT.icon + SLOT.labelGap + SLOT.trail) + (labelWidths[tab] ?? s(FALLBACK_LABEL));
  const widthOf = (tab: TsfTabKey) => (tab === activeTab ? openWidth(tab) : s(SLOT.idle));

  let bubbleX = s(BAR.pad);
  for (const tab of tabs) {
    if (tab === activeTab) break;
    bubbleX += widthOf(tab) + s(BAR.gap);
  }
  const bubbleWidth = widthOf(activeTab);

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
  }, [activeTab, stretchX, stretchY]);

  const bubbleStyle = useAnimatedStyle(() => {
    const style: ViewStyle = {
      left: x.value,
      width: width.value,
      transform: [{ scaleX: stretchX.value }, { scaleY: stretchY.value }],
    };
    return style;
  });

  const slotHeight = s(BAR.height - BAR.pad * 2);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: tsfNavBottom(insets.bottom) }]}>
      {/* Off-screen copies of the labels, measured so each open slot fits its own text. */}
      <View pointerEvents="none" style={styles.measure}>
        {tabs.map((tab) => (
          <Text
            key={tab}
            style={[styles.label, { fontFamily: fontSemi, fontSize: s(SLOT.font) }]}
            maxFontSizeMultiplier={1}
            onLayout={(event) => {
              const measured = Math.ceil(event.nativeEvent.layout.width);
              setLabelWidths((prev) => (prev[tab] === measured ? prev : { ...prev, [tab]: measured }));
            }}
          >
            {tabsCopy[tab]}
          </Text>
        ))}
      </View>

      <View
        style={[
          styles.bar,
          {
            height: s(BAR.height),
            borderRadius: s(BAR.height / 2),
            paddingHorizontal: s(BAR.pad),
            columnGap: s(BAR.gap),
          },
        ]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(BAR.height / 2), overflow: 'hidden' }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.08)']}
            locations={[0, 0.45, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View pointerEvents="none" style={[styles.rim, { borderRadius: s(BAR.height / 2) }]} />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            { top: s(BAR.pad), height: slotHeight, borderRadius: slotHeight / 2 },
            bubbleStyle,
          ]}
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

        {tabs.map((tab) => (
          <TabButton
            key={tab}
            active={tab === activeTab}
            label={tabsCopy[tab]}
            icon={TAB_ICON[tab](s(SLOT.icon), tab === activeTab)}
            width={widthOf(tab)}
            height={slotHeight}
            s={s}
            fontFamily={fontSemi}
            testID={`tsf-nav-${tab}`}
            onPress={() => {
              if (tab !== activeTab) onChange(tab);
            }}
          />
        ))}
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
  s: (value: number) => number;
  fontFamily: string;
  testID: string;
  onPress: () => void;
};

function TabButton({ active, label, icon, width, height, s, fontFamily, testID, onPress }: TabButtonProps) {
  const slotWidth = useSharedValue(width);
  const reveal = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    slotWidth.value = withSpring(width, SPRING);
  }, [width, slotWidth]);

  useEffect(() => {
    reveal.value = active ? withTiming(1, { duration: 220 }) : withTiming(0, { duration: 90 });
  }, [active, reveal]);

  const slotStyle = useAnimatedStyle(() => ({
    width: slotWidth.value,
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
      <Animated.View style={[styles.slot, { height, paddingLeft: s(ICON_INSET) }, slotStyle]}>
        {icon}
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            { fontFamily, fontSize: s(SLOT.font), marginLeft: s(SLOT.labelGap) },
            labelStyle,
          ]}
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
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
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
