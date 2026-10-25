import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Sweeping light band — use inside any view with `overflow: 'hidden'`. */
export function ShimmerSweep({ width = 360, color = 'rgba(183,154,248,0.16)' }: { width?: number; color?: string }) {
  const x = useSharedValue(-1);

  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(x);
  }, [x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * width }, { skewX: '-18deg' }] as const,
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={['transparent', color, 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: width * 0.6, height: '100%' }}
      />
    </Animated.View>
  );
}

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.block, style]}>
      <ShimmerSweep />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#15111F',
    overflow: 'hidden',
    borderRadius: 8,
  },
});
