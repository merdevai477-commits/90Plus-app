/**
 * Exclude expo-dev-client packages from native autolinking on non-development EAS builds.
 * Development profile (EAS_BUILD_PROFILE=development) must link expo-dev-client.
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

module.exports = {
  dependencies: isDevClientBuild ? {} : buildDevClientExcludes(),
};
