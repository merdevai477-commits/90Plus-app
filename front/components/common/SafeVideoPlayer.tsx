/**
 * SafeVideoPlayer - thin re-export over UnifiedVideoPlayer.
 *
 * Historically this wrapper guarded against `expo-av` not being available in
 * Expo Go on SDK 52. Since SDK 55 we use `expo-video` which is always present
 * in a development or production build, so the guard is no longer needed and
 * the fallback branch was unreachable.
 *
 * Kept as a re-export so existing call sites (e.g. components/reels/ReelItem)
 * continue to work without import churn.
 */

export { UnifiedVideoPlayer as SafeVideoPlayer } from './UnifiedVideoPlayer';

/** @deprecated expo-video is always available in SDK 55+. Always returns true. */
export const hasExpoAV = true;
