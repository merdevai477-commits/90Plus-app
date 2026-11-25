import { Linking } from 'react-native';
import {
  isDirectHighlightFile,
  preferDirectHighlightUrls,
  resolveHighlightPlaybackUrl,
  youtubeMobileWatchUrl,
  youtubeVideoId,
} from './highlightPlaybackUrl';

/**
 * Direct/Streamin clips open in-app. YouTube opens in the YouTube app/browser
 * immediately — no in-app WebView attempt.
 */
export function openHighlightPlayback(
  rawUrls: string[],
  openSheet: (urls: string[]) => void,
): boolean {
  const urls = preferDirectHighlightUrls(
    rawUrls.map((u) => u.trim()).filter(Boolean),
  );
  if (!urls.length) return false;

  const first = urls[0];
  const resolved = resolveHighlightPlaybackUrl(first);
  const isYoutube = Boolean(youtubeVideoId(first) || youtubeVideoId(resolved));
  const isDirect = isDirectHighlightFile(resolved);

  if (isYoutube && !isDirect) {
    const watch = youtubeMobileWatchUrl(first) || youtubeMobileWatchUrl(resolved);
    if (watch) {
      void Linking.openURL(watch);
      return true;
    }
  }

  openSheet(urls);
  return true;
}
