export interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

const levelUpQueue: LevelUpEvent[] = [];
const levelUpListeners: Array<(event: LevelUpEvent) => void> = [];

export function subscribeLevelUp(listener: (event: LevelUpEvent) => void): () => void {
  levelUpListeners.push(listener);
  return () => {
    const idx = levelUpListeners.indexOf(listener);
    if (idx >= 0) levelUpListeners.splice(idx, 1);
  };
}

function emitLevelUp(event: LevelUpEvent): void {
  if (levelUpListeners.length > 0) {
    levelUpListeners.forEach((l) => l(event));
  } else {
    levelUpQueue.push(event);
  }
}

/** Show modal immediately (after profile/rank focus consumed pending). */
export function emitLevelUpCelebration(event: LevelUpEvent): void {
  emitLevelUp(event);
}

export function drainLevelUpQueue(): LevelUpEvent | undefined {
  return levelUpQueue.shift();
}

export function enqueueLevelUpEvent(event: LevelUpEvent): void {
  levelUpQueue.push(event);
}
