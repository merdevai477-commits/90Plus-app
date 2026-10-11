import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const BUBBLE_IMAGE = require('../../assets/images/chat/iridescent-bubble.png');

export type ChatIridescentBubbleProps = {
  size: number;
};

/** Black glass soap-bubble with a living iridescent rim and the 90 PLUS wordmark. */
export const ChatIridescentBubble = React.memo(function ChatIridescentBubble({
  size,
}: ChatIridescentBubbleProps) {
  const reduceMotion = useReducedMotion();
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
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + shimmer.value * 0.45,
  }));

  const glowSize = size * 1.9;
  const glowOffset = (glowSize - size) / 2;
  const numeralSize = size * 0.24;
  const plusSize = size * 0.085;
  const imageStyle = { width: size, height: size };

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
            <RadialGradient id="bubbleGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#6F24FB" stopOpacity="0.42" />
              <Stop offset="0.45" stopColor="#5B1ED6" stopOpacity="0.16" />
              <Stop offset="1" stopColor="#4C1D95" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bubbleGlow)" />
        </Svg>
      </Animated.View>

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

      <View pointerEvents="none" style={[styles.layer, styles.fill, styles.wordmarkWrap]}>
        <View style={styles.wordmark}>
          <Text style={[styles.numeral, { fontSize: numeralSize, lineHeight: numeralSize * 1.1 }]}>
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
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -1,
    textShadowColor: 'rgba(196,181,253,0.7)',
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
