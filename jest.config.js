/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/services', '<rootDir>/hooks', '<rootDir>/utils', '<rootDir>/src', '<rootDir>/config', '<rootDir>/components', '<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        skipLibCheck: true,
        types: ['jest', 'node'],
      },
      diagnostics: {
        ignoreCodes: [2593, 2304, 2708, 2339, 2345, 2704, 2769],
      },
    }],
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/asyncStorage.ts',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.ts',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.ts',
    '^expo-video-thumbnails$': '<rootDir>/__mocks__/expo-video-thumbnails.ts',
    '^expo-image-manipulator$': '<rootDir>/__mocks__/expo-image-manipulator.ts',
  },
  collectCoverageFrom: [
    'services/**/*.ts',
    'hooks/**/*.ts',
    'utils/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  globals: {
    __DEV__: true,
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
};
