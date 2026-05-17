// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Production optimizations
const isProduction = process.env.NODE_ENV === 'production';

// Fix for socket.io-client in React Native — force CJS builds instead of ESM
// These packages ship both CJS and ESM; RN's Metro cannot correctly resolve their ESM entry.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'socket.io-client') {
    return context.resolveRequest(context, 'socket.io-client/build/cjs/index.js', platform);
  }
  if (moduleName === 'engine.io-client') {
    return context.resolveRequest(context, 'engine.io-client/build/cjs/index.js', platform);
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Production minifier — terser gives smaller bundle than Hermes's default
if (isProduction) {
  config.transformer = {
    ...config.transformer,
    minifierPath: require.resolve('metro-minify-terser'),
    minifierConfig: {
      ecma: 8,
      keep_classnames: false,
      keep_fnames: false,
      module: true,
      mangle: {
        module: true,
        keep_classnames: false,
        keep_fnames: false,
      },
    },
  };
}

module.exports = withNativeWind(config, { input: './global.css' });
