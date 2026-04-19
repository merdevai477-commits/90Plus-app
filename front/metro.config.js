const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Production optimizations
const isProduction = process.env.NODE_ENV === 'production';

// Fix for socket.io-client in React Native
// Force CommonJS builds instead of ESM for socket.io packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect ESM builds to CJS builds for socket.io packages
  if (moduleName === 'socket.io-client') {
    return context.resolveRequest(context, 'socket.io-client/build/cjs/index.js', platform);
  }
  if (moduleName === 'engine.io-client') {
    return context.resolveRequest(context, 'engine.io-client/build/cjs/index.js', platform);
  }
  
  // Use default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

// Production optimizations
if (isProduction) {
  // Enable minification
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

  // Optimize resolver
  config.resolver = {
    ...config.resolver,
    sourceExts: [...(config.resolver.sourceExts || []), 'jsx', 'js', 'ts', 'tsx'],
  };
}

module.exports = config;
