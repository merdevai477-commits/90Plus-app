import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

import { buildAppShareMessage, buildAppShareUrl } from '../constants/shareLinks';
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

export function useAppShareReward() {
  const { getToken } = useAuth();
  const { handleXpEvents, refresh } = useXp();
  const { t } = useTranslation();
  const [shareStatus, setShareStatus] = useState<AppShareStatus | null>(null);

  const loadShareStatus = useCallback(async () => {
    const token = await getClerkBearerToken(getToken);
    if (!token) {
      setShareStatus(null);
      return;
    }
    const status = await fetchAppShareStatus(token);
    setShareStatus(status);
  }, [getToken]);

  const shareAppAndClaim = useCallback(
    async (lang: 'ar' | 'en') => {
      try {
        const message = buildAppShareMessage(lang);
        const appUrl = buildAppShareUrl();
        const result = await Share.share({
          message,
          url: appUrl,
          title: '90Plus',
        });

        if (result.action !== Share.sharedAction) {
          return;
        }

        const token = await getClerkBearerToken(getToken);
        if (!token) return;

        const claim = await claimAppShareReward(token);
        await loadShareStatus();

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
    [getToken, handleXpEvents, loadShareStatus, refresh, t],
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
