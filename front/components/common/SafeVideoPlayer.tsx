import React from 'react';

// Import components
import { VideoPlayerFallback } from './VideoPlayerFallback';
import { logger } from '../../utils/logger';

import { Video } from 'expo-av';
import { UnifiedVideoPlayer } from './UnifiedVideoPlayer';

const hasExpoAV = true;
const UnifiedVideoPlayerModule = UnifiedVideoPlayer;

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

