/**
 * Pending referral capture — Share & Win
 *
 * Parks {code, clickId, source} from first open / deep link until claim after
 * registration. Carrier only — the backend re-validates.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidReferralCode, normalizeReferralCode } from '../constants/shareLinks';
import { logger } from './logger';

const PENDING_KEY = '@90plus:pending_referral';
const CLAIMED_KEY = '@90plus:referral_claimed';
const INSTALL_ID_KEY = '@90plus:install_id';
const FIRST_OPEN_SENT_KEY = '@90plus:first_open_sent';

/** Codes older than this are stale — the visitor clearly didn't sign up. */
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type PendingReferralSource = 'deferred' | 'deeplink' | 'clipboard' | 'unknown';

export interface PendingReferral {
  code: string;
  clickId: string | null;
  source: PendingReferralSource;
  capturedAt: number;
}

function newInstallId(): string {
  // RFC4122-ish without pulling a uuid package.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateInstallId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (existing) return existing;
    const id = newInstallId();
    await AsyncStorage.setItem(INSTALL_ID_KEY, id);
    return id;
  } catch {
    return newInstallId();
  }
}

export async function hasFirstOpenBeenSent(clickId: string | null): Promise<boolean> {
  if (!clickId) return true;
  try {
    const raw = await AsyncStorage.getItem(FIRST_OPEN_SENT_KEY);
    return raw === clickId;
  } catch {
    return false;
  }
}

export async function markFirstOpenSent(clickId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_OPEN_SENT_KEY, clickId);
  } catch {
    // ignore
  }
}

/**
 * Park a referral opened via deep link / deferred capture.
 * First valid code wins within TTL.
 */
export async function capturePendingReferral(
  rawCode: string,
  options?: { clickId?: string | null; source?: PendingReferralSource },
): Promise<boolean> {
  const code = normalizeReferralCode(rawCode);
  if (!isValidReferralCode(code)) return false;

  const clickId =
    typeof options?.clickId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(options.clickId)
      ? options.clickId
      : null;
  const source = options?.source ?? 'unknown';

  try {
    if (await AsyncStorage.getItem(CLAIMED_KEY)) return false;

    const existing = await AsyncStorage.getItem(PENDING_KEY);
    if (existing) {
      const parsed = JSON.parse(existing) as PendingReferral;
      if (parsed?.code && Date.now() - parsed.capturedAt < PENDING_TTL_MS) {
        // Enrich clickId if we learned it later for the same code.
        if (!parsed.clickId && clickId && parsed.code === code) {
          const enriched: PendingReferral = { ...parsed, clickId, source: parsed.source || source };
          await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(enriched));
          logger.info('[Referral] Enriched pending with clickId');
          return true;
        }
        return false;
      }
    }

    const payload: PendingReferral = {
      code,
      clickId,
      source,
      capturedAt: Date.now(),
    };
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    logger.info('[Referral] Captured pending', { source, hasClickId: Boolean(clickId) });
    return true;
  } catch (error) {
    logger.warn('[Referral] Failed to store pending code:', error);
    return false;
  }
}

/** Code only — for callers that only need the alphabet code. */
export async function getPendingReferral(): Promise<string | null> {
  const full = await getPendingReferralFull();
  return full?.code ?? null;
}

export async function getPendingReferralFull(): Promise<PendingReferral | null> {
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
    return {
      code: parsed.code,
      clickId: parsed.clickId ?? null,
      source: parsed.source ?? 'unknown',
      capturedAt: parsed.capturedAt,
    };
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

export async function hasClaimedReferral(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAIMED_KEY)) != null;
  } catch {
    return false;
  }
}

/** Stamp Clerk unsafeMetadata from pending referral (all signup paths). */
export async function getReferralUnsafeMetadata(): Promise<
  { referralCode: string; clickId?: string } | null
> {
  const pending = await getPendingReferralFull();
  if (!pending) return null;
  return pending.clickId
    ? { referralCode: pending.code, clickId: pending.clickId }
    : { referralCode: pending.code };
}
