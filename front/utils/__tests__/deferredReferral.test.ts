/**
 * Deferred referral — Android Install Referrer + iOS clipboard → capturePendingReferral.
 * Uses the real pendingReferral module so first-link-wins / CLAIMED_KEY are proven.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';

import { checkDeferredReferral } from '../deferredReferral';
import {
  capturePendingReferral,
  getPendingReferral,
  clearPendingReferral,
} from '../pendingReferral';

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

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const storage = AsyncStorage as unknown as { __reset: () => void };
const getReferrer = Application.getInstallReferrerAsync as jest.Mock;
const hasString = Clipboard.hasStringAsync as jest.Mock;
const getString = Clipboard.getStringAsync as jest.Mock;
const setString = Clipboard.setStringAsync as jest.Mock;

beforeEach(() => {
  storage.__reset();
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'android';
});

describe('checkDeferredReferral — Android', () => {
  it('parks a valid invite_CODE from the install referrer once', async () => {
    getReferrer.mockResolvedValue('invite_AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();

    await checkDeferredReferral();
    expect(getReferrer).toHaveBeenCalledTimes(1);
  });

  it('extracts invite_CODE from a mixed utm + referrer string', async () => {
    getReferrer.mockResolvedValue('utm_source=x&referrer=invite_AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
  });

  it('ignores organic Play referrers without an invite code', async () => {
    getReferrer.mockResolvedValue('utm_source=google-play&utm_medium=organic');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBeNull();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('does not set the checked flag when Play throws', async () => {
    getReferrer.mockRejectedValue(new Error('ERR_APPLICATION_INSTALL_REFERRER_UNAVAILABLE'));
    await expect(checkDeferredReferral()).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeNull();
  });

  it('does not touch the clipboard APIs', async () => {
    getReferrer.mockResolvedValue('invite_AB23CD');
    await checkDeferredReferral();
    expect(hasString).not.toHaveBeenCalled();
    expect(getString).not.toHaveBeenCalled();
  });

  it('does not override an existing pending Universal-Link code (first-link-wins)', async () => {
    await capturePendingReferral('ZZ99YY');
    getReferrer.mockResolvedValue('invite_AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBe('ZZ99YY');
  });

  it('ignores deferred capture when CLAIMED_KEY is set', async () => {
    await clearPendingReferral(true);
    getReferrer.mockResolvedValue('invite_AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBeNull();
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
    await expect(getPendingReferral()).resolves.toBeNull();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('parks a matching 90plus-invite payload and clears the clipboard', async () => {
    hasString.mockResolvedValue(true);
    getString.mockResolvedValue('90plus-invite:AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
    expect(setString).toHaveBeenCalledWith('');
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('leaves unrelated clipboard content alone', async () => {
    hasString.mockResolvedValue(true);
    getString.mockResolvedValue('some other copied text');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBeNull();
    expect(setString).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeTruthy();
  });

  it('does not set the checked flag when clipboard throws', async () => {
    hasString.mockRejectedValue(new Error('clipboard unavailable'));
    await expect(checkDeferredReferral()).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeNull();
  });

  it('does not call Android Install Referrer on iOS', async () => {
    hasString.mockResolvedValue(false);
    await checkDeferredReferral();
    expect(getReferrer).not.toHaveBeenCalled();
  });

  it('does not override an existing pending code from a Universal Link', async () => {
    await capturePendingReferral('ZZ99YY');
    hasString.mockResolvedValue(true);
    getString.mockResolvedValue('90plus-invite:AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBe('ZZ99YY');
    // Matched pattern still clears clipboard after capture attempt
    expect(setString).toHaveBeenCalledWith('');
  });

  it('ignores clipboard invite when CLAIMED_KEY is set', async () => {
    await clearPendingReferral(true);
    hasString.mockResolvedValue(true);
    getString.mockResolvedValue('90plus-invite:AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBeNull();
  });
});
