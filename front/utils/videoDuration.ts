/**
 * Video Duration Utility
 *
 * Extracts and formats video duration for display on profile thumbnails
 * and for pre-upload validation.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 * - 9.1: Show actual video duration on profile thumbnails
 * - 9.2: Extract and store correct duration from video metadata
 * - 9.3: Format as MM:SS for videos under one hour
 * - 9.4: Hide duration indicator for unknown duration (instead of showing 0:00)
 *
 * SDK 55 migration:
 * - Previously used `Audio.Sound.createAsync` from `expo-av` (removed).
 * - Now uses `createVideoPlayer` from `expo-video` which exposes `duration`
 *   on its `sourceLoad` event and `VideoPlayer.duration` property after the
 *   media has finished loading.
 */

/**
 * Duration result type
 * - null indicates unknown/unavailable duration (should hide indicator)
 * - number is duration in seconds
 */
export type DurationResult = number | null;

/**
 * Formatted duration result
 * - null indicates unknown duration (should hide indicator)
 * - string is formatted duration (e.g., "1:30", "12:05")
 */
export type FormattedDuration = string | null;

/**
 * Format duration in seconds to MM:SS format
 *
 * @param durationSeconds - Duration in seconds (can be null for unknown)
 * @returns Formatted string "MM:SS" or null if duration is unknown/invalid
 *
 * **Validates: Requirements 9.1, 9.3, 9.4**
 */
export function formatDuration(durationSeconds: DurationResult): FormattedDuration {
  if (durationSeconds === null || durationSeconds === undefined) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return null;

  const totalSeconds = Math.round(durationSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Parse "MM:SS" back to seconds. Returns null if invalid. */
export function parseDuration(formatted: FormattedDuration): DurationResult {
  if (formatted === null || formatted === undefined) return null;
  const parts = formatted.split(':');
  if (parts.length !== 2) return null;
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) return null;
  return minutes * 60 + seconds;
}

/**
 * Decide whether a duration value should be displayed.
 * "0:00" and falsy values are hidden (Requirement 9.4).
 */
export function shouldShowDuration(duration: FormattedDuration | DurationResult): boolean {
  if (duration === null || duration === undefined) return false;
  if (typeof duration === 'string') {
    if (duration === '0:00') return false;
    return duration.length > 0;
  }
  if (typeof duration === 'number') return Number.isFinite(duration) && duration > 0;
  return false;
}

/**
 * Extract duration from a remote video URL.
 *
 * Creates a throwaway `VideoPlayer`, waits for the `sourceLoad` event (which
 * carries the duration in seconds), then releases the player.
 *
 * Falls back to `null` if the module isn't available (e.g. running in Expo Go
 * without a dev build), which signals the caller to skip duration validation.
 *
 * @param videoUrl - URL of the video
 * @returns Duration in seconds, or null if it couldn't be determined
 */
export async function extractDurationFromUrl(videoUrl: string): Promise<DurationResult> {
  if (!videoUrl) return null;

  let player: any = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    // Dynamic import so that test environments without the native module
    // don't crash at module-load time.
    const ExpoVideo = await import('expo-video');
    const { createVideoPlayer } = ExpoVideo;

    if (!createVideoPlayer) return null;

    // Source that doesn't autoplay.
    player = createVideoPlayer({ uri: videoUrl });

    // Wait for `sourceLoad` (fires once metadata is ready) or fall back to
    // polling `player.duration` for up to ~5s.
    const duration = await new Promise<DurationResult>((resolve) => {
      let settled = false;
      const finish = (value: DurationResult) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      // Primary path: sourceLoad event carries the duration.
      try {
        const subscription = player.addListener('sourceLoad', (payload: { duration?: number }) => {
          subscription?.remove?.();
          const d = typeof payload?.duration === 'number' ? payload.duration : null;
          finish(d && Number.isFinite(d) && d > 0 ? d : null);
        });
      } catch {
        /* listener not supported — fall through to polling */
      }

      // Fallback path: poll player.duration for up to 5 seconds.
      const pollStarted = Date.now();
      const tick = () => {
        if (settled) return;
        const d = player?.duration;
        if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
          finish(d);
          return;
        }
        if (Date.now() - pollStarted > 5000) {
          finish(null);
          return;
        }
        setTimeout(tick, 100);
      };
      tick();

      // Hard timeout at 7s
      timeout = setTimeout(() => finish(null), 7000);
    });

    return duration;
  } catch (error: any) {
    // Log only non-trivial errors
    try {
      const { logger } = await import('../services/logger');
      logger.warn('[videoDuration] Failed to extract video duration:', error?.message || error);
    } catch {
      /* ignore logging errors in test env */
    }
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
    // expo-video's VideoPlayer extends SharedObject — call release() if available.
    try {
      player?.release?.();
    } catch {
      /* ignore release errors */
    }
  }
}

/**
 * Extract durations for a list of video URLs in parallel (bounded concurrency).
 * Useful for hydrating duration overlays on a video grid.
 */
export async function extractDurationsFromUrls(
  videoUrls: string[],
): Promise<Map<string, DurationResult>> {
  const results = new Map<string, DurationResult>();
  const CONCURRENCY = 3;
  const chunks: string[][] = [];

  for (let i = 0; i < videoUrls.length; i += CONCURRENCY) {
    chunks.push(videoUrls.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      const duration = await extractDurationFromUrl(url);
      results.set(url, duration);
    });
    await Promise.all(promises);
  }

  return results;
}

const videoDurationUtils = {
  formatDuration,
  parseDuration,
  shouldShowDuration,
  extractDurationFromUrl,
  extractDurationsFromUrls,
};

export default videoDurationUtils;
