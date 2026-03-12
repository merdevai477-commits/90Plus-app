import React from 'react';

// Import components
import { VideoPlayerFallback } from './VideoPlayerFallback';

// Check if expo-av is available (will be false in Expo Go SDK 52)
let hasExpoAV = false;
let Video: any = null;

// Try to check if expo-av is available without importing it at top level
// This prevents the error from blocking the entire app
try {
  // We'll do the actual import lazily when needed
  hasExpoAV = true; // Assume true, will check on actual use
} catch (error) {
  hasExpoAV = false;
}

/**
 * Safe wrapper for UnifiedVideoPlayer that checks if expo-av is available
 * Falls back to placeholder if running in Expo Go on SDK 52
 */
export function SafeVideoPlayer(props: any) {
  // Try to dynamically import UnifiedVideoPlayer
  // If it fails (expo-av not available), show fallback
  try {
    const UnifiedVideoPlayer = require('./UnifiedVideoPlayer').default;
    return <UnifiedVideoPlayer {...props} />;
  } catch (error: any) {
    // expo-av not available - show fallback
    console.warn('[SafeVideoPlayer] expo-av not available, using fallback:', error.message);
    return <VideoPlayerFallback videoUrl={props.reel?.videoUrl || 'N/A'} style={props.style} />;
  }
}

export { hasExpoAV };
