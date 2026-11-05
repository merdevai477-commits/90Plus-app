import { Platform } from 'react-native';
import adsJson from '../config/ads.json';

/**
 * Google's published sample interstitial units.
 * These are the only unit IDs requested while test mode or a dev bundle is active.
 * https://developers.google.com/admob/android/test-ads
 */
export const GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/1033173712',
  ios: 'ca-app-pub-3940256099942544/4411468910',
} as const;

/**
 * Google's published sample app-open units.
 * https://developers.google.com/admob/android/test-ads
 */
export const GOOGLE_TEST_APP_OPEN_AD_UNIT_IDS = {
  android: 'ca-app-pub-3940256099942544/9257395921',
  ios: 'ca-app-pub-3940256099942544/5575463023',
} as const;

export type AdsPlatform = 'android' | 'ios' | 'web' | string;

export interface AdsJson {
  admob: {
    android: { appId: string; loginInterstitialId: string; appOpenId?: string };
    ios: { appId: string; loginInterstitialId: string; appOpenId?: string };
  };
  settings: {
    enabled: boolean;
    testMode: boolean;
    loginInterstitial: {
      enabled: boolean;
      frequency: string;
    };
    appOpen?: {
      enabled: boolean;
      frequency: string;
      minimumIntervalMinutes: number;
    };
  };
}

export interface AdsFlags {
  isAdsEnabled: boolean;
  isTestMode: boolean;
  androidAppId: string;
  loginInterstitialId: string;
  iosAppId: string;
  iosLoginInterstitialId: string;
  loginInterstitialEnabled: boolean;
  loginInterstitialFrequency: string;
  androidAppOpenId: string;
  iosAppOpenId: string;
  appOpenEnabled: boolean;
  appOpenFrequency: string;
  appOpenMinimumIntervalMinutes: number;
}

export interface AdRuntime {
  platform: AdsPlatform;
  dev: boolean;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readIntervalMinutes(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 30;
}

export function readAdsFlags(config: AdsJson): AdsFlags {
  return {
    isAdsEnabled: config.settings?.enabled === true,
    isTestMode: config.settings?.testMode === true,
    androidAppId: clean(config.admob?.android?.appId),
    loginInterstitialId: clean(config.admob?.android?.loginInterstitialId),
    iosAppId: clean(config.admob?.ios?.appId),
    iosLoginInterstitialId: clean(config.admob?.ios?.loginInterstitialId),
    loginInterstitialEnabled: config.settings?.loginInterstitial?.enabled === true,
    loginInterstitialFrequency: clean(config.settings?.loginInterstitial?.frequency),
    androidAppOpenId: clean(config.admob?.android?.appOpenId),
    iosAppOpenId: clean(config.admob?.ios?.appOpenId),
    appOpenEnabled: config.settings?.appOpen?.enabled === true,
    appOpenFrequency: clean(config.settings?.appOpen?.frequency),
    appOpenMinimumIntervalMinutes: readIntervalMinutes(config.settings?.appOpen?.minimumIntervalMinutes),
  };
}

const flags = readAdsFlags(adsJson as AdsJson);

export const isAdsEnabled = flags.isAdsEnabled;
export const isTestMode = flags.isTestMode;
export const androidAppId = flags.androidAppId;
export const loginInterstitialId = flags.loginInterstitialId;
export const iosAppId = flags.iosAppId;
export const iosLoginInterstitialId = flags.iosLoginInterstitialId;
export const loginInterstitialEnabled = flags.loginInterstitialEnabled;
export const loginInterstitialFrequency = flags.loginInterstitialFrequency;
export const androidAppOpenId = flags.androidAppOpenId;
export const iosAppOpenId = flags.iosAppOpenId;
export const appOpenEnabled = flags.appOpenEnabled;
export const appOpenFrequency = flags.appOpenFrequency;
export const appOpenMinimumIntervalMinutes = flags.appOpenMinimumIntervalMinutes;

export function isIosAdsConfigured(source: AdsFlags = flags): boolean {
  return source.iosAppId.length > 0 && source.iosLoginInterstitialId.length > 0;
}

export function shouldUseTestAds(
  source: AdsFlags = flags,
  dev: boolean = typeof __DEV__ !== 'undefined' && __DEV__ === true,
): boolean {
  return source.isTestMode || dev;
}

/**
 * Unit ID that may actually be requested.
 * Returns null when ads are off, the platform has no credentials, or the
 * frequency rule is not the one this app implements.
 * Dev bundles always receive Google's test unit, even if testMode is later
 * turned off locally, so a debug session cannot serve a production ad.
 */
export function resolveServedLoginInterstitialAdUnitId(
  source: AdsFlags,
  runtime: AdRuntime,
): string | null {
  if (!source.isAdsEnabled || !source.loginInterstitialEnabled) return null;
  if (source.loginInterstitialFrequency !== 'once_per_session') return null;

  const useTestAds = shouldUseTestAds(source, runtime.dev);

  if (runtime.platform === 'android') {
    if (!source.androidAppId || !source.loginInterstitialId) return null;
    return useTestAds
      ? GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS.android
      : source.loginInterstitialId;
  }

  if (runtime.platform === 'ios') {
    if (!isIosAdsConfigured(source)) return null;
    return useTestAds
      ? GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS.ios
      : source.iosLoginInterstitialId;
  }

  return null;
}

export function isConfiguredProductionAdUnit(unitId: string, source: AdsFlags = flags): boolean {
  return (
    (source.loginInterstitialId.length > 0 && unitId === source.loginInterstitialId) ||
    (source.iosLoginInterstitialId.length > 0 && unitId === source.iosLoginInterstitialId) ||
    (source.androidAppOpenId.length > 0 && unitId === source.androidAppOpenId) ||
    (source.iosAppOpenId.length > 0 && unitId === source.iosAppOpenId)
  );
}

/**
 * App Open unit that may actually be requested.
 * An empty production id disables the ad. The login interstitial id is never
 * substituted. iOS stays off until both an iOS app id and an app-open unit exist.
 * Dev bundles always receive Google's test unit.
 */
export function resolveServedAppOpenAdUnitId(
  source: AdsFlags,
  runtime: AdRuntime,
): string | null {
  if (!source.isAdsEnabled || !source.appOpenEnabled) return null;
  if (source.appOpenFrequency !== 'once_per_session') return null;

  const useTestAds = shouldUseTestAds(source, runtime.dev);

  if (runtime.platform === 'android') {
    if (!source.androidAppId) return null;
    if (useTestAds) return GOOGLE_TEST_APP_OPEN_AD_UNIT_IDS.android;
    if (!source.androidAppOpenId || source.androidAppOpenId === source.loginInterstitialId) return null;
    return source.androidAppOpenId;
  }

  if (runtime.platform === 'ios') {
    if (!source.iosAppId || !source.iosAppOpenId) return null;
    if (source.iosAppOpenId === source.iosLoginInterstitialId) return null;
    return useTestAds ? GOOGLE_TEST_APP_OPEN_AD_UNIT_IDS.ios : source.iosAppOpenId;
  }

  return null;
}

export function getServedLoginInterstitialAdUnitId(
  runtime?: Partial<AdRuntime>,
): string | null {
  return resolveServedLoginInterstitialAdUnitId(flags, {
    platform: runtime?.platform ?? Platform.OS,
    dev: runtime?.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__ === true),
  });
}

export function getServedAppOpenAdUnitId(
  runtime?: Partial<AdRuntime>,
): string | null {
  return resolveServedAppOpenAdUnitId(flags, {
    platform: runtime?.platform ?? Platform.OS,
    dev: runtime?.dev ?? (typeof __DEV__ !== 'undefined' && __DEV__ === true),
  });
}

export const adsConfig = {
  isAdsEnabled,
  isTestMode,
  androidAppId,
  loginInterstitialId,
  iosAppId,
  iosLoginInterstitialId,
  isIosAdsConfigured: isIosAdsConfigured(),
  loginInterstitialEnabled,
  loginInterstitialFrequency,
  androidAppOpenId,
  iosAppOpenId,
  appOpenEnabled,
  appOpenFrequency,
  appOpenMinimumIntervalMinutes,
  shouldUseTestAds: () => shouldUseTestAds(),
  getServedLoginInterstitialAdUnitId,
  getServedAppOpenAdUnitId,
  isConfiguredProductionAdUnit,
};
