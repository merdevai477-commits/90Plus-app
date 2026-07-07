/**
 * Full-screen blur backdrop for bottom sheets and popups.
 */

import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

const BLUR_INTENSITY = Platform.OS === 'ios' ? 48 : 90;

export function SheetBlurBackdrop({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityRole="button">
      <BlurView intensity={BLUR_INTENSITY} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.dim} pointerEvents="none" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'android' ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.45)',
  },
});
