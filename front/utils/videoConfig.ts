import { setAudioModeAsync } from 'expo-audio';
import { logger } from '../services/logger';

/**
 * Unified Video Configuration Defaults
 *
 * Single source of truth for all video playback behavior across the app.
 * Instagram/TikTok-style defaults: audio ON, autoplay ON, contentFit=cover.
 *
 * SDK 55 migration note:
 * - `ResizeMode.COVER` from `expo-av` is replaced by `VideoContentFit` string
 *   literal `'cover'` used by `expo-video`'s <VideoView contentFit="cover" />.
 * - There is no `shouldPlay` prop anymore; playback is driven through the
 *   `VideoPlayer` instance (`player.play()` / `player.pause()`).
 */
export const VIDEO_DEFAULTS = {
  /** Whether new videos should autoplay on mount. */
  autoplay: true,
  /** Whether to loop natively. We keep this false because we apply a 2-replay cap manually. */
  looping: false,
  /** Audio ON by default (Instagram/TikTok style). */
  muted: false,
  /** Default VideoView contentFit — fills the viewport while preserving aspect ratio. */
  contentFit: 'cover' as const,
  /** How often the player emits `timeUpdate` events (seconds). 0 disables the event. */
  timeUpdateEventInterval: 1,
} as const;

/**
 * Configure the app-wide audio session for video playback.
 * Call once at app startup (`app/_layout.tsx`).
 *
 * SDK 55 migration:
 * - `Audio.setAudioModeAsync` from `expo-av` has been replaced with
 *   `setAudioModeAsync` from `expo-audio`.
 * - Keys changed:
 *     allowsRecordingIOS          → allowsRecording
 *     staysActiveInBackground     → shouldPlayInBackground
 *     playsInSilentModeIOS        → playsInSilentMode
 *     shouldDuckAndroid           → interruptionMode: 'duckOthers'
 *     playThroughEarpieceAndroid  → shouldRouteThroughEarpiece
 */
export const configureAudioVideo = async (): Promise<void> => {
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: false,
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldRouteThroughEarpiece: false,
    });
    logger.info('✅ Audio/Video configured successfully');
  } catch (error) {
    logger.error('❌ Failed to configure audio/video:', error);
  }
};

/** Sample video URLs used as a last-resort fallback during diagnostics. */
export const FALLBACK_VIDEOS = [
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://www.w3schools.com/html/movie.mp4',
  'https://download.blender.org/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4.zip',
];

/** Basic URL sanity-check for user-supplied video URLs. */
export const isValidVideoUrl = (url: string): boolean => {
  if (!url) return false;

  const validExtensions = ['.mp4', '.mov', '.m4v', '.3gp', '.m3u8'];
  const lowerUrl = url.toLowerCase();

  // Mux delivers HLS and doesn't always carry an .m3u8 extension in the URL.
  if (lowerUrl.includes('stream.mux.com') || lowerUrl.includes('mux.com')) {
    return true;
  }

  return validExtensions.some((ext) => lowerUrl.includes(ext));
};

/** Get a deterministic fallback URL. Useful for tests and error states. */
export const getFallbackVideo = (index = 0): string => {
  return FALLBACK_VIDEOS[index % FALLBACK_VIDEOS.length];
};
