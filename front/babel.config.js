const path = require('path');

module.exports = function (api) {
  api.cache(true);

  const widgetFiles = (filename) =>
    filename != null &&
    filename.includes(`${path.sep}widgets${path.sep}`) &&
    !filename.includes('.android.');

  return {
    overrides: [
      {
        test: widgetFiles,
        presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
        plugins: [require('babel-preset-expo/build/widgets-plugin').widgetsPlugin],
      },
    ],
    // NativeWind v4 ships `nativewind/babel` as a Babel **preset** (it
    // returns `{ plugins: [...] }` from a function). It must live in
    // `presets`, not `plugins`, otherwise Babel throws:
    //   ".plugins is not a valid Plugin property"
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Required for react-native-reanimated 4 / worklets in production builds.
    // Must remain the last plugin in the array.
    plugins: ['react-native-worklets/plugin'],
  };
};
