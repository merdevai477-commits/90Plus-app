import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { SplashScreenLayout } from './SplashScreenLayout';

/**
 * Full-screen branded splash shown after native splash until auth / critical gates are ready.
 * Matches app.json splash colors to avoid visible "shutter" between native and JS layers.
 */
export function AppSplashScreen() {
  const logoScale = useSharedValue(0.88);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 450 });
    logoScale.value = withSpring(1, { damping: 16, stiffness: 140 });
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return <SplashScreenLayout logoAnimatedStyle={logoStyle} />;
}
