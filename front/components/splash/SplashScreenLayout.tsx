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
/** Dark splash surface. */
export const SPLASH_BG_DARK = '#0A0618';

/** Back-compat alias used by boot screens / layout. */
export const SPLASH_BG_COLOR = SPLASH_BG_LIGHT;

/** Full brand mark — complete 90 PLUS lockup, not the cropped pitch wordmark. */
export const SPLASH_BRAND_ICON = require('../../assets/images/splash/splash-brand-icon.png');
/** Back-compat aliases. */
export const SPLASH_LOGO = SPLASH_BRAND_ICON;
export const SPLASH_LOGO_LIGHT = SPLASH_BRAND_ICON;
export const SPLASH_LOGO_DARK = SPLASH_BRAND_ICON;

const LOGO_SIZE = 196;

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
 * Shared splash: full 90PLUS brand icon on light/dark surface.
 * Native splash stays up until the logo has painted (avoids logo swap flash).
 */
export function SplashScreenLayout({ children, logoAnimatedStyle }: SplashScreenLayoutProps) {
  const preference = useAppSettings((s) => s.theme?.mode);
  const system = useColorScheme();
  const isDark = resolveSplashDark(preference, system);

  const bg = isDark ? SPLASH_BG_DARK : SPLASH_BG_LIGHT;

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

  const glowStyle = useMemo(
    () => [styles.glow, isDark ? styles.glowDark : styles.glowLight],
    [isDark],
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.baseBg, { backgroundColor: bg }]} pointerEvents="none" />

      <View style={glowStyle} pointerEvents="none" />

      <LogoWrap style={[styles.logoContainer, logoAnimatedStyle]} pointerEvents="none">
        <Image
          source={SPLASH_BRAND_ICON}
          style={styles.logo}
          contentFit="cover"
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
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  glowLight: {
    backgroundColor: 'rgba(106, 43, 217, 0.08)',
  },
  glowDark: {
    backgroundColor: 'rgba(106, 43, 217, 0.22)',
  },
  logoContainer: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 44,
    overflow: 'hidden',
    // Soft lift so the mark reads as a complete brand tile, not a cropped strip.
    ...Platform.select({
      ios: {
        shadowColor: '#24104E',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
