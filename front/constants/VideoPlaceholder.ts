/**
 * VideoPlaceholder
 *
 * Helpers for dealing with reel thumbnail URLs in lists.
 * If a reel doesn't have a real thumbnail (or the thumbnail URL is the raw
 * video URL, or is obviously a placeholder), we fall back to a branded
 * placeholder style so the grid never shows a broken image.
 */

/**
 * Styling tokens for the "no thumbnail" placeholder tile.
 * Exposed as an object so call sites can spread `.backgroundColor` into
 * a View style (instead of rendering a broken remote image URL).
 */
export const VIDEO_THUMBNAIL_PLACEHOLDER = {
  /** Background color of the placeholder tile (matches reel dark surfaces). */
  backgroundColor: '#1A1A1A',
  /** Icon tint inside the placeholder. */
  iconColor: '#666666',
  /** Label color inside the placeholder. */
  labelColor: '#999999',
} as const;

/**
 * Decide whether the given thumbnail URL looks like a valid still image.
 * Rejects:
 *  - missing/empty strings
 *  - Mux HLS URLs (.m3u8) and raw Mux stream URLs — those play as video,
 *    not as a static thumbnail
 *  - .mp4 / .mov / .m3u8 paths in general
 *  - obvious placeholder strings ("null", "undefined")
 */
export function isValidThumbnail(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();

  if (lower === 'null' || lower === 'undefined') return false;

  // Raw Mux playback URLs — these are HLS streams, not still images.
  if (lower.includes('stream.mux.com') || lower.endsWith('.m3u8')) return false;

  // Raw video URLs.
  if (/\.(mp4|mov|m4v|webm|3gp)(\?|$)/.test(lower)) return false;

  // Anything else (http(s) image URL, data URL, or local file) is assumed
  // to be a real image.
  return /^(https?:|data:|file:)/.test(lower);
}
