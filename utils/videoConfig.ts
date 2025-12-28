import { Audio } from 'expo-av';

/**
 * تكوين الصوت والفيديو للتطبيق
 * يجب استدعاء هذه الدالة عند بدء التطبيق
 */
export const configureAudioVideo = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    console.log('✅ Audio/Video configured successfully');
  } catch (error) {
    console.error('❌ Failed to configure audio/video:', error);
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
