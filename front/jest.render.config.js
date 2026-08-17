/**
 * Config for tests that RENDER React Native components.
 *
 * The default jest.config.js runs with `testEnvironment: 'node'`, which suits
 * the service-layer suites but leaves jest-expo's native mocks half-applied —
 * rendering anything that pulls in expo-modules-core dies on
 * `Appearance.getColorScheme`. This uses jest-expo's iOS preset instead, which
 * installs the full React Native environment.
 *
 *   npx jest -c jest.render.config.js
 */
module.exports = {
  preset: 'jest-expo/ios',
  setupFiles: ['<rootDir>/jest.render.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/jest.render.after.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-css-interop|nativewind|@clerk/clerk-expo)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/**/*.live.test.tsx', '**/__tests__/**/*.render.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    /*
     * nativewind's runtime is pulled in as expo-modules-core's JSX import
     * source, so it loads before any mock can be installed — and it reads
     * Appearance / AppState / Dimensions at module scope, none of which exist
     * this early under jest. Point the JSX runtime back at React's own: the
     * component tree renders identically for query purposes, only the
     * className-to-style pass is skipped, and these tests assert content and
     * behaviour rather than styling.
     */
    '^react-native-css-interop/jsx-runtime$': 'react/jsx-runtime',
    '^react-native-css-interop/jsx-dev-runtime$': 'react/jsx-dev-runtime',
  },
};
