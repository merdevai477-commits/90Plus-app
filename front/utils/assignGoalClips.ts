export interface GoalClipMedia {
  title: string;
  description?: string | null;
  url: string;
  embedUrl?: string | null;
  thumbnail?: string | null;
}

type GoalEvent = {
  type: string;
  time?: { elapsed?: number | null } | null;
  player?: { name?: string | null } | null;
};

function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function clipText(clip: GoalClipMedia): string {
  return `${clip.title} ${clip.description ?? ''}`;
}

export function clipMinute(clip: GoalClipMedia): number | null {
  const matches = clipText(clip).match(/\b(\d{1,3})\b/g);
  if (!matches?.length) return null;
  const minute = Number(matches[matches.length - 1]);
  return minute >= 1 && minute <= 130 ? minute : null;
}

export function clipMatchesPlayer(clip: GoalClipMedia, playerName: string): boolean {
  const haystack = foldName(clipText(clip));
  if (!haystack) return false;
  const tokens = playerName
    .split(/[^\p{L}\p{N}]+/u)
    .map(foldName)
    .filter((token) => token.length >= 4);
  return tokens.some((token) => haystack.includes(token));
}

export function minuteAgrees(clip: GoalClipMedia, elapsed: number | null | undefined): boolean {
  const minute = clipMinute(clip);
  if (minute == null || elapsed == null) return true;
  return minute === elapsed;
}

/**
 * Pair published goal videos with goal events.
 * A clip that names a minute only goes on the goal from that minute, so two
 * goals by the same player do not share one video. Leftover clips are used
 * only when they line up 1:1 with the goals still unmatched.
 */
export function assignGoalClips(events: GoalEvent[], clips: GoalClipMedia[]): Array<GoalClipMedia | null> {
  const assigned: Array<GoalClipMedia | null> = events.map(() => null);
  const usable = clips.filter((clip) => clip.url || clip.embedUrl);
  const used = new Set<number>();
  const goalIndexes = events.flatMap((event, index) => (event.type === 'Goal' ? [index] : []));

  for (const index of goalIndexes) {
    const event = events[index];
    const elapsed = event?.time?.elapsed;
    const candidates = usable.flatMap((clip, candidate) => {
      if (used.has(candidate)) return [];
      if (!minuteAgrees(clip, elapsed)) return [];
      if (!clipMatchesPlayer(clip, event?.player?.name ?? '')) return [];
      return [{ clip, candidate, exactMinute: clipMinute(clip) != null && clipMinute(clip) === elapsed }];
    });
    const exact = candidates.filter((candidate) => candidate.exactMinute);
    const pick = exact.length === 1 ? exact[0] : exact.length === 0 && candidates.length === 1 ? candidates[0] : null;
    if (!pick) continue;
    used.add(pick.candidate);
    assigned[index] = pick.clip;
  }

  const openClips = usable
    .map((clip, index) => ({ clip, index, minute: clipMinute(clip) }))
    .filter((entry) => !used.has(entry.index) && entry.minute != null);

  const assignUniqueMinutes = (tolerance: number) => {
    const goalsLeft = goalIndexes.filter((index) => assigned[index] == null);
    const clipsLeft = openClips.filter((entry) => !used.has(entry.index));
    const pairs: Array<{ goalIndex: number; clipIndex: number }> = [];
    for (const goalIndex of goalsLeft) {
      const elapsed = events[goalIndex]?.time?.elapsed;
      if (elapsed == null) continue;
      for (const entry of clipsLeft) {
        if (Math.abs((entry.minute as number) - elapsed) <= tolerance) {
          pairs.push({ goalIndex, clipIndex: entry.index });
        }
      }
    }
    for (const goalIndex of goalsLeft) {
      const forGoal = pairs.filter((pair) => pair.goalIndex === goalIndex);
      if (forGoal.length !== 1) continue;
      const clipIndex = forGoal[0].clipIndex;
      if (used.has(clipIndex)) continue;
      const claimed = pairs.filter((pair) => pair.clipIndex === clipIndex);
      if (claimed.length !== 1) continue;
      used.add(clipIndex);
      assigned[goalIndex] = usable[clipIndex];
    }
  };

  assignUniqueMinutes(0);
  assignUniqueMinutes(1);

  const stillOpen = goalIndexes.filter((index) => assigned[index] == null);
  const stillClips = usable.filter((_, index) => !used.has(index));
  const minutesConflict = stillOpen.some((eventIndex, offset) => {
    const clip = stillClips[offset];
    if (!clip) return false;
    return !minuteAgrees(clip, events[eventIndex]?.time?.elapsed);
  });
  if (stillOpen.length > 0 && stillOpen.length === stillClips.length && !minutesConflict) {
    stillOpen.forEach((eventIndex, offset) => {
      assigned[eventIndex] = stillClips[offset];
    });
  }

  return assigned;
}
