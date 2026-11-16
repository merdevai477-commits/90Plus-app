import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  useColorScheme,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Animated from 'react-native-reanimated';
import { useAppSettings } from '../../src/store/useAppSettings';

/** Figma light splash surface (1593:4238). */
export const SPLASH_BG_LIGHT = '#F8F7FF';
/** Dark splash — matches LMT wordmark contrast. */
export const SPLASH_BG_DARK = '#0A0618';

/** Back-compat alias used by boot screens / layout. */
export const SPLASH_BG_COLOR = SPLASH_BG_LIGHT;

const LOGO_WIDTH = 280;
const LOGO_HEIGHT = 53; // 512×96 wordmark aspect

/** LMT pitch wordmark — white 90 + purple PLUS (for dark surfaces). */
export const SPLASH_LOGO_DARK = require('../../assets/images/splash/splash-logo-lmt.png');
/** Same lockup with ink 90 for light surfaces. */
export const SPLASH_LOGO_LIGHT = require('../../assets/images/splash/splash-logo-lmt-light.png');
/** Prefer light asset as default export for older imports. */
export const SPLASH_LOGO = SPLASH_LOGO_LIGHT;

interface SplashScreenLayoutProps {
  children?: React.ReactNode;
  logoAnimatedStyle?: StyleProp<ViewStyle>;
}

function resolveSplashDark(
  preference: 'light' | 'dark' | 'auto' | undefined,
  system: string | null | undefined,
): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return system === 'dark';
}

/**
 * Shared splash: LMT 90+PLUS wordmark on light or dark surface.
 * Native splash stays up until the logo has painted (avoids logo swap flash).
 */
export function SplashScreenLayout({ children, logoAnimatedStyle }: SplashScreenLayoutProps) {
  const preference = useAppSettings((s) => s.theme?.mode);
  const system = useColorScheme();
  const isDark = resolveSplashDark(preference, system);

  const bg = isDark ? SPLASH_BG_DARK : SPLASH_BG_LIGHT;
  const logo = isDark ? SPLASH_LOGO_DARK : SPLASH_LOGO_LIGHT;

  const LogoWrap = logoAnimatedStyle ? Animated.View : View;
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    setLogoReady(false);
  }, [isDark]);

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
  }, [isDark]);

  const glowStyle = useMemo(
    () => [
      styles.glow,
      isDark ? styles.glowDark : styles.glowLight,
    ],
    [isDark],
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.baseBg, { backgroundColor: bg }]} pointerEvents="none" />

      <View style={glowStyle} pointerEvents="none" />

      <LogoWrap style={[styles.logoContainer, logoAnimatedStyle]} pointerEvents="none">
        <Image
          key={isDark ? 'dark' : 'light'}
          source={logo}
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
    overflow: 'hidden',
  },
  baseBg: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    position: 'absolute',
    width: 340,
    height: 200,
    borderRadius: 100,
  },
  glowLight: {
    backgroundColor: 'rgba(106, 43, 217, 0.06)',
  },
  glowDark: {
    backgroundColor: 'rgba(106, 43, 217, 0.18)',
  },
  logoContainer: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
