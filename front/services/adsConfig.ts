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

export type AdsPlatform = 'android' | 'ios' | 'web' | string;

export interface AdsJson {
  admob: {
    android: { appId: string; loginInterstitialId: string };
    ios: { appId: string; loginInterstitialId: string };
  };
  settings: {
    enabled: boolean;
    testMode: boolean;
    loginInterstitial: {
      enabled: boolean;
      frequency: string;
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
}

export interface AdRuntime {
  platform: AdsPlatform;
  dev: boolean;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
    (source.iosLoginInterstitialId.length > 0 && unitId === source.iosLoginInterstitialId)
  );
}

export function getServedLoginInterstitialAdUnitId(
  runtime?: Partial<AdRuntime>,
): string | null {
  return resolveServedLoginInterstitialAdUnitId(flags, {
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
  shouldUseTestAds: () => shouldUseTestAds(),
  getServedLoginInterstitialAdUnitId,
  isConfiguredProductionAdUnit,
};
