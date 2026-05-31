import {
  baselineCelebratedLevel,
  getCelebratedLevel,
  queueLevelUpCelebration,
  FIRST_CELEBRATION_LEVEL,
} from './levelUpCelebration.storage';

export function titleForLevel(level: number): string {
  if (level >= 50) return 'Hall of Fame';
  if (level >= 20) return 'Icon';
  if (level >= 10) return 'Legend';
  if (level >= 5) return 'Star';
  if (level >= 3) return 'Striker';
  if (level >= 2) return 'Captain';
  return 'Rookie';
}

/** Queue the next uncelebrated level (first popup is always 1 → 2). */
export async function syncNextPendingCelebration(
  userId: string,
  currentLevel: number,
): Promise<void> {
  if (currentLevel < FIRST_CELEBRATION_LEVEL) return;

  const celebrated = baselineCelebratedLevel(await getCelebratedLevel(userId));
  if (celebrated >= currentLevel) return;

  const nextLevel = celebrated + 1;
  await queueLevelUpCelebration(userId, {
    previousLevel: nextLevel - 1,
    newLevel: nextLevel,
    newTitle: titleForLevel(nextLevel),
  });
}
