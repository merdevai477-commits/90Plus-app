import {
  GOOGLE_TEST_INTERSTITIAL_AD_UNIT_IDS,
  readAdsFlags,
  resolveServedLoginInterstitialAdUnitId,
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
}): AdsJson {
  return {
    admob: {
      android: {
        appId: PRODUCTION_ANDROID_APP_ID,
        loginInterstitialId: PRODUCTION_ANDROID_INTERSTITIAL_ID,
      },
      ios: {
        appId: overrides?.iosAppId ?? '',
        loginInterstitialId: overrides?.iosInterstitialId ?? '',
      },
    },
    settings: {
      enabled: overrides?.enabled ?? true,
      testMode: overrides?.testMode ?? true,
      loginInterstitial: {
        enabled: true,
        frequency: overrides?.frequency ?? 'once_per_session',
      },
    },
  };
}

describe('adsConfig', () => {
  it('keeps the real Android credentials in the JSON source', () => {
    expect(adsJson.admob.android.appId).toBe(PRODUCTION_ANDROID_APP_ID);
    expect(adsJson.admob.android.loginInterstitialId).toBe(PRODUCTION_ANDROID_INTERSTITIAL_ID);
    expect(adsJson.admob.ios.appId).toBe('');
    expect(adsJson.admob.ios.loginInterstitialId).toBe('');
    expect(adsJson.settings.testMode).toBe(true);
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
