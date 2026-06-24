// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const os = require('os');
const { getDefaultConfig } = require('expo/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { FileStore } = require('metro-cache');
const { withNativeWind } = require('nativewind/metro');

const WIDGET_SWIFT_UI_STUBS = {
  '@expo/ui/swift-ui': path.resolve(__dirname, 'widgets/swift-ui-stub.ts'),
  '@expo/ui/swift-ui/modifiers': path.resolve(
    __dirname,
    'widgets/swift-ui-modifiers-stub.ts',
  ),
};

function isWidgetSourceModule(originModulePath) {
  return originModulePath.includes(`${path.sep}widgets${path.sep}`);
}

/** Stub Swift UI in the main app bundle — real components run in the widget extension only. */
function withWidgetSwiftUiStubs(config) {
  const previousResolveRequest = config.resolver?.resolveRequest;

  config.resolver = {
    ...config.resolver,
    resolveRequest(context, moduleName, platform) {
      const origin = context.originModulePath ?? '';
      if (isWidgetSourceModule(origin) && moduleName in WIDGET_SWIFT_UI_STUBS) {
        return { type: 'sourceFile', filePath: WIDGET_SWIFT_UI_STUBS[moduleName] };
      }

      if (previousResolveRequest) {
        return previousResolveRequest(context, moduleName, platform);
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  };

  return config;
}

function applyProjectMetroTweaks(config) {
  const parsedWorkers = Number.parseInt(process.env.METRO_MAX_WORKERS ?? '', 10);
  const maxWorkers =
    Number.isFinite(parsedWorkers) && parsedWorkers > 0
      ? parsedWorkers
      : process.platform === 'win32'
        ? 1
        : Math.min(os.cpus().length, 4);

  config.maxWorkers = maxWorkers;

  // Windows: FileStore opens many cache files → EMFILE. Use in-memory cache unless opted in.
  const useFileCache =
    process.platform !== 'win32' || process.env.METRO_FILE_CACHE === '1';
  config.cacheStores = useFileCache
    ? [new FileStore({ root: path.join(__dirname, '.metro-cache') })]
    : [];

  return config;
}

// Sentry Metro serializer — required for source maps + symbolicated JS stacks on iOS/Android.
const config = getSentryExpoConfig(__dirname, {
  getDefaultConfig: (projectRoot, options) =>
    applyProjectMetroTweaks(getDefaultConfig(projectRoot, options)),
});

module.exports = withWidgetSwiftUiStubs(
  withNativeWind(config, { input: './global.css' }),
);
