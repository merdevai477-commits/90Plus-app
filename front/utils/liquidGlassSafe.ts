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

// ─── Safe import ──────────────────────────────────────────────────────────────

let _LiquidGlassView: ComponentType<LiquidGlassViewProps> = View;
let _LiquidGlassContainerView: ComponentType<ViewProps & { spacing?: number }> = View;
let _isLiquidGlassSupported = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('@callstack/liquid-glass') as {
    LiquidGlassView?: ComponentType<LiquidGlassViewProps> | { default: ComponentType<LiquidGlassViewProps> };
    LiquidGlassContainerView?: ComponentType<ViewProps & { spacing?: number }>;
    isLiquidGlassSupported?: boolean;
  };
  const rawView = pkg.LiquidGlassView;
  _LiquidGlassView =
    typeof rawView === 'function'
      ? rawView
      : rawView && typeof rawView === 'object' && 'default' in rawView
        ? (rawView.default ?? View)
        : View;
  const rawContainer = pkg.LiquidGlassContainerView;
  _LiquidGlassContainerView =
    typeof rawContainer === 'function'
      ? rawContainer
      : rawContainer && typeof rawContainer === 'object' && 'default' in rawContainer
        ? (rawContainer.default ?? View)
        : View;
  _isLiquidGlassSupported = pkg.isLiquidGlassSupported ?? false;
} catch {
  // Native module not available — silently fall back to View / BlurView
  _isLiquidGlassSupported = false;
}

export const LiquidGlassView: ComponentType<LiquidGlassViewProps> = _LiquidGlassView;
export const LiquidGlassContainerView: ComponentType<ViewProps & { spacing?: number }> =
  _LiquidGlassContainerView;
export const isLiquidGlassSupported: boolean = _isLiquidGlassSupported;
