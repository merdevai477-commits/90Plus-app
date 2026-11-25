import { Linking, Platform } from 'react-native';
import {
  filterSupportedHighlightPlaybackUrls,
  isDirectHighlightFile,
  preferDirectHighlightUrls,
  resolveHighlightPlaybackUrl,
  youtubeMobileWatchUrl,
  youtubeVideoId,
} from './highlightPlaybackUrl';

/**
 * Direct/Streamin clips open in-app. YouTube opens in the YouTube app/browser.
 * Unsupported hosts (streama.in, etc.) are never opened in the sheet — that
 * was causing "مصدر الفيديو ده مش مدعوم" when they ranked ahead of YouTube.
 */
export function openHighlightPlayback(
  rawUrls: string[],
  openSheet: (urls: string[]) => void,
): boolean {
  const supported = filterSupportedHighlightPlaybackUrls(
    preferDirectHighlightUrls(rawUrls.map((u) => u.trim()).filter(Boolean)),
    Platform.OS,
  );
  if (!supported.length) return false;

  const directs: string[] = [];
  const youtubes: string[] = [];
  for (const url of supported) {
    const resolved = resolveHighlightPlaybackUrl(url, Platform.OS);
    if (isDirectHighlightFile(resolved)) {
      directs.push(url);
    } else if (youtubeVideoId(url) || youtubeVideoId(resolved)) {
      youtubes.push(url);
    }
  }

  // In-app sheet is MP4/Streamin only. On iOS, YouTube WebView is unreliable
  // (150/153); keep YouTube as external fallback after directs are exhausted.
  if (directs.length) {
    openSheet(Platform.OS === 'ios' ? directs : [...directs, ...youtubes]);
    return true;
  }

  const watch =
    youtubeMobileWatchUrl(youtubes[0] || '') ||
    youtubeMobileWatchUrl(supported[0] || '');
  if (watch) {
    void Linking.openURL(watch);
    return true;
  }

  return false;
}
