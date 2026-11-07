import {
  GOOGLE_TEST_APP_OPEN_AD_UNIT_IDS,
  GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS,
  getServedLoginInterstitialAdUnitId,
  readAdsFlags,
  resolveServedAppOpenAdUnitId,
  resolveServedLoginInterstitialAdUnitId,
  setRemoteAdsEnabled,
  type AdsJson,
} from '../adsConfig';
import adsJson from '../../config/ads.json';

const PRODUCTION_ANDROID_APP_ID = 'ca-app-pub-9975521818019509~2773027556';
const PRODUCTION_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-9975521818019509/8410381515';

function config(overrides?: {
  enabled?: boolean;
  testMode?: boolean;
  frequency?: string;
  iosAppId?: string;
  iosInterstitialId?: string;
  appOpenId?: string;
  iosAppOpenId?: string;
  appOpenEnabled?: boolean;
  appOpenFrequency?: string;
}): AdsJson {
  return {
    admob: {
      android: {
        appId: PRODUCTION_ANDROID_APP_ID,
        loginInterstitialId: PRODUCTION_ANDROID_INTERSTITIAL_ID,
        appOpenId: overrides?.appOpenId ?? '',
      },
      ios: {
        appId: overrides?.iosAppId ?? '',
        loginInterstitialId: overrides?.iosInterstitialId ?? '',
        appOpenId: overrides?.iosAppOpenId ?? '',
      },
    },
    settings: {
      enabled: overrides?.enabled ?? true,
      testMode: overrides?.testMode ?? true,
      loginInterstitial: {
        enabled: true,
        frequency: overrides?.frequency ?? 'once_per_session',
      },
      appOpen: {
        enabled: overrides?.appOpenEnabled ?? true,
        frequency: overrides?.appOpenFrequency ?? 'once_per_session',
        minimumIntervalMinutes: 30,
      },
    },
  };
}

describe('adsConfig', () => {
  it('keeps the real Android credentials in the JSON source', () => {
    expect(adsJson.admob.android.appId).toBe(PRODUCTION_ANDROID_APP_ID);
    expect(adsJson.admob.android.loginInterstitialId).toBe(PRODUCTION_ANDROID_INTERSTITIAL_ID);
    expect(adsJson.admob.android.appOpenId).toBe('');
    expect(adsJson.admob.ios.appId).toBe('');
    expect(adsJson.admob.ios.loginInterstitialId).toBe('');
    expect(adsJson.admob.ios.appOpenId).toBe('');
    expect(adsJson.settings.testMode).toBe(false);
    expect(adsJson.settings.appOpen?.enabled).toBe(true);
    expect(adsJson.settings.appOpen?.frequency).toBe('once_per_session');
    expect(adsJson.settings.appOpen?.minimumIntervalMinutes).toBe(30);
  });

  it('serves the real Android interstitial from the shipped config in a release build', () => {
    const flags = readAdsFlags(adsJson);
    expect(
      resolveServedLoginInterstitialAdUnitId(flags, { platform: 'android', dev: false }),
    ).toBe(PRODUCTION_ANDROID_INTERSTITIAL_ID);
    expect(resolveServedAppOpenAdUnitId(flags, { platform: 'android', dev: false })).toBeNull();
    expect(
      resolveServedLoginInterstitialAdUnitId(flags, { platform: 'android', dev: true }),
    ).toBe(GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS.android);
  });

  it('does not request an ad until the backend turns ads on', () => {
    setRemoteAdsEnabled(null);
    expect(getServedLoginInterstitialAdUnitId({ platform: 'android', dev: false })).toBeNull();
    setRemoteAdsEnabled(false);
    expect(getServedLoginInterstitialAdUnitId({ platform: 'android', dev: false })).toBeNull();
    setRemoteAdsEnabled(true);
    expect(getServedLoginInterstitialAdUnitId({ platform: 'android', dev: false })).toBe(
      PRODUCTION_ANDROID_INTERSTITIAL_ID,
    );
    setRemoteAdsEnabled(null);
  });

  it('serves Google test interstitials while test mode is on', () => {
    const flags = readAdsFlags(config({ testMode: true }));
    expect(
      resolveServedLoginInterstitialAdUnitId(flags, { platform: 'android', dev: false }),
    ).toBe(GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS.android);
  });

  it('serves the configured Android unit when test mode is off in a release bundle', () => {
    const flags = readAdsFlags(config({ testMode: false }));
    expect(
      resolveServedLoginInterstitialAdUnitId(flags, { platform: 'android', dev: false }),
    ).toBe(PRODUCTION_ANDROID_INTERSTITIAL_ID);
  });

  it('keeps development bundles on Google test ads even if test mode is off', () => {
    const flags = readAdsFlags(config({ testMode: false }));
    const served = resolveServedLoginInterstitialAdUnitId(flags, {
      platform: 'android',
      dev: true,
    });
    expect(served).toBe(GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS.android);
    expect(served).not.toBe(PRODUCTION_ANDROID_INTERSTITIAL_ID);
  });

  it('does not request an iOS ad until both iOS credentials exist', () => {
    const empty = readAdsFlags(config());
    expect(resolveServedLoginInterstitialAdUnitId(empty, { platform: 'ios', dev: false })).toBeNull();

    const ready = readAdsFlags(
      config({
        testMode: false,
        iosAppId: 'ca-app-pub-ios~app',
        iosInterstitialId: 'ca-app-pub-ios/unit',
      }),
    );
    expect(resolveServedLoginInterstitialAdUnitId(ready, { platform: 'ios', dev: false })).toBe(
      'ca-app-pub-ios/unit',
    );
  });

  it('serves the Android app-open test unit while test mode or a dev bundle is on', () => {
    const testMode = readAdsFlags(config({ testMode: true, appOpenId: '' }));
    expect(resolveServedAppOpenAdUnitId(testMode, { platform: 'android', dev: false })).toBe(
      GOOGLE_TEST_APP_OPEN_AD_UNIT_IDS.android,
    );

    const devBundle = readAdsFlags(config({ testMode: false, appOpenId: 'ca-app-pub-real/appopen' }));
    const served = resolveServedAppOpenAdUnitId(devBundle, { platform: 'android', dev: true });
    expect(served).toBe(GOOGLE_TEST_APP_OPEN_AD_UNIT_IDS.android);
    expect(served).not.toBe(PRODUCTION_ANDROID_INTERSTITIAL_ID);
    expect(served).not.toBe('ca-app-pub-real/appopen');
  });

  it('serves the configured Android app-open unit in a production release', () => {
    const flags = readAdsFlags(
      config({ testMode: false, appOpenId: 'ca-app-pub-real/appopen' }),
    );
    expect(resolveServedAppOpenAdUnitId(flags, { platform: 'android', dev: false })).toBe(
      'ca-app-pub-real/appopen',
    );
  });

  it('disables app-open ads when the production Android id is empty', () => {
    const flags = readAdsFlags(config({ testMode: false, appOpenId: '' }));
    const served = resolveServedAppOpenAdUnitId(flags, { platform: 'android', dev: false });
    expect(served).toBeNull();
    expect(served).not.toBe(PRODUCTION_ANDROID_INTERSTITIAL_ID);
  });

  it('does not use the interstitial unit as an app-open unit', () => {
    const flags = readAdsFlags(
      config({ testMode: false, appOpenId: PRODUCTION_ANDROID_INTERSTITIAL_ID }),
    );
    expect(resolveServedAppOpenAdUnitId(flags, { platform: 'android', dev: false })).toBeNull();
  });

  it('keeps iOS app-open ads off until iOS credentials exist', () => {
    const empty = readAdsFlags(config({ testMode: true }));
    expect(resolveServedAppOpenAdUnitId(empty, { platform: 'ios', dev: false })).toBeNull();

    const ready = readAdsFlags(
      config({
        testMode: false,
        iosAppId: 'ca-app-pub-ios~app',
        iosAppOpenId: 'ca-app-pub-ios/open',
      }),
    );
    expect(resolveServedAppOpenAdUnitId(ready, { platform: 'ios', dev: false })).toBe(
      'ca-app-pub-ios/open',
    );
  });

  it('returns null when ads are disabled or the frequency is not once per session', () => {
    const disabled = readAdsFlags(config({ enabled: false }));
    const otherFrequency = readAdsFlags(config({ frequency: 'every_launch' }));
    expect(
      resolveServedLoginInterstitialAdUnitId(disabled, { platform: 'android', dev: false }),
    ).toBeNull();
    expect(
      resolveServedLoginInterstitialAdUnitId(otherFrequency, { platform: 'android', dev: false }),
    ).toBeNull();
  });
});
