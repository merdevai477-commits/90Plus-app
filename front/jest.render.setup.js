/**
 * Renders need `Appearance` to exist BEFORE any module is imported.
 *
 * nativewind's runtime (react-native-css-interop) calls
 * `Appearance.getColorScheme()` at import time, and expo-modules-core pulls
 * that runtime in through its JSX import source — so the crash happens while
 * the component is still being required, before any test body runs. jest-expo's
 * React Native mock does not install `Appearance` early enough for that.
 *
 * Runs as `setupFiles` (before the test framework and before the module
 * registry is touched), not `setupFilesAfterEnv`, which would be too late.
 */
const RN = require('react-native');

const subscription = { remove: () => {} };

if (!RN.Appearance || typeof RN.Appearance.getColorScheme !== 'function') {
  RN.Appearance = {
    getColorScheme: () => 'dark',
    setColorScheme: () => {},
    addChangeListener: () => subscription,
    removeChangeListener: () => {},
  };
}

// The same module subscribes to app-state changes as it loads.
if (!RN.AppState || typeof RN.AppState.addEventListener !== 'function') {
  RN.AppState = {
    currentState: 'active',
    addEventListener: () => subscription,
    removeEventListener: () => {},
  };
}

if (!RN.AccessibilityInfo || typeof RN.AccessibilityInfo.addEventListener !== 'function') {
  RN.AccessibilityInfo = {
    ...(RN.AccessibilityInfo ?? {}),
    isReduceMotionEnabled: async () => false,
    addEventListener: () => subscription,
  };
}
