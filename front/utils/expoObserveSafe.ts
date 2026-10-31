/**
 * Safe bridge for expo-observe / ExpoAppMetrics.
 * Not available in Expo Go (or builds that predate the native module). A static
 * import crashes root layout load → missing default export + ClerkProvider errors.
 */

import type { ComponentType } from 'react';
import Constants from 'expo-constants';

type AppMetricsApi = {
  markInteractive: (attributes?: Record<string, unknown>) => void;
};

type AppMetricsRootApi = {
  wrap: <T extends ComponentType<any>>(Component: T) => T;
};

const noopAppMetrics: AppMetricsApi = {
  markInteractive() {
    /* no-op outside linked native builds */
  },
};

const identityRoot: AppMetricsRootApi = {
  wrap<T extends ComponentType<any>>(Component: T) {
    return Component;
  },
};

function loadObserve(): { AppMetrics: AppMetricsApi; AppMetricsRoot: AppMetricsRootApi } | null {
  // Expo Go never ships ExpoAppMetrics — skip before requireNativeModule throws.
  if (Constants.appOwnership === 'expo') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-observe') as {
      AppMetrics: AppMetricsApi;
      AppMetricsRoot: AppMetricsRootApi;
    };
  } catch {
    return null;
  }
}

const observe = loadObserve();

export const AppMetrics: AppMetricsApi = observe?.AppMetrics ?? noopAppMetrics;
export const AppMetricsRoot: AppMetricsRootApi = observe?.AppMetricsRoot ?? identityRoot;
export const isExpoAppMetricsLinked = observe != null;
