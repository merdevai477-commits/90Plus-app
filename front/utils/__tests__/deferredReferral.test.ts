/**
 * Deferred referral — Android Install Referrer + iOS clipboard → capturePendingReferral.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';

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

jest.mock('expo-clipboard', () => ({
  hasStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
  setStringAsync: jest.fn(async () => true),
}));

jest.mock('../pendingReferral', () => ({
  capturePendingReferral: jest.fn(async () => true),
}));

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const storage = AsyncStorage as unknown as { __reset: () => void };
const getReferrer = Application.getInstallReferrerAsync as jest.Mock;
const hasString = Clipboard.hasStringAsync as jest.Mock;
const getString = Clipboard.getStringAsync as jest.Mock;
const setString = Clipboard.setStringAsync as jest.Mock;
const capture = capturePendingReferral as jest.Mock;

beforeEach(() => {
  storage.__reset();
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'android';
});

describe('checkDeferredReferral — Android', () => {
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

  it('does not touch the clipboard APIs', async () => {
    getReferrer.mockResolvedValue('invite_AB23CD');
    await checkDeferredReferral();
    expect(hasString).not.toHaveBeenCalled();
    expect(getString).not.toHaveBeenCalled();
  });
});

describe('checkDeferredReferral — iOS', () => {
  beforeEach(() => {
    (Platform as { OS: string }).OS = 'ios';
  });

  it('skips getStringAsync when hasStringAsync is false', async () => {
    hasString.mockResolvedValue(false);
    await checkDeferredReferral();
    expect(getString).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('parks a matching 90plus-invite payload and clears the clipboard', async () => {
    hasString.mockResolvedValue(true);
    getString.mockResolvedValue('90plus-invite:AB23CD');
    await checkDeferredReferral();
    expect(capture).toHaveBeenCalledWith('AB23CD');
    expect(setString).toHaveBeenCalledWith('');
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('leaves unrelated clipboard content alone', async () => {
    hasString.mockResolvedValue(true);
    getString.mockResolvedValue('some other copied text');
    await checkDeferredReferral();
    expect(capture).not.toHaveBeenCalled();
    expect(setString).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('does not set the checked flag when clipboard throws', async () => {
    hasString.mockRejectedValue(new Error('clipboard unavailable'));
    await checkDeferredReferral();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeNull();
  });

  it('does not call Android Install Referrer on iOS', async () => {
    hasString.mockResolvedValue(false);
    await checkDeferredReferral();
    expect(getReferrer).not.toHaveBeenCalled();
  });
});
