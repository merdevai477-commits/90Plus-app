module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }],
    ],
    // No plugins needed here — babel-preset-expo automatically includes:
    //   - react-native-reanimated/plugin (when reanimated is installed)
    //   - react-native-worklets/plugin (since Expo SDK 54)
  };
};
