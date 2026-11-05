/**
 * Exclude expo-dev-client packages from native autolinking on non-development EAS builds.
 * Development profile (EAS_BUILD_PROFILE=development) must link expo-dev-client.
 *
 * iOS AdMob stays unlinked until config/ads.json has an iOS App ID. The Google
 * Mobile Ads SDK crashes on launch without GADApplicationIdentifier, and no
 * iOS credentials have been provided.
 */
const ads = require('./config/ads.json');
const DEV_CLIENT_PACKAGES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

const isDevClientBuild =
  process.env.EAS_BUILD_PROFILE === 'development' ||
  process.env.EXPO_USE_DEV_CLIENT === '1';

function buildDevClientExcludes() {
  return DEV_CLIENT_PACKAGES.reduce((deps, pkg) => {
    deps[pkg] = {
      platforms: {
        android: null,
        ios: null,
      },
    };
    return deps;
  }, {});
}

function googleMobileAdsExcludes() {
  const iosAppId = ads?.admob?.ios?.appId;
  if (typeof iosAppId === 'string' && iosAppId.trim()) return {};
  return {
    'react-native-google-mobile-ads': {
      platforms: {
        ios: null,
      },
    },
  };
}

module.exports = {
  dependencies: {
    ...(isDevClientBuild ? {} : buildDevClientExcludes()),
    ...googleMobileAdsExcludes(),
  },
};
