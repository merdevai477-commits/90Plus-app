import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type ChatIridescentBubbleProps = {
  size: number;
};

type Swirl = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  angle: number;
  color: string;
  opacity: number;
};

/** Soft colour patches hugging the rim, like light bending through a soap film. */
const SWIRLS_A: Swirl[] = [
  { cx: 10, cy: 58, rx: 12, ry: 30, angle: 8, color: '#2F5BFF', opacity: 0.95 },
  { cx: 14, cy: 76, rx: 7, ry: 10, angle: -20, color: '#25FF8A', opacity: 0.85 },
  { cx: 28, cy: 88, rx: 15, ry: 8, angle: 30, color: '#FF2D55', opacity: 0.8 },
  { cx: 26, cy: 38, rx: 10, ry: 22, angle: 18, color: '#E6DEFF', opacity: 0.35 },
  { cx: 22, cy: 30, rx: 9, ry: 14, angle: 20, color: '#FF3D7F', opacity: 0.55 },
  { cx: 44, cy: 9, rx: 24, ry: 7, angle: -6, color: '#F2EEFF', opacity: 0.75 },
  { cx: 89, cy: 46, rx: 9, ry: 26, angle: -10, color: '#4F46E5', opacity: 0.85 },
  { cx: 76, cy: 84, rx: 18, ry: 9, angle: -35, color: '#5B8CFF', opacity: 0.8 },
  { cx: 70, cy: 30, rx: 10, ry: 18, angle: 25, color: '#DCD3FF', opacity: 0.22 },
];

const SWIRLS_B: Swirl[] = [
  { cx: 80, cy: 16, rx: 14, ry: 7, angle: 35, color: '#FF3B6B', opacity: 0.75 },
  { cx: 20, cy: 18, rx: 10, ry: 6, angle: -40, color: '#4DE8FF', opacity: 0.7 },
  { cx: 50, cy: 94, rx: 24, ry: 6, angle: 0, color: '#7C3AED', opacity: 0.85 },
  { cx: 93, cy: 66, rx: 5, ry: 11, angle: -15, color: '#3DFF9E', opacity: 0.65 },
  { cx: 84, cy: 76, rx: 8, ry: 12, angle: -40, color: '#FF4D6D', opacity: 0.6 },
];

function SwirlLayer({ id, swirls, size }: { id: string; swirls: Swirl[]; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id={`${id}Clip`}>
          <Circle cx="50" cy="50" r="49.5" />
        </ClipPath>
        {swirls.map((s, i) => (
          <RadialGradient key={i} id={`${id}${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={s.color} stopOpacity={s.opacity} />
            <Stop offset="0.55" stopColor={s.color} stopOpacity={s.opacity * 0.45} />
            <Stop offset="1" stopColor={s.color} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      <G clipPath={`url(#${id}Clip)`}>
        {swirls.map((s, i) => (
          <Ellipse
            key={i}
            cx={s.cx}
            cy={s.cy}
            rx={s.rx}
            ry={s.ry}
            fill={`url(#${id}${i})`}
            transform={`rotate(${s.angle} ${s.cx} ${s.cy})`}
          />
        ))}
      </G>
    </Svg>
  );
}

/** Black glass soap-bubble with a shifting iridescent rim and the 90 PLUS wordmark. */
export const ChatIridescentBubble = React.memo(function ChatIridescentBubble({
  size,
}: ChatIridescentBubbleProps) {
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1, false);
    float.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -7 + float.value * 14 }],
  }));
  const swirlStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const counterSwirlStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-spin.value * 1.4}deg` }],
  }));
  const fringeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 2}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + pulse.value * 0.4,
  }));

  const haloSize = size * 1.5;
  const haloOffset = (haloSize - size) / 2;
  const numeralSize = size * 0.24;
  const plusSize = size * 0.085;

  return (
    <Animated.View
      style={[{ width: size, height: size }, floatStyle]}
      accessibilityRole="image"
      accessibilityLabel="90 Plus"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          { width: haloSize, height: haloSize, left: -haloOffset, top: -haloOffset },
          haloStyle,
        ]}
      >
        <Svg width={haloSize} height={haloSize} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="bubbleHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.6" stopColor="#6366F1" stopOpacity="0.28" />
              <Stop offset="0.75" stopColor="#7C3AED" stopOpacity="0.1" />
              <Stop offset="1" stopColor="#4C1D95" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bubbleHalo)" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={[styles.layer, styles.fill]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="49.5" fill="#030207" />
        </Svg>
      </View>

      <Animated.View pointerEvents="none" style={[styles.layer, styles.fill, swirlStyle]}>
        <SwirlLayer id="swirlA" swirls={SWIRLS_A} size={size} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.layer, styles.fill, counterSwirlStyle]}>
        <SwirlLayer id="swirlB" swirls={SWIRLS_B} size={size} />
      </Animated.View>

      <View pointerEvents="none" style={[styles.layer, styles.fill]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="bubbleCore" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#000000" stopOpacity="0.92" />
              <Stop offset="0.45" stopColor="#000000" stopOpacity="0.78" />
              <Stop offset="0.72" stopColor="#000000" stopOpacity="0.25" />
              <Stop offset="0.88" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="49.5" fill="url(#bubbleCore)" />
        </Svg>
      </View>

      <Animated.View pointerEvents="none" style={[styles.layer, styles.fill, fringeStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx="50.5" cy="50" r="49" fill="none" stroke="#FF2D55" strokeOpacity="0.75" strokeWidth="0.7" />
          <Circle cx="49.6" cy="50.4" r="49" fill="none" stroke="#25FF8A" strokeOpacity="0.55" strokeWidth="0.5" />
          <Circle cx="50" cy="49.5" r="49" fill="none" stroke="#3B6BFF" strokeOpacity="0.85" strokeWidth="0.8" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={[styles.layer, styles.fill]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <SvgLinearGradient id="bubbleRim" x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.25" stopColor="#FFFFFF" stopOpacity="0.35" />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.05" />
              <Stop offset="1" stopColor="#C7D2FE" stopOpacity="0.4" />
            </SvgLinearGradient>
            <RadialGradient id="bubbleCap" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.3" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="49.3" fill="none" stroke="url(#bubbleRim)" strokeWidth="1.1" />
          <Ellipse cx="52" cy="3.5" rx="20" ry="2.6" fill="url(#bubbleCap)" />
        </Svg>
      </View>

      <View pointerEvents="none" style={[styles.layer, styles.fill, styles.wordmarkWrap]}>
        <View style={styles.wordmark}>
          <Text style={[styles.numeral, { fontSize: numeralSize, lineHeight: numeralSize * 1.1 }]}>
            90
          </Text>
          <LinearGradient
            colors={['#8B5CF6', '#6D28D9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.plusPill,
              {
                borderRadius: plusSize * 0.75,
                paddingHorizontal: plusSize * 0.7,
                paddingVertical: plusSize * 0.3,
              },
            ]}
          >
            <Text style={[styles.plusText, { fontSize: plusSize, lineHeight: plusSize * 1.25 }]}>
              PLUS
            </Text>
          </LinearGradient>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
  fill: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  wordmarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numeral: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -1,
    textShadowColor: 'rgba(196,132,252,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  plusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  plusText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
