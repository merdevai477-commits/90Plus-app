import React, { useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import {
  BlurMask,
  Canvas,
  Circle as SkCircle,
  Group,
  Skia,
  SweepGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useChatTheme } from '../../hooks/useChatTheme';
import { IridescentRim } from './IridescentRim';

const BUBBLE_IMAGE = require('../../assets/images/chat/iridescent-bubble.png');

/** Pastel soap-film hues for the light-mode liquid swirl. */
const LIGHT_LIQUID = [
  '#A3DDF9',
  '#C4B5FD',
  '#F9A8D4',
  '#7DD3FC',
  '#DDD6FE',
  '#FDA4AF',
  '#A78BFA',
  '#A3DDF9',
];

export type ChatIridescentBubbleProps = {
  size: number;
};

/** Soft pastel liquid turning inside the light pearl shell (Skia). */
function LightLiquidCore({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  const clock = useClock();
  const c = size / 2;
  const r = size * 0.485;

  const spinA = useDerivedValue(() => {
    if (reduceMotion) return 0.4;
    return (clock.value / 1000) * 0.55;
  });
  const spinB = useDerivedValue(() => {
    if (reduceMotion) return -0.9;
    return -(clock.value / 1000) * 0.38 + 1.2;
  });
  const breathe = useDerivedValue(() => {
    if (reduceMotion) return 1;
    return 0.92 + 0.08 * Math.sin(clock.value / 1000 * 1.4);
  });

  const transformA = useDerivedValue(() => [{ rotate: spinA.value }]);
  const transformB = useDerivedValue(() => [{ rotate: spinB.value }, { scale: breathe.value }]);

  const clip = useMemo(() => {
    if (Platform.OS === 'web') return null;
    const p = Skia.Path.Make();
    p.addCircle(c, c, r);
    return p;
  }, [c, r]);

  if (!clip) return null;

  return (
    <Canvas style={[styles.layer, { width: size, height: size }]} pointerEvents="none">
      <Group clip={clip}>
        {/* Translucent pearl fill — liquid sits on top of this. */}
        <SkCircle cx={c} cy={c} r={r} color="rgba(255,255,255,0.72)" />
        <SkCircle cx={c * 0.78} cy={c * 0.68} r={r * 0.7} color="rgba(237,230,255,0.55)">
          <BlurMask blur={18} style="normal" />
        </SkCircle>

        {/* Slow iridescent liquid wash — same energy as the night soap film. */}
        <Group origin={vec(c, c)} transform={transformA}>
          <SkCircle cx={c} cy={c} r={r * 0.92} opacity={0.55}>
            <SweepGradient c={vec(c, c)} colors={LIGHT_LIQUID} />
            <BlurMask blur={14} style="normal" />
          </SkCircle>
        </Group>
        <Group origin={vec(c, c)} transform={transformB}>
          <SkCircle cx={c * 0.7} cy={c * 1.15} r={r * 0.55} color="rgba(56,189,248,0.28)">
            <BlurMask blur={22} style="normal" />
          </SkCircle>
          <SkCircle cx={c * 1.35} cy={c * 0.7} r={r * 0.42} color="rgba(244,114,182,0.26)">
            <BlurMask blur={18} style="normal" />
          </SkCircle>
          <SkCircle cx={c * 0.85} cy={c * 0.55} r={r * 0.38} color="rgba(167,139,250,0.32)">
            <BlurMask blur={16} style="normal" />
          </SkCircle>
        </Group>

        {/* Center bleach so the liquid never reads as a black hole. */}
        <SkCircle cx={c * 0.92} cy={c * 0.88} r={r * 0.55} color="rgba(255,255,255,0.55)">
          <BlurMask blur={20} style="normal" />
        </SkCircle>
        {/* Specular. */}
        <SkCircle cx={c * 0.7} cy={c * 0.58} r={r * 0.28} color="rgba(255,255,255,0.7)">
          <BlurMask blur={10} style="normal" />
        </SkCircle>
      </Group>
    </Canvas>
  );
}

/** Welcome orb: black-glass soap film (dark) / pearl shell with living pastel liquid (light). */
export const ChatIridescentBubble = React.memo(function ChatIridescentBubble({
  size,
}: ChatIridescentBubbleProps) {
  const reduceMotion = useReducedMotion();
  const { colors, isDark } = useChatTheme();
  const spin = useSharedValue(0);
  const float = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(360, { duration: 28000, easing: Easing.linear }), -1, false);
    float.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 + float.value * 12 }],
  }));
  /** The bubble is a perfect circle, so a rotated copy keeps the rim aligned while the film swirls. */
  const filmStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + shimmer.value * 0.45,
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const counterFilmStyle = useAnimatedStyle(() => ({
    opacity: 0.45 - shimmer.value * 0.35,
    transform: [{ rotate: `${-spin.value * 0.7 + 140}deg` }],
  }));
  /** Light mode: faint film flecks over the pastel liquid — keeps the night-orb DNA. */
  const lightFilmStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + shimmer.value * 0.14,
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const lightCounterFilmStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + shimmer.value * 0.08,
    transform: [{ rotate: `${-spin.value * 0.7 + 140}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + shimmer.value * 0.45,
  }));

  const glowSize = size * 1.9;
  const glowOffset = (glowSize - size) / 2;
  const numeralSize = size * 0.24;
  const plusSize = size * 0.085;
  const imageStyle = { width: size, height: size };
  const radius = size / 2;
  const glowId = isDark ? 'bubbleGlowDark' : 'bubbleGlowLight';

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
          { width: glowSize, height: glowSize, left: -glowOffset, top: -glowOffset },
          glowStyle,
        ]}
      >
        <Svg width={glowSize} height={glowSize} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.glowStop} stopOpacity={isDark ? '0.26' : '0.22'} />
              <Stop offset="0.45" stopColor={colors.glowMid} stopOpacity={isDark ? '0.1' : '0.12'} />
              <Stop offset="1" stopColor={colors.accentDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill={`url(#${glowId})`} />
        </Svg>
      </Animated.View>

      {isDark ? (
        <>
          <Image source={BUBBLE_IMAGE} style={[styles.layer, imageStyle]} resizeMode="contain" />
          <Animated.Image
            source={BUBBLE_IMAGE}
            style={[styles.layer, imageStyle, filmStyle]}
            resizeMode="contain"
          />
          <Animated.Image
            source={BUBBLE_IMAGE}
            style={[styles.layer, imageStyle, counterFilmStyle]}
            resizeMode="contain"
          />
        </>
      ) : (
        <>
          <LightLiquidCore size={size} reduceMotion={!!reduceMotion} />
          {/* Soft night-film flecks — low opacity so the liquid stays light. */}
          <Animated.Image
            source={BUBBLE_IMAGE}
            style={[styles.layer, imageStyle, lightFilmStyle]}
            resizeMode="contain"
          />
          <Animated.Image
            source={BUBBLE_IMAGE}
            style={[styles.layer, imageStyle, lightCounterFilmStyle]}
            resizeMode="contain"
          />
          {/* Glass shell edge + specular over the liquid. */}
          <Svg width={size} height={size} viewBox="0 0 100 100" style={styles.layer} pointerEvents="none">
            <Defs>
              <RadialGradient id="lightShellSpec" cx="35%" cy="28%" r="28%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
                <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.25" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx="36" cy="30" rx="18" ry="12" fill="url(#lightShellSpec)" />
            <Circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="rgba(75,31,163,0.32)"
              strokeWidth="1.4"
            />
          </Svg>
          <IridescentRim radius={radius} filmDepth={14} />
        </>
      )}

      <View pointerEvents="none" style={[styles.layer, styles.fill, styles.wordmarkWrap]}>
        <View style={styles.wordmark}>
          <Text
            style={[
              styles.numeral,
              {
                fontSize: numeralSize,
                lineHeight: numeralSize * 1.1,
                color: isDark ? '#FFFFFF' : colors.textPrimary,
                textShadowColor: isDark ? 'rgba(196,181,253,0.7)' : 'rgba(106,43,217,0.28)',
              },
            ]}
          >
            90
          </Text>
          <LinearGradient
            colors={['#7B35FF', '#6420F0']}
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
    top: 0,
    left: 0,
  },
  fill: {
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
    fontWeight: '900',
    letterSpacing: -1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  plusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#6F24FB',
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
