/**
 * Deferred referral attribution — Share & Win
 *
 * Android: Play Install Referrer (`invite_CODE` or `invite_CODE_clickId`).
 * iOS: clipboard (`90plus-invite:CODE` or `90plus-invite:CODE:clickId`).
 *
 * Capture on first open. CHECKED_KEY only after a definitive outcome.
 * Inconclusive results (empty clipboard, paste deny, referrer error) retry
 * up to MAX_INCONCLUSIVE_LAUNCHES.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';

import { isValidReferralCode, normalizeReferralCode } from '../constants/shareLinks';
import {
  capturePendingReferral,
  getOrCreateInstallId,
  getPendingReferralFull,
  hasFirstOpenBeenSent,
  markFirstOpenSent,
} from './pendingReferral';
import { logger } from './logger';
import { reportFirstOpen } from '../services/shareWin.service';

const CHECKED_KEY = '@90plus:deferred_referral_checked';
const INCONCLUSIVE_COUNT_KEY = '@90plus:deferred_inconclusive_count';
const MAX_INCONCLUSIVE_LAUNCHES = 5;

export const ANDROID_REFERRER_SOFT_MS = 2_000;
export const ANDROID_DEFERRED_HARD_MS = 5_000;
export const IOS_DEFERRED_HARD_MS = 30_000;

const PLAY_REFERRER_RE = /invite_([A-Za-z0-9]+)(?:_([A-Za-z0-9_-]{8,64}))?/;
const IOS_INVITE_CLIPBOARD_RE =
  /^90plus-invite:([A-Za-z0-9]{6})(?::([A-Za-z0-9_-]{8,64}))?$/i;

let deferredSettledPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appVersionLabel(): string {
  const v = Constants.expoConfig?.version ?? Application.nativeApplicationVersion ?? '?';
  const build =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode;
  return build != null ? `${v}+${build}` : String(v);
}

export function ensureDeferredReferralSettled(): Promise<void> {
  if (!deferredSettledPromise) {
    deferredSettledPromise = settleDeferredOnce().catch((error) => {
      logger.error('[DeferredReferral] settle unexpected error:', error);
    });
  }
  return deferredSettledPromise;
}

export function __resetDeferredReferralForTests(): void {
  deferredSettledPromise = null;
}

async function settleDeferredOnce(): Promise<void> {
  const work = checkDeferredReferral();
  const hardMs =
    Platform.OS === 'android'
      ? ANDROID_DEFERRED_HARD_MS
      : Platform.OS === 'ios'
        ? IOS_DEFERRED_HARD_MS
        : 0;
  if (hardMs <= 0) {
    await work;
    return;
  }
  await Promise.race([work, sleep(hardMs)]);
}

async function getInconclusiveCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(INCONCLUSIVE_COUNT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function bumpInconclusive(): Promise<void> {
  const n = (await getInconclusiveCount()) + 1;
  await AsyncStorage.setItem(INCONCLUSIVE_COUNT_KEY, String(n));
  if (n >= MAX_INCONCLUSIVE_LAUNCHES) {
    await AsyncStorage.setItem(CHECKED_KEY, String(Date.now()));
    logger.info('[DeferredReferral] referral_capture_result', {
      found: false,
      reason: 'inconclusive_cap',
      platform: Platform.OS,
      appVersion: appVersionLabel(),
    });
  }
}

async function markDefinitiveChecked(): Promise<void> {
  await AsyncStorage.setItem(CHECKED_KEY, String(Date.now()));
  await AsyncStorage.removeItem(INCONCLUSIVE_COUNT_KEY);
}

async function maybeSendFirstOpen(): Promise<void> {
  const pending = await getPendingReferralFull();
  if (!pending?.clickId) return;
  if (await hasFirstOpenBeenSent(pending.clickId)) return;

  const installId = await getOrCreateInstallId();
  const ok = await reportFirstOpen({
    clickId: pending.clickId,
    installId,
    platform: Platform.OS,
    appVersion: appVersionLabel(),
  });
  logger.info('[DeferredReferral] first_open_sent', {
    ok,
    platform: Platform.OS,
    appVersion: appVersionLabel(),
  });
  if (ok) await markFirstOpenSent(pending.clickId);
}

export async function checkDeferredReferral(): Promise<void> {
  try {
    logger.info('[DeferredReferral] referral_capture_attempt', {
      platform: Platform.OS,
      appVersion: appVersionLabel(),
    });

    if (Platform.OS === 'android') {
      await checkAndroidInstallReferrer();
    } else if (Platform.OS === 'ios') {
      await checkIosClipboardInvite();
    }

    await maybeSendFirstOpen();
  } catch (error) {
    logger.error('[DeferredReferral] unexpected error:', error);
  }
}

export function parsePlayReferrerPayload(
  raw: string | null | undefined,
): { code: string; clickId: string | null } | null {
  if (!raw) return null;
  const match = PLAY_REFERRER_RE.exec(raw);
  if (!match?.[1]) return null;
  const code = normalizeReferralCode(match[1]);
  if (!isValidReferralCode(code)) return null;
  return { code, clickId: match[2]?.trim() || null };
}

export function parseIosClipboardPayload(
  raw: string | null | undefined,
): { code: string; clickId: string | null } | null {
  if (!raw) return null;
  const match = IOS_INVITE_CLIPBOARD_RE.exec(String(raw).trim());
  if (!match?.[1]) return null;
  const code = normalizeReferralCode(match[1]);
  if (!isValidReferralCode(code)) return null;
  return { code, clickId: match[2]?.trim() || null };
}

async function checkAndroidInstallReferrer(): Promise<void> {
  const alreadyChecked = await AsyncStorage.getItem(CHECKED_KEY);
  if (alreadyChecked) return;

  try {
    const referrerPromise = Application.getInstallReferrerAsync();
    const soft = await Promise.race([
      referrerPromise.then((raw) => ({ timedOut: false as const, raw })),
      sleep(ANDROID_REFERRER_SOFT_MS).then(() => ({ timedOut: true as const })),
    ]);
    const raw = soft.timedOut === false ? soft.raw : await referrerPromise;

    const parsed = parsePlayReferrerPayload(raw);
    logger.info('[DeferredReferral] referral_capture_result', {
      source: 'play_referrer',
      found: Boolean(parsed),
      reason: parsed ? 'invite' : (raw ?? '').trim() ? 'organic' : 'empty',
      platform: 'android',
      appVersion: appVersionLabel(),
    });

    if (parsed) {
      await capturePendingReferral(parsed.code, {
        clickId: parsed.clickId,
        source: 'deferred',
      });
      await markDefinitiveChecked();
      return;
    }

    // Non-empty organic referrer will not become an invite — lock out.
    if ((raw ?? '').trim()) {
      await markDefinitiveChecked();
      return;
    }

    // Empty / unavailable — inconclusive, retry next launch.
    await bumpInconclusive();
  } catch (error) {
    logger.error('[DeferredReferral] install referrer check failed:', error);
    await bumpInconclusive();
  }
}

async function checkIosClipboardInvite(): Promise<void> {
  const alreadyChecked = await AsyncStorage.getItem(CHECKED_KEY);
  if (alreadyChecked) return;

  try {
    const hasText = await Clipboard.hasStringAsync();
    if (!hasText) {
      logger.info('[DeferredReferral] referral_capture_result', {
        source: 'clipboard',
        found: false,
        reason: 'empty',
        platform: 'ios',
        appVersion: appVersionLabel(),
      });
      await bumpInconclusive();
      return;
    }

    const raw = await Clipboard.getStringAsync();
    const parsed = parseIosClipboardPayload(raw);

    if (parsed) {
      logger.info('[DeferredReferral] referral_capture_result', {
        source: 'clipboard',
        found: true,
        reason: 'invite',
        platform: 'ios',
        appVersion: appVersionLabel(),
      });
      await capturePendingReferral(parsed.code, {
        clickId: parsed.clickId,
        source: 'clipboard',
      });
      await Clipboard.setStringAsync('');
      await markDefinitiveChecked();
      return;
    }

    // Readable non-invite text — definitive organic.
    if ((raw ?? '').trim()) {
      logger.info('[DeferredReferral] referral_capture_result', {
        source: 'clipboard',
        found: false,
        reason: 'non_invite_text',
        platform: 'ios',
        appVersion: appVersionLabel(),
      });
      await markDefinitiveChecked();
      return;
    }

    await bumpInconclusive();
  } catch (error) {
    // Paste denial / transient — inconclusive.
    logger.error('[DeferredReferral] clipboard check failed:', error);
    await bumpInconclusive();
  }
}
