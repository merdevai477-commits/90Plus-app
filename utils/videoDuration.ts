/**
 * Video Duration Utility
 * Extracts and formats video duration for display on profile thumbnails.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 * - 9.1: Show actual video duration on profile thumbnails
 * - 9.2: Extract and store correct duration from video metadata
 * - 9.3: Format as MM:SS for videos under one hour
 * - 9.4: Hide duration indicator for unknown duration (instead of showing 0:00)
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
 * Property 9: Video Duration Display Format
 * - For any video with a known duration under one hour, the displayed duration
 *   SHALL be formatted as MM:SS
 * - For unknown duration, the duration indicator SHALL be hidden (return null)
 * 
 * **Validates: Requirements 9.1, 9.3, 9.4**
 */
export function formatDuration(durationSeconds: DurationResult): FormattedDuration {
  // Return null for unknown/invalid duration (Requirement 9.4)
  if (durationSeconds === null || durationSeconds === undefined) {
    return null;
  }

  // Return null for invalid values (negative, NaN, Infinity)
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return null;
  }

  // Round to nearest second for display
  const totalSeconds = Math.round(durationSeconds);

  // For videos under one hour, format as MM:SS (Requirement 9.3)
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Format with leading zero for seconds
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse duration string back to seconds
 * Useful for testing round-trip consistency
 * 
 * @param formatted - Formatted duration string (e.g., "1:30")
 * @returns Duration in seconds or null if invalid
 */
export function parseDuration(formatted: FormattedDuration): DurationResult {
  if (formatted === null || formatted === undefined) {
    return null;
  }

  const parts = formatted.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);

  if (isNaN(minutes) || isNaN(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) {
    return null;
  }

  return minutes * 60 + seconds;
}

/**
 * Check if duration should be displayed
 * 
 * @param duration - Duration value (formatted string or seconds)
 * @returns true if duration should be shown, false if it should be hidden
 */
export function shouldShowDuration(duration: FormattedDuration | DurationResult): boolean {
  if (duration === null || duration === undefined) {
    return false;
  }

  // If it's a string, check if it's a valid formatted duration
  if (typeof duration === 'string') {
    // Don't show "0:00" as it indicates unknown duration
    if (duration === '0:00') {
      return false;
    }
    return duration.length > 0;
  }

  // If it's a number, check if it's valid and greater than 0
  if (typeof duration === 'number') {
    return Number.isFinite(duration) && duration > 0;
  }

  return false;
}

/**
 * Extract duration from video URL using expo-av
 * This is an async operation that loads video metadata
 * 
 * @param videoUrl - URL of the video
 * @returns Duration in seconds or null if extraction fails
 * 
 * Requirements: 9.2
 */
export async function extractDurationFromUrl(videoUrl: string): Promise<DurationResult> {
  if (!videoUrl) {
    return null;
  }

  try {
    // Dynamically import expo-av to avoid issues in test environment
    const { Video } = await import('expo-av');
    const { logger } = await import('../services/logger');
    
    // Create a temporary video reference to get metadata
    const { sound, status } = await Video.createAsync(
      { uri: videoUrl },
      { shouldPlay: false },
      undefined,
      false
    );

    // Clean up the video reference
    if (sound) {
      await sound.unloadAsync();
    }

    // Extract duration from status
    if (status && 'durationMillis' in status && status.durationMillis) {
      return status.durationMillis / 1000;
    }

    return null;
  } catch (error) {
    // Log error if logger is available
    try {
      const { logger } = await import('../services/logger');
      logger.warn('Failed to extract video duration:', error);
    } catch {
      // Ignore logging errors in test environment
    }
    return null;
  }
}

/**
 * Batch extract durations for multiple videos
 * Useful for preloading duration data for video grids
 * 
 * @param videoUrls - Array of video URLs
 * @returns Map of URL to duration (in seconds)
 */
export async function extractDurationsFromUrls(
  videoUrls: string[]
): Promise<Map<string, DurationResult>> {
  const results = new Map<string, DurationResult>();

  // Process in parallel with a concurrency limit
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

// Default export for convenience
const videoDurationUtils = {
  formatDuration,
  parseDuration,
  shouldShowDuration,
  extractDurationFromUrl,
  extractDurationsFromUrls,
};

export default videoDurationUtils;
