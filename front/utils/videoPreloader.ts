/**
 * Video Preloader Utility
 * Preloads video URLs for smooth playback in the reels feed.
 *
 * Requirement 3.7: Preload next 2 videos when viewing current reel
 * ✅ SDK 52: Replaced Video.createAsync (removed in expo-av 15) with
 *    a lightweight fetch range-request to warm the CDN connection.
 */

import { Platform } from 'react-native';
import { logger } from '../services/logger';
import { optimizeReelPlaybackUrl } from './reelPlaybackUrl';

// Track preloaded video URLs
const preloadedUrls = new Set<string>();
const preloadingUrls = new Set<string>();

// ✅ OPTIMIZATION: Increased max preloaded videos for smoother scrolling
const MAX_PRELOADED_VIDEOS = 10;

// Queue of preloaded URLs for LRU eviction
const preloadQueue: string[] = [];

/**
 * Preload a video URL for faster playback.
 * Warms the CDN connection. iOS fetches the HLS playlist only; Android
 * uses a short range request. Neither path creates a native player.
 * (Video.createAsync was removed in expo-av 15 / Expo SDK 52)
 */
export async function preloadVideo(videoUrl: string): Promise<boolean> {
  // Skip if already preloaded or currently preloading
  if (preloadedUrls.has(videoUrl) || preloadingUrls.has(videoUrl)) {
    return true;
  }

  // Skip invalid URLs
  if (!videoUrl || !videoUrl.startsWith('http')) {
    return false;
  }

  preloadingUrls.add(videoUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const requestUrl = optimizeReelPlaybackUrl(videoUrl);

    if (Platform.OS === 'ios') {
      // Playlist only. The paused next-cell player downloads the segments,
      // so this fetch does not pull the opening of the reel a second time.
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: { Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*' },
        signal: controller.signal,
      });
      await response.text();
      if (!response.ok) return false;
    } else {
      // Warm the CDN connection with a range request (first 64 KB only).
      await fetch(requestUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-65535' },
        signal: controller.signal,
      });
    }

    // Mark as preloaded
    preloadedUrls.add(videoUrl);
    preloadQueue.push(videoUrl);

    // Evict oldest if we exceed max (LRU)
    if (preloadQueue.length > MAX_PRELOADED_VIDEOS) {
      const oldestUrl = preloadQueue.shift();
      if (oldestUrl) {
        preloadedUrls.delete(oldestUrl);
      }
    }

    logger.debug(`[VideoPreloader] Warmed: ${videoUrl.substring(0, 50)}...`);
    return true;
  } catch {
    // Silent fail — preloading is best-effort and must never crash the app
    return false;
  } finally {
    clearTimeout(timeout);
    preloadingUrls.delete(videoUrl);
  }
}

/**
 * Preload multiple videos in PARALLEL for faster loading
 * ✅ OPTIMIZED: Changed from sequential to parallel
 */
export async function preloadVideos(videoUrls: string[]): Promise<void> {
  await Promise.allSettled(videoUrls.map(url => preloadVideo(url)));
}

/**
 * Check if a video URL has been preloaded
 */
export function isVideoPreloaded(videoUrl: string): boolean {
  return preloadedUrls.has(videoUrl);
}

/**
 * Clear all preloaded videos
 */
export function clearPreloadedVideos(): void {
  preloadedUrls.clear();
  preloadingUrls.clear();
  preloadQueue.length = 0;
  logger.debug('[VideoPreloader] Cleared all preloaded videos');
}

/**
 * Get the number of currently preloaded videos
 */
export function getPreloadedCount(): number {
  return preloadedUrls.size;
}

/**
 * Preload next N videos from a list starting at a given index.
 * This is the main function to call when the viewing index changes.
 *
 * @param videos - Array of video objects with videoUrl property
 * @param currentIndex - Current viewing index
 * @param count - Number of videos to preload (default: 3)
 * ✅ OPTIMIZED: Increased default count from 2 to 3
 */
export async function preloadNextVideos<T extends { videoUrl: string }>(
  videos: T[],
  currentIndex: number,
  count: number = 3
): Promise<void> {
  const urlsToPreload: string[] = [];

  for (let i = 1; i <= count; i++) {
    const nextIndex = currentIndex + i;
    if (nextIndex < videos.length) {
      const video = videos[nextIndex];
      if (video?.videoUrl && !isVideoPreloaded(video.videoUrl)) {
        urlsToPreload.push(video.videoUrl);
      }
    }
  }

  if (urlsToPreload.length > 0) {
    logger.debug(`[VideoPreloader] Preloading ${urlsToPreload.length} videos from index ${currentIndex}`);
    await preloadVideos(urlsToPreload);
  }
}

export default {
  preloadVideo,
  preloadVideos,
  isVideoPreloaded,
  clearPreloadedVideos,
  getPreloadedCount,
  preloadNextVideos,
};
