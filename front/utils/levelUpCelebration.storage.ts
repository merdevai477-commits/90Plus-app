import AsyncStorage from '@react-native-async-storage/async-storage';

/** Player levels start at 1 — the first popup is 1 → 2. */
export const MIN_PLAYER_LEVEL = 1;
export const FIRST_CELEBRATION_LEVEL = 2;

export interface StoredLevelUpEvent {
  previousLevel: number;
  newLevel: number;
  newTitle: string;
}

/** Treat storage 0 as "still on baseline level 1" (no celebration yet). */
export function baselineCelebratedLevel(celebrated: number): number {
  return Math.max(celebrated, MIN_PLAYER_LEVEL);
}

export function isValidLevelUpEvent(event: StoredLevelUpEvent): boolean {
  return (
    event.newLevel >= FIRST_CELEBRATION_LEVEL &&
    event.previousLevel >= MIN_PLAYER_LEVEL &&
    event.previousLevel === event.newLevel - 1
  );
}

function seenKey(userId: string): string {
  return `@level_up_seen_v1_${userId}`;
}

function pendingKey(userId: string): string {
  return `@level_up_pending_v1_${userId}`;
}

export async function getCelebratedLevel(userId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(seenKey(userId));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function markLevelCelebrated(userId: string, level: number): Promise<void> {
  try {
    const current = await getCelebratedLevel(userId);
    if (level > current) {
      await AsyncStorage.setItem(seenKey(userId), String(level));
    }
  } catch {
    // ignore
  }
}

export async function queueLevelUpCelebration(
  userId: string,
  event: StoredLevelUpEvent,
): Promise<void> {
  try {
    if (!isValidLevelUpEvent(event)) return;
    const celebrated = baselineCelebratedLevel(await getCelebratedLevel(userId));
    if (event.newLevel <= celebrated) return;
    await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(event));
  } catch {
    // ignore
  }
}

export async function getPendingLevelUpCelebration(
  userId: string,
): Promise<StoredLevelUpEvent | null> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLevelUpEvent;
    if (
      typeof parsed?.newLevel !== 'number' ||
      typeof parsed?.previousLevel !== 'number' ||
      typeof parsed?.newTitle !== 'string' ||
      !isValidLevelUpEvent(parsed)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingLevelUpCelebration(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(pendingKey(userId));
  } catch {
    // ignore
  }
}

/** Returns pending event if user has not celebrated this level yet. */
export async function consumePendingLevelUpCelebration(
  userId: string,
): Promise<StoredLevelUpEvent | null> {
  const pending = await getPendingLevelUpCelebration(userId);
  if (!pending) return null;
  const celebrated = baselineCelebratedLevel(await getCelebratedLevel(userId));
  if (pending.newLevel <= celebrated) {
    await clearPendingLevelUpCelebration(userId);
    return null;
  }
  return pending;
}

export async function acknowledgeLevelUpCelebration(
  userId: string,
  level: number,
): Promise<void> {
  await markLevelCelebrated(userId, level);
  await clearPendingLevelUpCelebration(userId);
}
