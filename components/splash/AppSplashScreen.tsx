import React from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

/**
 * Full-screen branded splash shown after native splash until auth / critical gates are ready.
 * Matches app.json splash colors to avoid visible “shutter” between native and JS layers.
 */
export function AppSplashScreen() {
  return (
    <LinearGradient
      colors={['#351056', '#4A148C', '#5B21A6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />
      <Image
        source={require('../../assets/images/90Plus.png')}
        style={styles.logo}
        contentFit="contain"
        priority="high"
        cachePolicy="memory-disk"
      />
      <Text style={styles.title}>90Plus</Text>
      <Text style={styles.welcomeAr}>مرحباً بك</Text>
      <Text style={styles.welcomeEn}>Welcome</Text>
      <ActivityIndicator size="large" color="rgba(255,255,255,0.95)" style={styles.spinner} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 132,
    height: 132,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  welcomeAr: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 6,
  },
  welcomeEn: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 28,
  },
  spinner: {
    marginTop: 4,
  },
});
