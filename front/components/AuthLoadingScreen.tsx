import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import {
  GATE_THEME,
  useResolvedAppScheme,
} from '../hooks/useResolvedAppScheme';

const { width } = Dimensions.get('window');

const BRAND_ICON = require('../assets/images/splash/splash-brand-icon.png');

interface AuthLoadingScreenProps {
  message?: string;
}

export default function AuthLoadingScreen({
  message = 'جاري تسجيل الدخول...',
}: AuthLoadingScreenProps) {
  const { isDark } = useResolvedAppScheme();
  const theme = isDark ? GATE_THEME.dark : GATE_THEME.light;

  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const shimmerX = useSharedValue(-width);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(12);
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);
  const glowScale = useSharedValue(0.8);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 350 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 140 });

    glowOpacity.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.18, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    glowScale.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1.18, { duration: 900 }),
          withTiming(0.92, { duration: 900 }),
        ),
        -1,
        true,
      ),
    );

    progressWidth.value = withSequence(
      withTiming(0.55 * width, { duration: 600, easing: Easing.out(Easing.cubic) }),
      withTiming(0.75 * width, { duration: 1200, easing: Easing.out(Easing.quad) }),
      withTiming(0.88 * width, { duration: 2000, easing: Easing.out(Easing.quad) }),
    );

    shimmerX.value = withDelay(
      300,
      withRepeat(
        withTiming(width * 1.2, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      ),
    );

    textOpacity.value = withDelay(250, withTiming(1, { duration: 400 }));
    textTranslateY.value = withDelay(250, withSpring(0, { damping: 16, stiffness: 120 }));

    const dotBounce = (dot: SharedValue<number>, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-8, { duration: 280, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 180 }),
          ),
          -1,
          false,
        ),
      );
    };
    dotBounce(dot1Y, 400);
    dotBounce(dot2Y, 560);
    dotBounce(dot3Y, 720);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: progressWidth.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1Y.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2Y.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3Y.value }] }));

  const gradientColors = isDark
    ? (['#100729', '#1A0F30', '#08060F'] as const)
    : (['#F8F7FF', '#EFE7FD', '#FCFCFC'] as const);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.statusBar} />
      <LinearGradient
        colors={[...gradientColors]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View
        style={[
          styles.glow,
          glowStyle,
          { backgroundColor: isDark ? '#7B2FBE' : 'rgba(106,43,217,0.35)' },
          { pointerEvents: 'none' },
        ]}
      />

      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image
          source={BRAND_ICON}
          style={styles.logo}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
        />
      </Animated.View>

      <Animated.View style={[styles.messageRow, textStyle]}>
        <Text style={[styles.message, { color: theme.text }]}>{message}</Text>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { backgroundColor: theme.primary }, dot1Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: theme.primary }, dot2Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: theme.primary }, dot3Style]} />
        </View>
      </Animated.View>

      <View style={[styles.trackOuter, { backgroundColor: theme.track }]}>
        <Animated.View
          style={[styles.progressFill, { backgroundColor: theme.primary }, progressStyle]}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.shimmerWrapper, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']}
              style={styles.shimmerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </Animated.View>
      </View>

      <Text style={[styles.tagline, { color: theme.textMuted }]}>90 Plus · عالمك الكروي</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    shadowColor: '#9B59F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 80,
    elevation: 0,
  },
  logoContainer: {
    marginBottom: 32,
    width: 110,
    height: 110,
    borderRadius: 28,
    overflow: 'hidden',
  },
  logo: {
    width: 110,
    height: 110,
  },
  messageRow: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  message: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  trackOuter: {
    width: width * 0.62,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  shimmerWrapper: {
    width: 80,
  },
  shimmerGradient: {
    flex: 1,
  },
  tagline: {
    position: 'absolute',
    bottom: 52,
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: '500',
  },
});
