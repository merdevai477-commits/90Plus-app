import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SplashScreenLayout } from './SplashScreenLayout';

/**
 * Full-screen branded splash shown after native splash until auth / critical gates are ready.
 * Matches app.json splash colors to avoid visible "shutter" between native and JS layers.
 */
export function AppSplashScreen() {
  // Start fully visible so the handoff from the native splash never dips to a
  // blank/stale logo frame (opacity 0 → fade-in looked like a logo swap).
  const logoScale = useSharedValue(0.96);
  const logoOpacity = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 16, stiffness: 140 });
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return <SplashScreenLayout logoAnimatedStyle={logoStyle} />;
}
