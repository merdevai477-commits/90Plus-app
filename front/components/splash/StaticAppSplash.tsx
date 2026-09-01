import React from 'react';
import { SplashScreenLayout } from './SplashScreenLayout';

/**
 * Lightweight boot splash without Reanimated/worklets — safe for iOS release
 * when animated splash or navigation transition would otherwise flash white.
 */
export function StaticAppSplash() {
  return <SplashScreenLayout />;
}
