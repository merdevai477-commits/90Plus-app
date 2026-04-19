import { Audio, ResizeMode } from 'expo-av';

const hasExpoAV = true;

import { logger } from '../services/logger';

/**
 * Unified Video Configuration Defaults
 * Single source of truth for all video playback behavior
 * Instagram/TikTok-style defaults: Audio ON, Autoplay ON
 */
export const VIDEO_DEFAULTS = {
  autoplay: true,
  looping: false, // Use replay limit instead of native looping
  muted: false, // Audio ON by default (Instagram/TikTok style)
  shouldPlay: true,
  resizeMode: ResizeMode.COVER, // ✅ Use ResizeMode enum from expo-av
  progressUpdateIntervalMillis: 1000, // Reduced from 500ms to cut re-renders in half
};

/**
 * تكوين الصوت والفيديو للتطبيق
 * يجب استدعاء هذه الدالة عند بدء التطبيق
 */
export const configureAudioVideo = async () => {
  if (!hasExpoAV || !Audio) {
    logger.warn('⚠️ expo-av not available, skipping audio configuration');
    return;
  }

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    logger.info('✅ Audio/Video configured successfully');
  } catch (error) {
    logger.error('❌ Failed to configure audio/video:', error);
  }
};

/**
 * روابط فيديو احتياطية للاختبار
 */
export const FALLBACK_VIDEOS = [
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://www.w3schools.com/html/movie.mp4',
  'https://download.blender.org/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4.zip',
];

/**
 * التحقق من صلاحية رابط الفيديو
 */
export const isValidVideoUrl = (url: string): boolean => {
  if (!url) return false;

  const validExtensions = ['.mp4', '.mov', '.m4v', '.3gp', '.m3u8'];
  const lowerUrl = url.toLowerCase();

  // Also accept Mux stream URLs (stream.mux.com) and any https URL
  // since modern CDNs don't always use file extensions
  if (lowerUrl.includes('stream.mux.com') || lowerUrl.includes('mux.com')) {
    return true;
  }

  return validExtensions.some(ext => lowerUrl.includes(ext));
};

/**
 * الحصول على رابط فيديو احتياطي
 */
export const getFallbackVideo = (index: number = 0): string => {
  return FALLBACK_VIDEOS[index % FALLBACK_VIDEOS.length];
};
