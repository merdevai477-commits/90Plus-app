import { emitLevelUpCelebration } from '../contexts/XpContext';
import { consumePendingLevelUpCelebration } from './levelUpCelebration.storage';

/** Consume stored pending level-up and show the modal immediately. */
export async function presentPendingLevelUpCelebration(userId: string): Promise<void> {
  const pending = await consumePendingLevelUpCelebration(userId);
  if (pending) emitLevelUpCelebration(pending);
}
