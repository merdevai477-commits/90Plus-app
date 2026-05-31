import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';

import { useXp } from '../contexts/XpContext';
import { syncNextPendingCelebration } from '../utils/levelUpCelebration.sync';
import { presentPendingLevelUpCelebration } from '../utils/presentPendingLevelUpCelebration';

/** Extra trigger when Profile / Rank is opened (backfill + pending). */
export function useLevelUpCelebrationOnFocus(): void {
  const { isSignedIn, userId } = useAuth();
  const { level, loading } = useXp();

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn || !userId || loading || level <= 1) return;

      let cancelled = false;

      const run = async () => {
        await syncNextPendingCelebration(userId, level);
        if (!cancelled) await presentPendingLevelUpCelebration(userId);
      };

      void run();

      return () => {
        cancelled = true;
      };
    }, [isSignedIn, userId, level, loading]),
  );
}
