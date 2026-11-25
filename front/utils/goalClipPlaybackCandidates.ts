import {
  assignGoalClips,
  clipMatchesPlayer,
  clipMinute,
  minuteAgrees,
  type GoalClipMedia,
} from './assignGoalClips';
import {
  collectHighlightClipPlaybackUrls,
  filterSupportedHighlightPlaybackUrls,
  isSupportedHighlightPlaybackUrl,
  preferDirectHighlightUrls,
} from './highlightPlaybackUrl';

type GoalEvent = {
  type: string;
  time?: { elapsed?: number | null } | null;
  player?: { name?: string | null } | null;
};

function clipPlayUrl(clip: GoalClipMedia | null | undefined): string {
  return collectHighlightClipPlaybackUrls(clip || {}).find((url) =>
    isSupportedHighlightPlaybackUrl(url),
  )
    || collectHighlightClipPlaybackUrls(clip || {})[0]
    || '';
}

/**
 * Ordered playback URLs for one goal event within a single fixture's clip list.
 * Primary assigned clip first (url + embedUrl + playbackUrls), then same-event
 * alternatives. Unsupported hosts never rank ahead of Streamin/YouTube.
 */
export function buildGoalClipPlaybackCandidates(
  events: GoalEvent[],
  eventIndex: number,
  fixtureClips: GoalClipMedia[],
): string[] {
  const event = events[eventIndex];
  if (!event || event.type !== 'Goal') return [];

  const assigned = assignGoalClips(events, fixtureClips);
  const primary = assigned[eventIndex];
  const urls: string[] = [];
  const seen = new Set<string>();

  const pushUrl = (raw: string, requireSupported = false) => {
    const url = raw.trim();
    if (!url || seen.has(url)) return;
    if (requireSupported && !isSupportedHighlightPlaybackUrl(url)) return;
    seen.add(url);
    urls.push(url);
  };

  if (primary) {
    const primaryUrls = collectHighlightClipPlaybackUrls(primary);
    for (const candidate of primaryUrls) pushUrl(candidate, true);
    for (const candidate of primaryUrls) pushUrl(candidate, false);
  }

  const urlsAssignedElsewhere = new Set(
    assigned.flatMap((clip, index) => {
      if (index === eventIndex || !clip) return [];
      const url = clipPlayUrl(clip);
      return url ? [url] : [];
    }),
  );

  const alternates = fixtureClips.filter((clip) => {
    const url = clipPlayUrl(clip);
    if (!url || urlsAssignedElsewhere.has(url)) return false;
    if (primary && clipPlayUrl(primary) === url) return false;
    return clipMatchesSameEvent(clip, event);
  });

  const supported = alternates.filter((clip) =>
    isSupportedHighlightPlaybackUrl(clipPlayUrl(clip)),
  );
  const unsupported = alternates.filter(
    (clip) => !isSupportedHighlightPlaybackUrl(clipPlayUrl(clip)),
  );

  for (const clip of supported) {
    for (const candidate of collectHighlightClipPlaybackUrls(clip)) pushUrl(candidate, true);
  }
  for (const clip of unsupported) {
    for (const candidate of collectHighlightClipPlaybackUrls(clip)) pushUrl(candidate, false);
  }

  // Prefer playable sources; keep a tiny unsupported tail only if nothing else exists.
  const playable = filterSupportedHighlightPlaybackUrls(urls);
  return playable.length ? playable : preferDirectHighlightUrls(urls);
}

function clipMatchesSameEvent(clip: GoalClipMedia, event: GoalEvent): boolean {
  const elapsed = event.time?.elapsed;
  const playerName = event.player?.name ?? '';
  const playerOk = playerName ? clipMatchesPlayer(clip, playerName) : false;
  const minute = clipMinute(clip);

  if (playerOk && minuteAgrees(clip, elapsed)) return true;
  if (minute != null && elapsed != null && minute === elapsed) return true;
  return false;
}
