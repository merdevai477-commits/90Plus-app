/**
 * Phone reels are full-screen vertical video. A 1080p+ HLS ladder makes the
 * first Mux segment large, which is the main reason iOS AVPlayer sits on the
 * spinner. Cap the ladder at 720p — still sharp on a phone, much faster to start.
 */
const MUX_MAX_RESOLUTION = '720p';

export function optimizeReelPlaybackUrl(url: string): string {
  if (!url || !url.includes('stream.mux.com')) return url;
  if (/\.mp4(?:\?|$)/i.test(url)) return url;
  if (/[?&]max_resolution=/.test(url)) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}max_resolution=${MUX_MAX_RESOLUTION}`;
}
