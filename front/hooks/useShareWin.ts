/**
 * Share & Win data + actions — شارك واربح
 *
 * Owns the screen's server state (React Query, matching the rest of the app)
 * and the share flow. The share sheet is never blocked on the network: the
 * user shares first, and the backend is told afterwards.
 */

import { useCallback, useRef } from 'react';
import { Platform, Share } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';

import { buildReferralSharePayload } from '../constants/shareLinks';
import { useXp } from '../contexts/XpContext';
import { claimAppShareReward } from '../services/appShare.service';
import {
  claimReferralCode,
  fetchShareWinOverview,
  recordShareEvent,
  type ShareWinOverview,
} from '../services/shareWin.service';
import { toastManager } from '../services/toastManager';
import { useTranslation } from '../src/i18n';
import { getClerkBearerToken } from '../utils/clerkAuthToken';
import { logger } from '../utils/logger';
import { confirmExternalShare, isCopyShareActivity, watchShareHandoff } from '../utils/confirmExternalShare';
import {
  clearPendingReferral,
  getPendingReferral,
  hasClaimedReferral,
} from '../utils/pendingReferral';

export const SHARE_WIN_QUERY_KEY = ['share-win', 'me'] as const;

/** Channels the screen can attribute a share to. */
export type ShareChannel =
  | 'system'
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'snapchat'
  | 'copy_link';

export function useShareWin() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { handleXpEvents, refresh: refreshXp } = useXp();

  const query = useQuery<ShareWinOverview>({
    queryKey: SHARE_WIN_QUERY_KEY,
    queryFn: async () => {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) throw new Error('AUTH_REQUIRED');
      return fetchShareWinOverview(token);
    },
    enabled: isLoaded === true && isSignedIn === true,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') return false;
      return failureCount < 2;
    },
  });

  /**
   * Report a completed share and refresh the stats. Failures are swallowed —
   * the share itself already happened, and the count reconciles on next load.
   *
   * Also claims the app's pre-existing app-share XP reward (10 XP / 24h). That
   * reward used to be triggered from the Rank card that now opens this screen,
   * so routing it through here keeps it live rather than orphaning it. The
   * backend enforces its own cooldown, so calling it on every share is safe.
   */
  const trackShare = useCallback(
    async (channel: ShareChannel): Promise<boolean> => {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return false;

      const result = await recordShareEvent(token, channel);
      if (result?.counted) {
        await queryClient.invalidateQueries({ queryKey: SHARE_WIN_QUERY_KEY });
      } else {
        logger.debug('[ShareWin] Share not recorded — will reconcile on next load');
      }

      try {
        const claim = await claimAppShareReward(token);
        if (claim && claim.awarded > 0 && claim.xpEvents?.length) {
          await handleXpEvents(claim.xpEvents);
          void refreshXp();
        }
      } catch (error) {
        logger.debug('[ShareWin] App-share XP claim skipped:', error);
      }

      return Boolean(result?.counted);
    },
    [handleXpEvents, queryClient, refreshXp],
  );

  /**
   * Open the OS share sheet with the user's referral link, then record it.
   * Cancelling the sheet records nothing.
   */
  const shareReferral = useCallback(
    async (lang: 'ar' | 'en', channel: ShareChannel = 'system') => {
      const code = query.data?.referralCode;
      if (!code) return;

      const handoff = watchShareHandoff();
      try {
        const payload = buildReferralSharePayload(code, lang);
        const result = await Share.share(
          Platform.OS === 'ios'
            ? { message: payload.message, url: undefined }
            : payload,
          { dialogTitle: payload.title },
        );

        if (result.action !== Share.sharedAction) return;
        // iOS reports a completed share with an activity type. A missing type
        // or the pasteboard activity is a cancel / copy, not a share.
        if (Platform.OS === 'ios') {
          if (!result.activityType || isCopyShareActivity(result.activityType)) return;
        } else {
          // Android fires sharedAction on cancel. Opening the sheet can set
          // `inactive` without leaving — only a real app switch counts.
          if (!handoff.didLeave()) {
            const left = await confirmExternalShare(800, ['background']);
            if (!left) return;
          }
        }
        await trackShare(channel);
      } catch (error) {
        logger.debug('[ShareWin] Share sheet dismissed:', error);
      } finally {
        handoff.stop();
      }
    },
    [query.data?.referralCode, trackShare],
  );

  /** Copy the referral link so the user can paste it. Copying is not a share. */
  const copyReferralLink = useCallback(async () => {
    const link = query.data?.referralLink;
    if (!link) return;

    try {
      await Clipboard.setStringAsync(link);
      toastManager.showSuccess(
        t.shareWin?.linkCopied ?? 'Link copied',
        t.shareWin?.linkCopiedDetail ?? '',
      );
    } catch (error) {
      logger.warn('[ShareWin] Copy failed:', error);
      toastManager.showError(t.common?.error ?? 'Error', t.shareWin?.copyFailed ?? '');
    }
  }, [query.data?.referralLink, t]);

  return {
    overview: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    shareReferral,
    copyReferralLink,
    trackShare,
  };
}

/**
 * Redeem a referral code parked by a deep link, once the user is signed in and
 * their backend account exists. Safe to call repeatedly — a claimed device is
 * short-circuited locally and the backend enforces one referrer per user.
 */
export async function redeemPendingReferral(
  getTokenFn: Parameters<typeof getClerkBearerToken>[0],
): Promise<boolean> {
  try {
    if (await hasClaimedReferral()) return false;

    const code = await getPendingReferral();
    if (!code) return false;

    const token = await getClerkBearerToken(getTokenFn);
    if (!token) return false; // Keep the code parked until we can authenticate.

    const result = await claimReferralCode(token, code);
    if (!result) return false; // Network failure — retry on the next launch.

    // Anything other than a transport failure is final: either it converted, or
    // it never will (self-referral, existing user, already attributed).
    await clearPendingReferral(result.attributed);
    logger.debug(`[Referral] Claim result: ${result.reason}`);
    return result.attributed;
  } catch (error) {
    logger.warn('[Referral] Claim failed:', error);
    return false;
  }
}
