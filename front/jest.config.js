module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@clerk/clerk-expo)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.setup.js',
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  /*
   * `*.render.test.tsx` and `*.live.test.tsx` belong to jest.render.config.js.
   *
   * They mount real components, which needs jest-expo's full React Native
   * environment AND the real `react-native` module — this config runs in the
   * node environment under the root `__mocks__/react-native.ts` manual mock,
   * where `StyleSheet` does not exist, so any such suite dies while it is being
   * imported. They matched `*.test.tsx` and were being collected here as well
   * as there, which is why `footballGridScreen.live.test.tsx` has always
   * reported "Test suite failed to run" on a plain `npm test`.
   *
   *   npx jest -c jest.render.config.js      ← run them with this
   */
  testPathIgnorePatterns: [
    '/node_modules/',
    '\.render\.test\.tsx$',
    '\.live\.test\.tsx$',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/asyncStorage.ts',
    '^@react-native-community/netinfo$': '<rootDir>/__mocks__/netinfo.ts',
  },
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react',
      },
    },
  },
};
