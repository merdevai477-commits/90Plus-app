module.exports = function (api) {
  api.cache(true);

  return {
    // NativeWind v4 ships `nativewind/babel` as a Babel **preset** (it
    // returns `{ plugins: [...] }` from a function). It must live in
    // `presets`, not `plugins`, otherwise Babel throws:
    //   ".plugins is not a valid Plugin property"
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
