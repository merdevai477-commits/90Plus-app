import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';

import { useXp } from '../contexts/XpContext';
import { syncNextPendingCelebration } from '../utils/levelUpCelebration.sync';
import { FIRST_CELEBRATION_LEVEL } from '../utils/levelUpCelebration.storage';
import { presentPendingLevelUpCelebration } from '../utils/presentPendingLevelUpCelebration';

/** Extra trigger when Profile / Rank is opened (backfill + pending). */
export function useLevelUpCelebrationOnFocus(): void {
  const { isSignedIn, userId } = useAuth();
  const { level, loading } = useXp();
  const levelRef = useRef(level);
  const loadingRef = useRef(loading);
  levelRef.current = level;
  loadingRef.current = loading;

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn || !userId || loadingRef.current || levelRef.current < FIRST_CELEBRATION_LEVEL) {
        return;
      }

      let cancelled = false;

      const run = async () => {
        await syncNextPendingCelebration(userId, levelRef.current);
        if (!cancelled) await presentPendingLevelUpCelebration(userId);
      };

      void run();

      return () => {
        cancelled = true;
      };
    }, [isSignedIn, userId]),
  );
}
