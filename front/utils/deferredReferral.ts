/**
 * Deferred referral attribution — Share & Win
 *
 * Android: Play Install Referrer (`referrer=invite_CODE` from the landing page).
 * iOS: clipboard safety net (`90plus-invite:CODE` copied on the download tap).
 *
 * Parks the code via capturePendingReferral so redeemPendingReferral can claim
 * it after registration. Does not override first-link-wins pending storage.
 *
 * Callers that must not race registration should await ensureDeferredReferralSettled()
 * before reading pending referral state.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';

import { isValidReferralCode, normalizeReferralCode } from '../constants/shareLinks';
import { capturePendingReferral } from './pendingReferral';
import { logger } from './logger';

const CHECKED_KEY = '@90plus:deferred_referral_checked';

/** Soft wait on Play Install Referrer; read continues if this elapses. */
export const ANDROID_REFERRER_SOFT_MS = 2_000;
/** Shared settle hard cap (Android). */
export const ANDROID_DEFERRED_HARD_MS = 5_000;
/** Shared settle hard cap (iOS paste prompt). */
export const IOS_DEFERRED_HARD_MS = 30_000;

/** Play may return `invite_AB23CD` alone or mixed with utm_* params. */
const INVITE_REFERRER_RE = /invite_([A-Za-z0-9]+)/;

/** Exact payload written by the iOS landing "تحميل التطبيق" button. */
const IOS_INVITE_CLIPBOARD_RE = /^90plus-invite:([A-Z0-9]{6})$/;

let deferredSettledPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Idempotent: starts checkDeferredReferral once and returns the same promise.
 * Resolves when the check finishes or the platform hard cap elapses.
 * Never rejects.
 */
export function ensureDeferredReferralSettled(): Promise<void> {
  if (!deferredSettledPromise) {
    deferredSettledPromise = settleDeferredOnce().catch((error) => {
      // TODO: remove temporary debug logging after real-device verification
      logger.debug('[DeferredReferral] settle unexpected error:', error);
    });
  }
  return deferredSettledPromise;
}

/** Test-only: clear the cached settle promise between cases. */
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

  // If the race times out, `work` keeps running in the background.
  await Promise.race([work, sleep(hardMs)]);
}

/**
 * One-shot deferred invite → pending referral capture.
 * Never throws. Does not override an already-parked first-link-wins code.
 */
export async function checkDeferredReferral(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await checkAndroidInstallReferrer();
      return;
    }
    if (Platform.OS === 'ios') {
      await checkIosClipboardInvite();
      return;
    }
  } catch (error) {
    // TODO: remove temporary debug logging after real-device verification
    logger.debug('[DeferredReferral] unexpected error:', error);
  }
}

async function checkAndroidInstallReferrer(): Promise<void> {
  const alreadyChecked = await AsyncStorage.getItem(CHECKED_KEY);
  if (alreadyChecked) return;

  try {
    const referrerPromise = Application.getInstallReferrerAsync();

    // Soft 2s time-box: prefer a fast read; if slow, keep awaiting the same promise.
    const soft = await Promise.race([
      referrerPromise.then((raw) => ({ timedOut: false as const, raw })),
      sleep(ANDROID_REFERRER_SOFT_MS).then(() => ({ timedOut: true as const })),
    ]);

    const raw =
      soft.timedOut === false ? soft.raw : await referrerPromise;

    // TODO: remove temporary debug logging after real-device verification
    logger.debug('[DeferredReferral] raw referrer:', raw);

    const match = INVITE_REFERRER_RE.exec(raw ?? '');
    const parsed = match?.[1] ? normalizeReferralCode(match[1]) : null;

    // TODO: remove temporary debug logging after real-device verification
    logger.debug('[DeferredReferral] parsed code:', parsed);

    if (parsed && isValidReferralCode(parsed)) {
      await capturePendingReferral(parsed);
    }

    await AsyncStorage.setItem(CHECKED_KEY, String(Date.now()));
  } catch (error) {
    // Do NOT set CHECKED_KEY — transient Play Store / API errors retry next launch.
    // TODO: remove temporary debug logging after real-device verification
    logger.debug('[DeferredReferral] install referrer check failed:', error);
  }
}

async function checkIosClipboardInvite(): Promise<void> {
  const alreadyChecked = await AsyncStorage.getItem(CHECKED_KEY);
  if (alreadyChecked) return;

  try {
    // hasStringAsync does not trigger the iOS paste prompt; getStringAsync does.
    const hasText = await Clipboard.hasStringAsync();
    if (!hasText) {
      await AsyncStorage.setItem(CHECKED_KEY, String(Date.now()));
      return;
    }

    const raw = await Clipboard.getStringAsync();
    const match = IOS_INVITE_CLIPBOARD_RE.exec(raw ?? '');

    if ((raw ?? '').startsWith('90plus-invite:')) {
      // TODO: remove temporary debug logging after real-device verification
      logger.debug('[DeferredReferral] raw clipboard:', raw);
    }

    if (match) {
      const parsed = normalizeReferralCode(match[1]);
      // TODO: remove temporary debug logging after real-device verification
      logger.debug('[DeferredReferral] parsed code:', parsed);

      if (isValidReferralCode(parsed)) {
        await capturePendingReferral(parsed);
        await Clipboard.setStringAsync('');
      }
      // Invalid alphabet after regex match: leave clipboard alone.
    }
    // Non-matching clipboard content: leave clipboard alone.

    await AsyncStorage.setItem(CHECKED_KEY, String(Date.now()));
  } catch (error) {
    // Do NOT set CHECKED_KEY — paste denial / transient errors retry next launch.
    // TODO: remove temporary debug logging after real-device verification
    logger.debug('[DeferredReferral] clipboard check failed:', error);
  }
}
