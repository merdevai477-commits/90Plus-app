/**
 * Deferred referral — Android Install Referrer + iOS clipboard → capturePendingReferral.
 * Uses the real pendingReferral module so first-link-wins / CLAIMED_KEY are proven.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';

import {
  ANDROID_DEFERRED_HARD_MS,
  __resetDeferredReferralForTests,
  checkDeferredReferral,
  ensureDeferredReferralSettled,
} from '../deferredReferral';
import {
  capturePendingReferral,
  getPendingReferral,
  clearPendingReferral,
} from '../pendingReferral';
import { redeemPendingReferral } from '../../hooks/useShareWin';
import { claimReferralCode } from '../../services/shareWin.service';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Share: { share: jest.fn(), sharedAction: 'sharedAction' },
}));

jest.mock('@clerk/clerk-expo', () => ({
  useAuth: () => ({ getToken: jest.fn(), isSignedIn: false, isLoaded: true }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
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

jest.mock('../../services/shareWin.service', () => ({
  claimReferralCode: jest.fn(),
  fetchShareWinOverview: jest.fn(),
  recordShareEvent: jest.fn(),
}));

jest.mock('../../services/appShare.service', () => ({
  claimAppShareReward: jest.fn(),
}));

jest.mock('../../contexts/XpContext', () => ({
  useXp: () => ({ handleXpEvents: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('../../src/i18n', () => ({
  useTranslation: () => ({ t: {}, language: 'ar' }),
}));

jest.mock('../../utils/clerkAuthToken', () => ({
  getClerkBearerToken: jest.fn(async (fn: () => Promise<string | null>) => fn()),
}));

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../../services/toastManager', () => ({
  toastManager: { showSuccess: jest.fn(), showError: jest.fn() },
}));

jest.mock('../confirmExternalShare', () => ({
  confirmExternalShare: jest.fn(),
  isCopyShareActivity: jest.fn(),
  watchShareHandoff: () => ({ didLeave: () => false, stop: jest.fn() }),
}));

const storage = AsyncStorage as unknown as { __reset: () => void };
const getReferrer = Application.getInstallReferrerAsync as jest.Mock;
const hasString = Clipboard.hasStringAsync as jest.Mock;
const getString = Clipboard.getStringAsync as jest.Mock;
const setString = Clipboard.setStringAsync as jest.Mock;
const claim = claimReferralCode as jest.Mock;

beforeEach(() => {
  storage.__reset();
  __resetDeferredReferralForTests();
  jest.clearAllMocks();
  jest.useRealTimers();
  (Platform as { OS: string }).OS = 'android';
});

afterEach(() => {
  jest.useRealTimers();
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

  it('does not lock out when Play returns an empty referrer', async () => {
    getReferrer.mockResolvedValue('');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBeNull();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeNull();

    getReferrer.mockResolvedValue('invite_AB23CD');
    await checkDeferredReferral();
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
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

describe('ensureDeferredReferralSettled + redeemPendingReferral races', () => {
  const getToken = async () => 'test-token';

  it('Android: redeem waits for a slow Install Referrer before claiming', async () => {
    let resolveReferrer!: (v: string) => void;
    getReferrer.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveReferrer = resolve;
        }),
    );
    claim.mockResolvedValue({ attributed: true, reason: 'attributed' });

    // Kick settle + redeem before referrer resolves
    const redeemPromise = redeemPendingReferral(getToken);
    await new Promise((r) => setTimeout(r, 50));
    expect(claim).not.toHaveBeenCalled();

    resolveReferrer('invite_AB23CD');
    await expect(redeemPromise).resolves.toBe(true);
    expect(claim).toHaveBeenCalledWith('test-token', 'AB23CD');
  });

  it('iOS: redeem waits for a slow clipboard read before claiming', async () => {
    (Platform as { OS: string }).OS = 'ios';
    hasString.mockResolvedValue(true);
    let resolveClip!: (v: string) => void;
    getString.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveClip = resolve;
        }),
    );
    claim.mockResolvedValue({ attributed: true, reason: 'attributed' });

    const redeemPromise = redeemPendingReferral(getToken);
    await new Promise((r) => setTimeout(r, 50));
    expect(claim).not.toHaveBeenCalled();

    resolveClip('90plus-invite:AB23CD');
    await expect(redeemPromise).resolves.toBe(true);
    expect(claim).toHaveBeenCalledWith('test-token', 'AB23CD');
  });

  it('Android: referrer throw does not hang redeem and does not set the flag', async () => {
    getReferrer.mockRejectedValue(new Error('Play unavailable'));
    claim.mockResolvedValue({ attributed: true, reason: 'attributed' });

    await expect(redeemPendingReferral(getToken)).resolves.toBe(false);
    expect(claim).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('@90plus:deferred_referral_checked')).toBeNull();
  });

  it('Android: never-resolving referrer proceeds after the hard cap (fake timers)', async () => {
    jest.useFakeTimers();
    getReferrer.mockImplementation(() => new Promise(() => undefined));
    claim.mockResolvedValue({ attributed: true, reason: 'attributed' });

    const redeemPromise = redeemPendingReferral(getToken);
    await jest.advanceTimersByTimeAsync(ANDROID_DEFERRED_HARD_MS);
    await expect(redeemPromise).resolves.toBe(false);
    expect(claim).not.toHaveBeenCalled();
  });

  it('ensureDeferredReferralSettled is idempotent', async () => {
    getReferrer.mockResolvedValue('invite_AB23CD');
    const a = ensureDeferredReferralSettled();
    const b = ensureDeferredReferralSettled();
    expect(a).toBe(b);
    await a;
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
  });
});
