import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';

import { presentPendingLevelUpCelebration } from '../utils/presentPendingLevelUpCelebration';

/**
 * Presents the level-up celebration modal once per level when the user
 * opens Profile or Rank — not on every app screen.
 */
export function useLevelUpCelebrationOnFocus(): void {
  const { isSignedIn, userId } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!isSignedIn || !userId) return;

      let cancelled = false;

      const tryPresent = async () => {
        if (cancelled) return;
        await presentPendingLevelUpCelebration(userId);
      };

      void tryPresent();

      return () => {
        cancelled = true;
      };
    }, [isSignedIn, userId]),
  );
}
