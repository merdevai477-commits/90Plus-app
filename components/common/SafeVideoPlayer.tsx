import React from 'react';

// Try to import expo-av, fallback if not available
let Video: any = null;
let hasExpoAV = false;

try {
  const ExpoAV = require('expo-av');
  Video = ExpoAV.Video;
  hasExpoAV = true;
} catch (error) {
  console.warn('[SafeVideoPlayer] expo-av not available, using fallback');
  hasExpoAV = false;
}

// Import components
import { VideoPlayerFallback } from './VideoPlayerFallback';

/**
 * Safe wrapper for UnifiedVideoPlayer that checks if expo-av is available
 * Falls back to placeholder if running in Expo Go on SDK 52
 */
export function SafeVideoPlayer(props: any) {
  if (!hasExpoAV) {
    return <VideoPlayerFallback videoUrl={props.reel?.videoUrl || 'N/A'} style={props.style} />;
  }

  // Dynamically import UnifiedVideoPlayer only if expo-av is available
  const UnifiedVideoPlayer = require('./UnifiedVideoPlayer').default;
  return <UnifiedVideoPlayer {...props} />;
}

export { hasExpoAV };
