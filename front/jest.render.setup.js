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
/*
 * `front/__mocks__/react-native.ts` is a ROOT manual mock, which jest applies
 * to every suite automatically — no jest.mock() call needed. It exports four
 * things (Platform, NativeModules, I18nManager) for the i18n unit tests, so
 * under it `StyleSheet`, `View` and every other export are undefined.
 *
 * That is fine for the node-environment suites, and fatal here: a component
 * with `StyleSheet.create` at module scope throws while it is being imported,
 * so NOTHING in this config could actually render. It went unnoticed because
 * the only suite using it was opt-in and skipped without its live token.
 *
 * Render tests get the real React Native.
 */
jest.unmock('react-native');

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
