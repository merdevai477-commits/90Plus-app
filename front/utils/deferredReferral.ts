/**
 * Android deferred referral — Share & Win
 *
 * When a visitor opens /invite/CODE without the app, the landing page sends
 * them to Play Store with `referrer=invite_CODE`. After install, this module
 * reads that referrer once and parks the code via capturePendingReferral so
 * redeemPendingReferral can claim it after registration.
 *
 * iOS is intentionally untouched (Platform.OS !== 'android' returns immediately).
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

import { isValidReferralCode, normalizeReferralCode } from '../constants/shareLinks';
import { capturePendingReferral } from './pendingReferral';
import { logger } from './logger';

const CHECKED_KEY = '@90plus:deferred_referral_checked';

/** Play may return `invite_AB23CD` alone or mixed with utm_* params. */
const INVITE_REFERRER_RE = /invite_([A-Za-z0-9]+)/;

/**
 * One-shot Install Referrer → pending referral capture.
 * Never throws. Does not override an already-parked first-link-wins code.
 */
export async function checkDeferredReferral(): Promise<void> {
  try {
    if (Platform.OS !== 'android') return;

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
        // first-link-wins: capturePendingReferral no-ops if a pending code exists
        await capturePendingReferral(parsed);
      }

      // Mark done only after a successful read (including "no invite referrer").
      await AsyncStorage.setItem(CHECKED_KEY, String(Date.now()));
    } catch (error) {
      // Do NOT set CHECKED_KEY — transient Play Store / API errors retry next launch.
      // TODO: remove temporary debug logging after real-device verification
      logger.debug('[DeferredReferral] install referrer check failed:', error);
    }
  } catch (error) {
    // TODO: remove temporary debug logging after real-device verification
    logger.debug('[DeferredReferral] unexpected error:', error);
  }
}
