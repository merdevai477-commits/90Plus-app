import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Animated from 'react-native-reanimated';

/** Matches Figma splash (node 1007:2693) base fill. */
export const SPLASH_BG_COLOR = '#0d0529';

const LOGO_SIZE = 254;

/** Single source for native + JS splash — bump the filename when the artwork changes. */
export const SPLASH_LOGO = require('../../assets/images/splash/splash-logo-v3.png');

interface SplashScreenLayoutProps {
  children?: React.ReactNode;
  logoAnimatedStyle?: StyleProp<ViewStyle>;
}

/**
 * Shared splash layout: dark purple base, stadium photo overlay, centered 90Plus logo.
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
      <StatusBar style="light" />

      <View style={styles.baseBg} pointerEvents="none" />

      <View style={styles.stadiumWrap} pointerEvents="none">
        <Image
          source={require('../../assets/images/splash/splash-background.png')}
          style={styles.stadiumImage}
          contentFit="cover"
          priority="high"
          cachePolicy="memory"
        />
      </View>

      <LogoWrap style={[styles.logoContainer, logoAnimatedStyle]} pointerEvents="none">
        <Image
          source={SPLASH_LOGO}
          style={styles.logo}
          contentFit="contain"
          priority="high"
          // Avoid a stale disk-cached v2 logo flashing after a rebrand.
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
  stadiumWrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.54,
    overflow: 'hidden',
  },
  stadiumImage: {
    position: 'absolute',
    width: '116.14%',
    height: '106.51%',
    left: '-10.73%',
    top: '-0.02%',
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
