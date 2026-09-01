import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Animated from 'react-native-reanimated';

/** Matches Figma splash (node 1007:2693) base fill. */
export const SPLASH_BG_COLOR = '#0d0529';

const LOGO_SIZE = 254;

interface SplashScreenLayoutProps {
  children?: React.ReactNode;
  logoAnimatedStyle?: StyleProp<ViewStyle>;
}

/**
 * Shared splash layout: dark purple base, stadium photo overlay, centered 90Plus logo.
 */
export function SplashScreenLayout({ children, logoAnimatedStyle }: SplashScreenLayoutProps) {
  const LogoWrap = logoAnimatedStyle ? Animated.View : View;

  // Hand off from the native splash (old APK assets) to the JS splash immediately.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => cancelAnimationFrame(id);
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
          cachePolicy="memory-disk"
        />
      </View>

      <LogoWrap style={[styles.logoContainer, logoAnimatedStyle]} pointerEvents="none">
        <Image
          source={require('../../assets/images/splash/splash-logo.png')}
          style={styles.logo}
          contentFit="contain"
          priority="high"
          cachePolicy="memory-disk"
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
