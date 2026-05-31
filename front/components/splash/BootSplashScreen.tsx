import React from 'react';
import { AppSplashScreen } from './AppSplashScreen';
import { StaticAppSplash } from './StaticAppSplash';

/** Boot gates use static splash in release to avoid Reanimated white-screen risk. */
export function BootSplashScreen() {
  if (__DEV__) {
    return <AppSplashScreen />;
  }
  return <StaticAppSplash />;
}
