/**
 * Exclude expo-dev-client packages from native autolinking on non-development EAS builds.
 * Development profile (EAS_BUILD_PROFILE=development) must link expo-dev-client.
 *
 * iPhone builds do not show ads. The Google Mobile Ads SDK stays out of the
 * iOS binary. package.json expo.autolinking.ios.exclude is the Expo 55 guard.
 */
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
