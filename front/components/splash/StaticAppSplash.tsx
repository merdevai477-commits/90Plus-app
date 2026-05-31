import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

/**
 * Lightweight boot splash without Reanimated/worklets — safe for iOS release
 * when animated splash or navigation transition would otherwise flash white.
 */
export function StaticAppSplash() {
  return (
    <LinearGradient
      colors={['#1a0035', '#2d0060', '#1a0035']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />
      <View style={styles.glow} pointerEvents="none" />
      <Image
        source={require('../../assets/images/90Plus.png')}
        style={styles.logo}
        contentFit="contain"
        priority="high"
        cachePolicy="memory-disk"
      />
      <ActivityIndicator color="#9B59F5" style={styles.spinner} />
      <Text style={styles.tagline}>90 Plus · Your football world</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a0035',
  },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#7B2FBE',
    opacity: 0.35,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 28,
  },
  spinner: {
    marginTop: 8,
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
