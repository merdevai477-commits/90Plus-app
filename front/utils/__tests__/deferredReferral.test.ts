/**
 * Android deferred referral — Install Referrer → capturePendingReferral.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

import { checkDeferredReferral } from '../deferredReferral';
import { capturePendingReferral } from '../pendingReferral';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      __reset: () => {
        store = {};
      },
    },
  };
});

jest.mock('expo-application', () => ({
  getInstallReferrerAsync: jest.fn(),
}));

jest.mock('../pendingReferral', () => ({
  capturePendingReferral: jest.fn(async () => true),
}));

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const storage = AsyncStorage as unknown as { __reset: () => void };
const getReferrer = Application.getInstallReferrerAsync as jest.Mock;
const capture = capturePendingReferral as jest.Mock;

beforeEach(() => {
  storage.__reset();
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'android';
});

describe('checkDeferredReferral', () => {
  it('no-ops on iOS', async () => {
    (Platform as { OS: string }).OS = 'ios';
    await checkDeferredReferral();
    expect(getReferrer).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('parks a valid invite_CODE from the install referrer once', async () => {
    getReferrer.mockResolvedValue('invite_AB23CD');
    await checkDeferredReferral();
    expect(capture).toHaveBeenCalledWith('AB23CD');
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();

    await checkDeferredReferral();
    expect(getReferrer).toHaveBeenCalledTimes(1);
  });

  it('ignores organic Play referrers without an invite code', async () => {
    getReferrer.mockResolvedValue('utm_source=google-play&utm_medium=organic');
    await checkDeferredReferral();
    expect(capture).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('does not set the checked flag when Play throws', async () => {
    getReferrer.mockRejectedValue(new Error('ERR_APPLICATION_INSTALL_REFERRER_UNAVAILABLE'));
    await checkDeferredReferral();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeNull();
  });
});
