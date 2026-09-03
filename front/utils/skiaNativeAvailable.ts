import { TurboModuleRegistry } from 'react-native';

/**
 * True only when the native RNSkiaModule is linked into this binary.
 * Use before `require('@shopify/react-native-skia')` — otherwise TurboModule
 * getEnforcing throws and takes down the whole app.
 */
export function isSkiaNativeAvailable(): boolean {
  try {
    return TurboModuleRegistry.get('RNSkiaModule') != null;
  } catch {
    return false;
  }
}
