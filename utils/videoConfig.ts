// Try to import expo-av, fallback if not available
let Audio: any = null;
let hasExpoAV = false;

try {
  const ExpoAV = require('expo-av');
  Audio = ExpoAV.Audio;
  hasExpoAV = true;
} catch (error) {
  console.warn('[videoConfig] expo-av not available');
  hasExpoAV = false;
}

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
  resizeMode: 'cover' as const, // ✅ SDK 52: ResizeMode enum removed from expo-av 15
  progressUpdateIntervalMillis: 500,
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

  const validExtensions = ['.mp4', '.mov', '.m4v', '.3gp'];
  const lowerUrl = url.toLowerCase();

  return validExtensions.some(ext => lowerUrl.includes(ext));
};

/**
 * الحصول على رابط فيديو احتياطي
 */
export const getFallbackVideo = (index: number = 0): string => {
  return FALLBACK_VIDEOS[index % FALLBACK_VIDEOS.length];
};
