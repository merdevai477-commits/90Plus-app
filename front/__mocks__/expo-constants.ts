/**
 * Mock for expo-constants module
 * Used in Jest tests to avoid ESM import issues
 */

const Constants = {
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:3000/api',
      localIp: '192.168.1.7',
      ngrokUrl: null,
    },
  },
  manifest: {
    extra: {
      apiUrl: 'http://localhost:3000/api',
    },
  },
  appOwnership: 'standalone',
  debugMode: true,
  deviceName: 'Test Device',
  deviceYearClass: 2020,
  experienceUrl: 'exp://localhost:8081',
  expoVersion: '1.0.0',
  installationId: 'test-installation-id',
  isDetached: false,
  isDevice: false,
  isHeadless: false,
  linkingUri: 'exp://localhost:8081',
  sessionId: 'test-session-id',
  statusBarHeight: 20,
  systemFonts: [],
  platform: {
    ios: {
      buildNumber: '1',
      platform: 'iPhone Simulator',
      model: 'iPhone 12',
      userInterfaceIdiom: 'phone',
    },
  },
};

export default Constants;
