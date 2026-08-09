/**
 * Share & Win — referral link parsing and the pending-code carrier.
 *
 * These cover the client half of attribution: recognising an invite URL, and
 * holding the code across install → onboarding → registration without ever
 * letting a second link overwrite the first or a claimed code replay.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  buildReferralShareUrl,
  buildReferralSharePayload,
  isValidReferralCode,
  normalizeReferralCode,
  parseReferralCodeFromUrl,
} from '../../constants/shareLinks';
import {
  capturePendingReferral,
  clearPendingReferral,
  getPendingReferral,
  hasClaimedReferral,
} from '../pendingReferral';

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

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

// ─── Link parsing ───────────────────────────────────────────────────────────

describe('referral link parsing', () => {
  test('parses the https invite link the app hands out', () => {
    expect(parseReferralCodeFromUrl('https://90plus.pro/invite/AB23CD')).toBe('AB23CD');
  });

  test('parses the /ref alias and the custom scheme', () => {
    expect(parseReferralCodeFromUrl('https://90plus.pro/ref/AB23CD')).toBe('AB23CD');
    expect(parseReferralCodeFromUrl('ninetyplus://invite/AB23CD')).toBe('AB23CD');
    expect(parseReferralCodeFromUrl('ninetyplus://ref/ab23cd')).toBe('AB23CD');
  });

  test('ignores query strings and trailing noise', () => {
    expect(parseReferralCodeFromUrl('https://90plus.pro/invite/AB23CD?utm=x')).toBe('AB23CD');
  });

  test('returns null for unrelated deep links — no false referral capture', () => {
    expect(parseReferralCodeFromUrl('https://90plus.pro/reels/abc-123')).toBeNull();
    expect(parseReferralCodeFromUrl('https://90plus.pro/@someone')).toBeNull();
    expect(parseReferralCodeFromUrl('https://90plus.pro/groups/join/90PLUSXY')).toBeNull();
    expect(parseReferralCodeFromUrl('')).toBeNull();
  });

  test('rejects codes containing the excluded ambiguous characters', () => {
    expect(parseReferralCodeFromUrl('https://90plus.pro/invite/AB10CD')).toBeNull();
    expect(isValidReferralCode('AB1OCD')).toBe(false);
    expect(normalizeReferralCode(' ab-23 cd ')).toBe('AB23CD');
  });

  test('round-trips a built link back to its code', () => {
    const url = buildReferralShareUrl('ab23cd');
    expect(parseReferralCodeFromUrl(url)).toBe('AB23CD');
  });

  test('the share message carries the referral link, not a bare store link', () => {
    const ar = buildReferralSharePayload('AB23CD', 'ar');
    const en = buildReferralSharePayload('AB23CD', 'en');
    expect(ar.message).toContain('/invite/AB23CD');
    expect(en.message).toContain('/invite/AB23CD');
    expect(ar.message).not.toBe(en.message);
  });
});

// ─── Pending code carrier ───────────────────────────────────────────────────

describe('pending referral storage', () => {
  test('captures a valid code and returns it until claimed', async () => {
    await expect(capturePendingReferral('AB23CD')).resolves.toBe(true);
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
  });

  test('refuses invalid codes', async () => {
    await expect(capturePendingReferral('nope')).resolves.toBe(false);
    await expect(getPendingReferral()).resolves.toBeNull();
  });

  test('first link wins — a later link cannot hijack the attribution', async () => {
    await capturePendingReferral('AB23CD');
    await expect(capturePendingReferral('ZZ99YY')).resolves.toBe(false);
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
  });

  test('opening the same link repeatedly stays a single pending code', async () => {
    await capturePendingReferral('AB23CD');
    await capturePendingReferral('AB23CD');
    await capturePendingReferral('AB23CD');
    await expect(getPendingReferral()).resolves.toBe('AB23CD');
  });

  test('a converted claim is cleared and can never be captured again', async () => {
    await capturePendingReferral('AB23CD');
    await clearPendingReferral(true);

    await expect(getPendingReferral()).resolves.toBeNull();
    await expect(hasClaimedReferral()).resolves.toBe(true);
    // A replayed link on an already-converted device is a no-op.
    await expect(capturePendingReferral('AB23CD')).resolves.toBe(false);
  });

  test('a rejected claim clears the code without marking the device converted', async () => {
    await capturePendingReferral('AB23CD');
    await clearPendingReferral(false);

    await expect(getPendingReferral()).resolves.toBeNull();
    await expect(hasClaimedReferral()).resolves.toBe(false);
    // The device is still eligible for a future, legitimate invite.
    await expect(capturePendingReferral('ZZ99YY')).resolves.toBe(true);
  });

  test('a stale code past its TTL is dropped', async () => {
    await capturePendingReferral('AB23CD');

    const raw = await AsyncStorage.getItem('@90plus:pending_referral');
    const parsed = JSON.parse(raw as string);
    parsed.capturedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem('@90plus:pending_referral', JSON.stringify(parsed));

    await expect(getPendingReferral()).resolves.toBeNull();
  });
});
