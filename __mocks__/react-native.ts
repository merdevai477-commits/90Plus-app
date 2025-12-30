/**
 * Mock for React Native modules used in i18n utilities
 */

export const Platform = {
  OS: 'ios',
  select: jest.fn((obj: Record<string, unknown>) => obj.ios || obj.default),
};

export const NativeModules = {
  SettingsManager: {
    settings: {
      AppleLocale: 'en_US',
      AppleLanguages: ['en'],
    },
  },
  I18nManager: {
    localeIdentifier: 'en_US',
  },
};

export const I18nManager = {
  isRTL: false,
  forceRTL: jest.fn(),
  allowRTL: jest.fn(),
};

export default {
  Platform,
  NativeModules,
  I18nManager,
};
