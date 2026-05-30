// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Windows: Metro's default parallelism can hit EMFILE (too many open files) in
// %TEMP%/metro-cache. Cap workers and keep cache inside the project.
const parsedWorkers = Number.parseInt(process.env.METRO_MAX_WORKERS ?? '', 10);
const maxWorkers = Number.isFinite(parsedWorkers) && parsedWorkers > 0
  ? parsedWorkers
  : process.platform === 'win32'
    ? 2
    : Math.min(os.cpus().length, 4);

config.maxWorkers = maxWorkers;
config.cacheStores = [
  new FileStore({ root: path.join(__dirname, '.metro-cache') }),
];

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Avoid aggressive terser mangling — it breaks react-native-reanimated /
// react-native-worklets in release builds (white screen on iOS).

module.exports = withNativeWind(config, { input: './global.css' });
