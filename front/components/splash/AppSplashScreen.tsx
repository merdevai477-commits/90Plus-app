import React, { useEffect } from 'react';
import { StyleSheet, Dimensions, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

/**
 * Full-screen branded splash shown after native splash until auth / critical gates are ready.
 * Matches app.json splash colors to avoid visible "shutter" between native and JS layers.
 */
export function AppSplashScreen() {
  const logoScale   = useSharedValue(0.75);
  const logoOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale   = useSharedValue(0.7);
  const barWidth    = useSharedValue(0);
  const shimmerX    = useSharedValue(-width);

  useEffect(() => {
    // Logo entrance
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value   = withSpring(1, { damping: 14, stiffness: 130 });

    // Glow breathing
    glowOpacity.value = withDelay(200, withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ), -1, true
    ));
    glowScale.value = withDelay(200, withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000 }),
        withTiming(0.9, { duration: 1000 }),
      ), -1, true
    ));

    // Indeterminate progress bar — runs back and forth
    barWidth.value = withDelay(300, withRepeat(
      withSequence(
        withTiming(width * 0.55, { duration: 700, easing: Easing.out(Easing.cubic) }),
        withTiming(width * 0.82, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(width * 0.55, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ), -1, false
    ));

    // Shimmer
    shimmerX.value = withDelay(400, withRepeat(
      withTiming(width * 1.2, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1, false
    ));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const barStyle = useAnimatedStyle(() => ({ width: barWidth.value }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <LinearGradient
      colors={['#1a0035', '#2d0060', '#1a0035']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Radial glow */}
      <Animated.View style={[styles.glow, glowStyle, { pointerEvents: 'none' }]} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={require('../../assets/images/90Plus.png')}
          style={styles.logo}
          contentFit="contain"
          priority="high"
          cachePolicy="memory-disk"
        />
      </Animated.View>

      {/* Progress track */}
      <View style={styles.track}>
        <Animated.View style={[styles.bar, barStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.shimmerWrap, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
              style={styles.shimmer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Tagline — shown during boot before i18n is initialized */}
      <Text style={styles.tagline}>
        90 Plus · Your football world
      </Text>
    </LinearGradient>
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
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#7B2FBE',
    shadowColor: '#9B59F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    elevation: 0,
  },
  logoWrap: {
    marginBottom: 44,
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 14,
  },
  logo: {
    width: 120,
    height: 120,
  },
  track: {
    width: width * 0.55,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#9B59F5',
    overflow: 'hidden',
  },
  shimmerWrap: {
    width: 72,
  },
  shimmer: {
    flex: 1,
  },
  tagline: {
    position: 'absolute',
    bottom: 52,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.4,
    fontWeight: '500',
  },
});
