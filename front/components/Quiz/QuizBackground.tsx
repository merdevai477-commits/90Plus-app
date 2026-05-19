/**
 * QuizBackground — Solid-depth layered background system.
 *
 * 8 layers of solid colors create real visual depth without blur/opacity tricks.
 * Edit layer colors here to retheme the entire quiz screen background.
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_BG } from '../../constants/ui';

const { width: SW } = Dimensions.get('window');

export function QuizBackground() {
  return (
    <>
      {/* Layer 0 — deepest base: near-black with a cold blue-purple tint */}
      <View style={[StyleSheet.absoluteFill, styles.base]} />

      {/* Layer 1 — mid-depth solid panel: slightly lighter, creates a "floor" */}
      <View pointerEvents="none" style={styles.midPanel} />

      {/* Layer 2 — top solid accent band: deep purple, hard edge = real depth */}
      <View pointerEvents="none" style={styles.topBand} />

      {/* Layer 3 — solid left-side depth rail */}
      <View pointerEvents="none" style={styles.leftRail} />

      {/* Layer 4 — solid right-side depth rail (thinner, asymmetric = cinematic) */}
      <View pointerEvents="none" style={styles.rightRail} />

      {/* Layer 5 — bottom solid footer zone: darkest, grounds the screen */}
      <View pointerEvents="none" style={styles.footerZone} />

      {/* Layer 6 — subtle solid purple "spotlight" bar top-center */}
      <View
        pointerEvents="none"
        style={[styles.spotlight, { left: SW * 0.2, right: SW * 0.2 }]}
      />

      {/* Layer 7 — thin horizontal separator line mid-screen for depth illusion */}
      <View pointerEvents="none" style={styles.midSeparator} />

      {/* Layer 8 — soft vignette: only darkens top and bottom edges */}
      <LinearGradient
        colors={[APP_BG, 'transparent', 'transparent', APP_BG]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Layer 0
  base: {
    backgroundColor: APP_BG,
  },
  // Layer 1
  midPanel: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '62%',
    backgroundColor: APP_BG,
  },
  // Layer 2
  topBand: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 220,
    backgroundColor: '#0D0820',
  },
  // Layer 3
  leftRail: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: 6,
    backgroundColor: '#2A1060',
  },
  // Layer 4
  rightRail: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    width: 3,
    backgroundColor: '#1A0A40',
  },
  // Layer 5
  footerZone: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 140,
    backgroundColor: APP_BG,
  },
  // Layer 6 (left/right set dynamically via SW)
  spotlight: {
    position: 'absolute',
    top: 0,
    height: 3,
    backgroundColor: '#7B2EFF',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  // Layer 7
  midSeparator: {
    position: 'absolute',
    top: '58%',
    left: 0, right: 0,
    height: 1,
    backgroundColor: '#1A1035',
  },
});
