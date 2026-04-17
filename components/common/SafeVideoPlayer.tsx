import React from 'react';

// Import components
import { VideoPlayerFallback } from './VideoPlayerFallback';
import { logger } from '../../utils/logger';

// Check if expo-av is available at module load time
let hasExpoAV = false;
let UnifiedVideoPlayerModule: any = null;

try {
  // Try loading expo-av first to verify it's available
  require('expo-av');
  hasExpoAV = true;
  // Pre-load UnifiedVideoPlayer so we don't need try/catch in render
  UnifiedVideoPlayerModule = require('./UnifiedVideoPlayer').default;
} catch (error: any) {
  hasExpoAV = false;
  logger.warn('[SafeVideoPlayer] expo-av not available:', error?.message);
}

/**
 * Safe wrapper for UnifiedVideoPlayer that checks if expo-av is available
 * Falls back to placeholder if running in Expo Go on SDK 52
 */
export function SafeVideoPlayer(props: any) {
  if (hasExpoAV && UnifiedVideoPlayerModule) {
    return <UnifiedVideoPlayerModule {...props} />;
  }

  // expo-av not available - show fallback
  logger.warn('[SafeVideoPlayer] Using fallback player (expo-av unavailable)');
  return <VideoPlayerFallback videoUrl={props.reel?.videoUrl || 'N/A'} style={props.style} />;
}

export { hasExpoAV };

