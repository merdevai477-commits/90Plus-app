export interface GoalClipMedia {
  title: string;
  description?: string | null;
  url: string;
  embedUrl?: string | null;
  thumbnail?: string | null;
}

type GoalEvent = {
  type: string;
  player?: { name?: string | null } | null;
};

function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function clipMatchesPlayer(clip: GoalClipMedia, playerName: string): boolean {
  const haystack = foldName(`${clip.title} ${clip.description ?? ''}`);
  if (!haystack) return false;
  const tokens = playerName
    .split(/[^\p{L}\p{N}]+/u)
    .map(foldName)
    .filter((token) => token.length >= 4);
  return tokens.some((token) => haystack.includes(token));
}

/**
 * Pair published goal videos with goal events.
 * A name match wins. Leftover clips are used only when they line up 1:1
 * with the goals that are still unmatched, so a single extra clip is not
 * stuck on the wrong goal.
 */
export function assignGoalClips(events: GoalEvent[], clips: GoalClipMedia[]): Array<GoalClipMedia | null> {
  const assigned: Array<GoalClipMedia | null> = events.map(() => null);
  const usable = clips.filter((clip) => clip.url || clip.embedUrl);
  const used = new Set<number>();
  const goalIndexes = events.flatMap((event, index) => (event.type === 'Goal' ? [index] : []));

  for (const index of goalIndexes) {
    const playerName = events[index]?.player?.name ?? '';
    const clipIndex = usable.findIndex(
      (clip, candidate) => !used.has(candidate) && clipMatchesPlayer(clip, playerName),
    );
    if (clipIndex < 0) continue;
    used.add(clipIndex);
    assigned[index] = usable[clipIndex];
  }

  const openGoals = goalIndexes.filter((index) => assigned[index] == null);
  const openClips = usable.filter((_, index) => !used.has(index));
  if (openGoals.length > 0 && openGoals.length === openClips.length) {
    openGoals.forEach((eventIndex, offset) => {
      assigned[eventIndex] = openClips[offset];
    });
  }

  return assigned;
}
