/**
 * Safe wrapper for @callstack/liquid-glass
 *
 * The package uses TurboModuleRegistry.getEnforcing() which throws a hard JS
 * error at import time if the native module is not linked (e.g. on older iOS,
 * Android, or when the Expo prebuild hasn't registered the module yet).
 *
 * This module catches that error and provides safe fallback values so the rest
 * of the app can import from here instead of directly from the package.
 */

import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidGlassViewProps extends ViewProps {
  effect?: 'clear' | 'regular' | 'prominent' | 'none';
  tint?: string;
  tintColor?: string;
  interactive?: boolean;
  colorScheme?: 'light' | 'dark' | 'system';
  animated?: boolean;
}

type LiquidGlassContainerProps = ViewProps & { spacing?: number };

/** Package exports may be the component directly or wrapped in `{ default }`. */
type MaybeDefaultExport<T extends ComponentType<unknown>> = T | { default: T };

function resolveComponent<T extends ComponentType<unknown>>(
  raw: MaybeDefaultExport<T> | undefined,
  fallback: T,
): T {
  if (typeof raw === 'function') {
    return raw;
  }
  if (raw && typeof raw === 'object' && 'default' in raw) {
    return raw.default ?? fallback;
  }
  return fallback;
}

// ─── Safe import ──────────────────────────────────────────────────────────────

let _LiquidGlassView: ComponentType<LiquidGlassViewProps> = View;
let _LiquidGlassContainerView: ComponentType<LiquidGlassContainerProps> = View;
let _isLiquidGlassSupported = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('@callstack/liquid-glass') as {
    LiquidGlassView?: MaybeDefaultExport<ComponentType<LiquidGlassViewProps>>;
    LiquidGlassContainerView?: MaybeDefaultExport<ComponentType<LiquidGlassContainerProps>>;
    isLiquidGlassSupported?: boolean;
  };
  _LiquidGlassView = resolveComponent(pkg.LiquidGlassView, View);
  _LiquidGlassContainerView = resolveComponent(pkg.LiquidGlassContainerView, View);
  _isLiquidGlassSupported = pkg.isLiquidGlassSupported ?? false;
} catch {
  // Native module not available — silently fall back to View / BlurView
  _isLiquidGlassSupported = false;
}

export const LiquidGlassView: ComponentType<LiquidGlassViewProps> = _LiquidGlassView;
export const LiquidGlassContainerView: ComponentType<LiquidGlassContainerProps> =
  _LiquidGlassContainerView;
export const isLiquidGlassSupported: boolean = _isLiquidGlassSupported;
