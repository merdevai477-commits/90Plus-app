import { useCallback, useRef, useState } from 'react';
import { Share } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

import { buildAppSharePayload } from '../constants/shareLinks';
import { useXp } from '../contexts/XpContext';
import { toastManager } from '../services/toastManager';
import {
  claimAppShareReward,
  fetchAppShareStatus,
  formatShareCooldown,
  type AppShareStatus,
} from '../services/appShare.service';
import { useTranslation } from '../src/i18n';
import { getClerkBearerToken } from '../utils/clerkAuthToken';

/** Avoid hammering /xp/app-share/status when Rank refocuses or re-renders. */
const APP_SHARE_STATUS_MIN_INTERVAL_MS = 60_000;
let lastAppShareStatusFetchAt = 0;
let appShareStatusInFlight: Promise<AppShareStatus | null> | null = null;

export function useAppShareReward() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const { handleXpEvents, refresh } = useXp();
  const { t } = useTranslation();
  const [shareStatus, setShareStatus] = useState<AppShareStatus | null>(null);

  const loadShareStatus = useCallback(async (options?: { force?: boolean }) => {
    const now = Date.now();
    if (!options?.force && now - lastAppShareStatusFetchAt < APP_SHARE_STATUS_MIN_INTERVAL_MS) {
      return;
    }
    if (!options?.force && appShareStatusInFlight) {
      const status = await appShareStatusInFlight;
      if (status) setShareStatus(status);
      return;
    }

    const run = (async () => {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) {
        setShareStatus(null);
        return null;
      }
      const status = await fetchAppShareStatus(token);
      lastAppShareStatusFetchAt = Date.now();
      setShareStatus(status);
      return status;
    })();

    appShareStatusInFlight = run;
    try {
      await run;
    } finally {
      appShareStatusInFlight = null;
    }
  }, []);

  const shareAppAndClaim = useCallback(
    async (lang: 'ar' | 'en') => {
      try {
        const result = await Share.share(buildAppSharePayload(lang));

        if (result.action !== Share.sharedAction) {
          return;
        }

        const token = await getClerkBearerToken(getTokenRef.current);
        if (!token) return;

        const claim = await claimAppShareReward(token);
        await loadShareStatus({ force: true });

        if (!claim) {
          toastManager.showError(t.common.error, t.rank.shareRewardFailed);
          return;
        }

        if (claim.awarded > 0 && claim.xpEvents?.length) {
          await handleXpEvents(claim.xpEvents);
          toastManager.showSuccess(
            t.rank.shareRewardEarned.replace('{amount}', String(claim.awarded)),
            t.rank.shareRewardEarnedDetail,
          );
          void refresh();
          return;
        }

        const cooldown = formatShareCooldown(claim.nextEligibleAt);
        if (cooldown) {
          toastManager.showInfo(
            t.rank.shareRewardCooldown,
            t.rank.shareRewardCooldownDetail
              .replace('{hours}', String(cooldown.hours))
              .replace('{minutes}', String(cooldown.minutes)),
          );
        }
      } catch {
        // User cancelled share sheet
      }
    },
    [handleXpEvents, loadShareStatus, refresh, t],
  );

  const shareRewardHint = useCallback((): string | undefined => {
    if (!shareStatus) return undefined;
    if (shareStatus.eligible) {
      return t.rank.shareRewardAvailable.replace('{amount}', String(shareStatus.rewardXp));
    }
    const cooldown = formatShareCooldown(shareStatus.nextEligibleAt);
    if (!cooldown) return undefined;
    return t.rank.shareRewardWait
      .replace('{hours}', String(cooldown.hours))
      .replace('{minutes}', String(cooldown.minutes));
  }, [shareStatus, t]);

  return {
    shareStatus,
    loadShareStatus,
    shareAppAndClaim,
    shareRewardHint,
  };
}
