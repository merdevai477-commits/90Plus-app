/**
 * Deferred referral attribution — Share & Win
 *
 * Android: Play Install Referrer (`referrer=invite_CODE` from the landing page).
 * iOS: clipboard safety net (`90plus-invite:CODE` copied on the download tap).
 *
 * Parks the code via capturePendingReferral so redeemPendingReferral can claim
 * it after registration. Does not override first-link-wins pending storage.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';

import { isValidReferralCode, normalizeReferralCode } from '../constants/shareLinks';
import { capturePendingReferral } from './pendingReferral';
import { logger } from './logger';

const CHECKED_KEY = '@90plus:deferred_referral_checked';

/** Play may return `invite_AB23CD` alone or mixed with utm_* params. */
const INVITE_REFERRER_RE = /invite_([A-Za-z0-9]+)/;

/** Exact payload written by the iOS landing "تحميل التطبيق" button. */
const IOS_INVITE_CLIPBOARD_RE = /^90plus-invite:([A-Z0-9]{6})$/;

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
    const raw = await Application.getInstallReferrerAsync();

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
