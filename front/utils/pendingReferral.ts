/**
 * Pending referral capture — Share & Win
 *
 * A referral link can be opened long before the visitor has an account: fresh
 * install → store → first launch → onboarding → registration. The code is
 * parked here so it survives that whole journey and is redeemed exactly once,
 * after registration succeeds.
 *
 * This store is a *carrier*, never an authority. The backend re-validates the
 * code, the account age and the self-referral rule before anything counts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidReferralCode, normalizeReferralCode } from '../constants/shareLinks';
import { logger } from './logger';

const PENDING_KEY = '@90plus:pending_referral';
const CLAIMED_KEY = '@90plus:referral_claimed';

/** Codes older than this are stale — the visitor clearly didn't sign up. */
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface PendingReferral {
  code: string;
  capturedAt: number;
}

/**
 * Park a referral code opened via deep link. The first code wins: once a
 * visitor is on their way in through someone's link, a later link cannot
 * hijack the attribution.
 */
export async function capturePendingReferral(rawCode: string): Promise<boolean> {
  const code = normalizeReferralCode(rawCode);
  if (!isValidReferralCode(code)) return false;

  try {
    // Already converted on this device — nothing left to capture.
    if (await AsyncStorage.getItem(CLAIMED_KEY)) return false;

    const existing = await AsyncStorage.getItem(PENDING_KEY);
    if (existing) {
      const parsed = JSON.parse(existing) as PendingReferral;
      if (parsed?.code && Date.now() - parsed.capturedAt < PENDING_TTL_MS) return false;
    }

    const payload: PendingReferral = { code, capturedAt: Date.now() };
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    logger.debug('[Referral] Captured pending code');
    return true;
  } catch (error) {
    logger.warn('[Referral] Failed to store pending code:', error);
    return false;
  }
}

/** The parked code, or null when there is none / it has expired. */
export async function getPendingReferral(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingReferral;
    if (!parsed?.code || !isValidReferralCode(parsed.code)) {
      await AsyncStorage.removeItem(PENDING_KEY);
      return null;
    }
    if (Date.now() - parsed.capturedAt > PENDING_TTL_MS) {
      await AsyncStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

/**
 * Clear the parked code. `converted` marks the device as done so a code can
 * never be replayed — an outcome the backend also enforces independently.
 */
export async function clearPendingReferral(converted: boolean): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
    if (converted) await AsyncStorage.setItem(CLAIMED_KEY, String(Date.now()));
  } catch (error) {
    logger.warn('[Referral] Failed to clear pending code:', error);
  }
}

/** True once a referral has converted on this device. */
export async function hasClaimedReferral(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAIMED_KEY)) != null;
  } catch {
    return false;
  }
}
