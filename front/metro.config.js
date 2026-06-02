// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { FileStore } = require('metro-cache');
const { withNativeWind } = require('nativewind/metro');

function applyProjectMetroTweaks(config) {
  const parsedWorkers = Number.parseInt(process.env.METRO_MAX_WORKERS ?? '', 10);
  const maxWorkers =
    Number.isFinite(parsedWorkers) && parsedWorkers > 0
      ? parsedWorkers
      : process.platform === 'win32'
        ? 2
        : Math.min(os.cpus().length, 4);

  config.maxWorkers = maxWorkers;
  config.cacheStores = [new FileStore({ root: path.join(__dirname, '.metro-cache') })];

  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  return config;
}

// Sentry Metro serializer — required for source maps + symbolicated JS stacks on iOS/Android.
const config = getSentryExpoConfig(__dirname, {
  getDefaultConfig: (projectRoot, options) =>
    applyProjectMetroTweaks(getDefaultConfig(projectRoot, options)),
});

module.exports = withNativeWind(config, { input: './global.css' });
