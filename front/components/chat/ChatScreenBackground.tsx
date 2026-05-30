import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { chatColors } from './chatTheme';

/** Chat-only ambient background — richer depth, soft purple glow. */
export function ChatScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#120820', '#0A0414', '#050208', '#020005']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(168,85,247,0.14)', 'rgba(124,58,237,0.06)', 'transparent']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={styles.topGlow}
      />
      <View style={styles.orbLeft} />
      <View style={styles.orbRight} />
      {Platform.OS === 'ios' ? (
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidVeil]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  orbLeft: {
    position: 'absolute',
    top: '18%',
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  orbRight: {
    position: 'absolute',
    bottom: '22%',
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(168,85,247,0.06)',
  },
  androidVeil: {
    backgroundColor: 'rgba(4,2,10,0.12)',
  },
});
