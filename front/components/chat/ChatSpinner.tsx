import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function ChatSpinner() {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 800 }), -1, false);
  }, [rotation]);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, spinStyle]} />
      <View style={styles.square} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopColor: 'white',
  },
  square: { width: 6, height: 6, backgroundColor: 'white', borderRadius: 1 },
});

/** @deprecated Use ChatSpinner */
export const SpinnerRing = ChatSpinner;
