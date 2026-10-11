import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
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

/** Glass soap-bubble orb with a slowly shifting iridescent film and the 90 PLUS wordmark. */
export const ChatIridescentBubble = React.memo(function ChatIridescentBubble({
  size,
}: ChatIridescentBubbleProps) {
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const float = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(360, { duration: 16000, easing: Easing.linear }), -1, false);
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
  const filmStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const counterFilmStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-spin.value * 1.6}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + pulse.value * 0.3,
    transform: [{ scale: 0.96 + pulse.value * 0.06 }],
  }));

  const haloSize = size * 1.7;
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
              <Stop offset="0.4" stopColor="#A855F7" stopOpacity="0.42" />
              <Stop offset="0.62" stopColor="#7C3AED" stopOpacity="0.16" />
              <Stop offset="1" stopColor="#4C1D95" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bubbleHalo)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, styles.fill, filmStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <SvgLinearGradient id="bubbleFilmA" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FF7AD9" />
              <Stop offset="0.2" stopColor="#C084FC" />
              <Stop offset="0.4" stopColor="#7C3AED" />
              <Stop offset="0.6" stopColor="#38BDF8" />
              <Stop offset="0.8" stopColor="#5EEAD4" />
              <Stop offset="1" stopColor="#F9A8D4" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="49.5" fill="url(#bubbleFilmA)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, styles.fill, { opacity: 0.55 }, counterFilmStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <SvgLinearGradient id="bubbleFilmB" x1="1" y1="0" x2="0" y2="0.8">
              <Stop offset="0" stopColor="#FDE68A" stopOpacity="0.9" />
              <Stop offset="0.3" stopColor="#F472B6" stopOpacity="0.2" />
              <Stop offset="0.55" stopColor="#818CF8" stopOpacity="0.9" />
              <Stop offset="0.8" stopColor="#22D3EE" stopOpacity="0.3" />
              <Stop offset="1" stopColor="#E879F9" stopOpacity="0.9" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="49.5" fill="url(#bubbleFilmB)" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={[styles.layer, styles.fill]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="bubbleBody" cx="47%" cy="45%" r="53%">
              <Stop offset="0" stopColor="#1A0A34" stopOpacity="0.94" />
              <Stop offset="0.55" stopColor="#1A0A34" stopOpacity="0.82" />
              <Stop offset="0.8" stopColor="#1A0A34" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#1A0A34" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="bubbleDepth" cx="50%" cy="88%" r="48%">
              <Stop offset="0" stopColor="#A855F7" stopOpacity="0.45" />
              <Stop offset="1" stopColor="#A855F7" stopOpacity="0" />
            </RadialGradient>
            <SvgLinearGradient id="bubbleRim" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.12" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.45" />
            </SvgLinearGradient>
            <RadialGradient id="bubbleSpecular" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.25" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="49.6" fill="url(#bubbleBody)" />
          <Circle cx="50" cy="50" r="49.6" fill="url(#bubbleDepth)" />
          <Circle cx="50" cy="50" r="49.2" fill="none" stroke="url(#bubbleRim)" strokeWidth="0.8" />
          <Ellipse
            cx="31"
            cy="23"
            rx="17"
            ry="7.5"
            fill="url(#bubbleSpecular)"
            transform="rotate(-38 31 23)"
          />
          <Circle cx="20" cy="38" r="1.8" fill="#FFFFFF" fillOpacity="0.7" />
          <Path
            d="M 82 64 A 35 35 0 0 1 64 83"
            stroke="#FFFFFF"
            strokeOpacity="0.4"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
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
