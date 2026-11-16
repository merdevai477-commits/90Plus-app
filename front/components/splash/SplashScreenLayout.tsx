import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Animated from 'react-native-reanimated';

/**
 * Figma Splash / Logo Screen (1593:4238) — light surface with engraved logo.
 * Surface token from Design System: #F8F7FF.
 */
export const SPLASH_BG_COLOR = '#F8F7FF';

const LOGO_SIZE = 280;

/** Engraved 90PLUS mark — bump filename when artwork changes. */
export const SPLASH_LOGO = require('../../assets/images/splash/splash-logo-engraved.jpg');

interface SplashScreenLayoutProps {
  children?: React.ReactNode;
  logoAnimatedStyle?: StyleProp<ViewStyle>;
}

/**
 * Shared splash layout: light lavender base + centered engraved 90Plus logo.
 *
 * Keep the native splash up until this logo has painted, otherwise a cold start
 * can briefly show the baked native logo then swap to a stale JS/disk-cached one.
 */
export function SplashScreenLayout({ children, logoAnimatedStyle }: SplashScreenLayoutProps) {
  const LogoWrap = logoAnimatedStyle ? Animated.View : View;
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    if (!logoReady) return;
    const id = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, [logoReady]);

  // Safety net if onLoad never fires (offline decode quirks).
  useEffect(() => {
    const t = setTimeout(() => setLogoReady(true), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.baseBg} pointerEvents="none" />

      {/* Soft ambient glow behind the engraved mark */}
      <View style={styles.glow} pointerEvents="none" />

      <LogoWrap style={[styles.logoContainer, logoAnimatedStyle]} pointerEvents="none">
        <Image
          source={SPLASH_LOGO}
          style={styles.logo}
          contentFit="contain"
          priority="high"
          cachePolicy={Platform.OS === 'android' ? 'none' : 'memory'}
          onLoad={() => setLogoReady(true)}
        />
      </LogoWrap>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SPLASH_BG_COLOR,
    overflow: 'hidden',
  },
  baseBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG_COLOR,
  },
  glow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(106, 43, 217, 0.06)',
  },
  logoContainer: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
