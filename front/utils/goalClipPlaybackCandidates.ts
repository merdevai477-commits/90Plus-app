import {
  assignGoalClips,
  clipMatchesPlayer,
  clipMinute,
  minuteAgrees,
  type GoalClipMedia,
} from './assignGoalClips';
import {
  isDirectHighlightFile,
  resolveHighlightPlaybackUrl,
  youtubeVideoId,
} from './highlightPlaybackUrl';

type GoalEvent = {
  type: string;
  time?: { elapsed?: number | null } | null;
  player?: { name?: string | null } | null;
};

function clipPlayUrl(clip: GoalClipMedia | null | undefined): string {
  const preferred = clip?.playbackUrls?.find((url) => url.trim()) || clip?.url || clip?.embedUrl || '';
  return preferred.trim();
}

function clipCandidateUrls(clip: GoalClipMedia): string[] {
  const listed = (clip.playbackUrls || []).map((url) => url.trim()).filter(Boolean);
  const primary = clipPlayUrl(clip);
  const original = (clip.url || clip.embedUrl || '').trim();
  return [...listed, primary, original].filter((url, index, all) => url && all.indexOf(url) === index);
}

function isSupportedPlaybackUrl(url: string): boolean {
  if (!url) return false;
  if (youtubeVideoId(url)) return true;
  const resolved = resolveHighlightPlaybackUrl(url);
  return isDirectHighlightFile(resolved) || Boolean(youtubeVideoId(resolved));
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

/**
 * Ordered playback URLs for one goal event within a single fixture's clip list.
 * Primary assigned clip first, then same-event alternatives. Never pulls other fixtures.
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
    if (requireSupported && !isSupportedPlaybackUrl(url)) return;
    seen.add(url);
    urls.push(url);
  };

  // Always keep the assigned primary even if unsupported — sheet classifies honestly.
  if (primary) {
    for (const candidate of clipCandidateUrls(primary)) pushUrl(candidate, false);
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

  // Prefer supported direct/YouTube alternates after primary.
  const supported = alternates.filter((clip) => isSupportedPlaybackUrl(clipPlayUrl(clip)));
  const unsupported = alternates.filter((clip) => !isSupportedPlaybackUrl(clipPlayUrl(clip)));

  for (const clip of supported) pushUrl(clipPlayUrl(clip), false);
  for (const clip of unsupported) pushUrl(clipPlayUrl(clip), false);

  return urls;
}
