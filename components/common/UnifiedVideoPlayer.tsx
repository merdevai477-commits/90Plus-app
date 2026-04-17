import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
// Safe import for expo-av
let Video: any = null;
let ResizeMode: any = null;
let AVPlaybackStatus: any = null;
try {
  const ExpoAV = require('expo-av');
  Video = ExpoAV.Video;
  ResizeMode = ExpoAV.ResizeMode;
  AVPlaybackStatus = ExpoAV.AVPlaybackStatus;
} catch (e) {
  console.warn('[UnifiedVideoPlayer] expo-av not available');
}
import { Play } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVideoReplayLimit, MAX_AUTO_REPLAYS } from '../../hooks/useVideoReplayLimit';
import { VIDEO_DEFAULTS } from '../../utils/videoConfig';
import { VideoErrorBoundary } from './VideoErrorBoundary';
import { logger } from '../../utils/logger';
import { getApiUrl } from '../../config/api.config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
export interface UnifiedReelData {
  id: string;
  videoUrl: string;
  thumbnail?: string;
  duration?: number;
  muted?: boolean; // Optional - defaults to VIDEO_DEFAULTS.muted
}

export interface UnifiedVideoPlayerProps {
  reel: UnifiedReelData;
  isActive: boolean;
  onVideoRef: (ref: any, id: string) => void;
  /** Optional: Disable replay limit (for testing or special cases) */
  disableReplayLimit?: boolean;
  /** Optional: Show progress bar */
  showProgressBar?: boolean;
  /** Optional: Override default muted state */
  muted?: boolean;
  /** Optional: Custom style */
  style?: any;
}

// Constants
const COLORS = {
  primary: '#FFD700',
  background: '#000000',
  error: '#FF5252',
  progressBg: 'rgba(255, 255, 255, 0.3)',
  progressFill: '#32cd32',
};

/**
 * Unified Video Player Component (Internal)
 * 
 * Single source of truth for all video playback across the app.
 * Uses VIDEO_DEFAULTS for consistent behavior (audio ON, autoplay ON).
 * 
 * Features:
 * - Auto-replay up to 2 times (via replay limit)
 * - Pause and show replay button after 2 replays
 * - Manual tap restarts playback
 * - Replay count resets when scrolling away
 * - Audio ON by default (Instagram/TikTok style)
 * - Error Boundary for graceful error handling
 */
const UnifiedVideoPlayerInternal: React.FC<UnifiedVideoPlayerProps> = ({
  reel,
  isActive,
  onVideoRef,
  disableReplayLimit = false,
  showProgressBar = true,
  muted: overrideMuted,
  style,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  // Q3 Fix: track the active video URL (may be refreshed if signed URL expires)
  const [activeVideoUrl, setActiveVideoUrl] = useState(reel.videoUrl);
  const signedUrlRefreshAttempts = useRef(0);
  const MAX_SIGNED_URL_REFRESHES = 2;
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoRef = useRef<any>(null);
  const { t } = useLanguage();
  const { getToken } = useAuth();
  
  // Determine muted state: override > prop > default
  const isMuted = overrideMuted !== undefined 
    ? overrideMuted 
    : (reel.muted !== undefined ? reel.muted : VIDEO_DEFAULTS.muted);
  
  // Replay limit tracking
  const {
    replayCount,
    isPausedByLimit,
    onVideoEnd,
    onManualReplay,
    resetReplayCount,
  } = useVideoReplayLimit(reel.id, MAX_AUTO_REPLAYS);

  // Track if video has finished to detect replay
  const lastPositionRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  useEffect(() => {
    if (videoRef.current) {
      onVideoRef(videoRef.current, reel.id);
    }
    return () => {
      onVideoRef(null, reel.id);
    };
  }, [reel.id, onVideoRef]);

  // Sync activeVideoUrl when reel.videoUrl changes (e.g. after processing → processedVideoUrl)
  useEffect(() => {
    setActiveVideoUrl(reel.videoUrl);
    signedUrlRefreshAttempts.current = 0;
  }, [reel.videoUrl]);

  // Reset replay count when video becomes inactive (scrolled away)
  useEffect(() => {
    if (!isActive) {
      resetReplayCount();
    }
  }, [isActive, resetReplayCount]);

  // ✅ FIX: Track actual playback state to avoid multiple playAsync calls
  const isActuallyPlayingRef = useRef(false);
  const playAttemptInProgressRef = useRef(false);
  const lastControlAttemptRef = useRef<number>(0);

  // Control video playback based on active state
  useEffect(() => {
    const controlVideo = async () => {
      if (!videoRef.current || !isVideoLoaded) return;
      
      const shouldBePlaying = isActive && !isPausedByLimit;
      
      // ✅ Throttle control attempts to prevent rapid-fire calls
      const now = Date.now();
      if (now - lastControlAttemptRef.current < 100) return;
      lastControlAttemptRef.current = now;
      
      try {
        if (shouldBePlaying) {
          // ✅ Prevent multiple simultaneous play attempts
          if (playAttemptInProgressRef.current) return;
          
          // ✅ Check actual video status before attempting play
          const status = await videoRef.current.getStatusAsync();
          if ('isPlaying' in status && status.isPlaying) {
            isActuallyPlayingRef.current = true;
            return; // Already playing
          }
          
          playAttemptInProgressRef.current = true;
          await videoRef.current.playAsync();
          isActuallyPlayingRef.current = true;
          playAttemptInProgressRef.current = false;
        } else {
          // Only pause if actually playing
          if (isActuallyPlayingRef.current || playAttemptInProgressRef.current) {
            await videoRef.current.pauseAsync();
            isActuallyPlayingRef.current = false;
            playAttemptInProgressRef.current = false;
          }
        }
      } catch (error) {
        playAttemptInProgressRef.current = false;
        // Only log non-trivial errors
        const errorMessage = (error as Error)?.message || 'unknown';
        if (!errorMessage.includes('already') && !errorMessage.includes('not ready')) {
          console.log(`[UnifiedVideoPlayer] Video control for ${reel.id}:`, errorMessage);
        }
      }
    };
    controlVideo();
  }, [isActive, isVideoLoaded, isPausedByLimit, reel.id]);

  // ✅ FIX: Handle page focus to resume video when returning to reels page
  useFocusEffect(
    useCallback(() => {
      // When page gains focus, try to resume if this video should be playing
      const resumeIfNeeded = async () => {
        if (!videoRef.current || !isVideoLoaded || !isActive || isPausedByLimit) return;
        
        try {
          const status = await videoRef.current.getStatusAsync();
          if ('isPlaying' in status && !status.isPlaying) {
            // Video should be playing but isn't - resume it
            await videoRef.current.playAsync();
            isActuallyPlayingRef.current = true;
          }
        } catch (error) {
          // Ignore errors - playback will be handled by useEffect
        }
      };
      
      // Small delay to let the page settle
      const timer = setTimeout(resumeIfNeeded, 200);
      
      return () => {
        clearTimeout(timer);
      };
    }, [isVideoLoaded, isActive, isPausedByLimit])
  );

  const handleLoad = useCallback(() => {
    logger.info(`[VideoPlayer] ✅ Video loaded successfully: ${reel.id} | URL: ${activeVideoUrl.substring(0, 60)}...`);
    setIsLoading(false);
    setIsVideoLoaded(true);
    setError(false);
    setErrorDetails('');
    signedUrlRefreshAttempts.current = 0; // reset on successful load
    
    // Clear load timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, [reel.id, activeVideoUrl]);

  /**
   * Q3 Fix: On video error, attempt to refresh the signed URL.
   * expo-av doesn't expose HTTP status codes, so we try a HEAD request
   * to detect 403 before showing the error UI.
   */
  const handleError = useCallback(async (err?: any) => {
    const errMsg = typeof err === 'string' ? err : (err?.message || err?.error || JSON.stringify(err) || 'Unknown error');
    logger.error(`[VideoPlayer] ❌ Video error for reel ${reel.id}: ${errMsg}`);
    logger.error(`[VideoPlayer] ❌ URL was: ${activeVideoUrl.substring(0, 80)}...`);
    
    // Detect HLS / Mux specific errors
    const isMuxUrl = activeVideoUrl.includes('stream.mux.com') || activeVideoUrl.includes('.m3u8');
    if (isMuxUrl) {
      logger.warn(`[VideoPlayer] 🔍 Mux HLS URL detected. Checking connectivity...`);
      
      // Try HEAD request to check if URL is accessible
      try {
        const headRes = await fetch(activeVideoUrl, { method: 'HEAD' });
        logger.info(`[VideoPlayer] 🔍 Mux HEAD status: ${headRes.status} ${headRes.statusText}`);
        if (headRes.status === 403 || headRes.status === 404) {
          setErrorDetails(`Mux: ${headRes.status} - الفيديو غير متاح أو انتهت صلاحيته`);
        }
      } catch (headErr) {
        logger.warn(`[VideoPlayer] 🔍 HEAD request failed (network issue):`, headErr);
        setErrorDetails('مشكلة في الاتصال بخادم الفيديو');
      }
    }
    
    // Check if this might be a 403 (expired signed URL)
    if (
      signedUrlRefreshAttempts.current < MAX_SIGNED_URL_REFRESHES &&
      activeVideoUrl.includes('X-Amz-Signature') // is a signed URL
    ) {
      signedUrlRefreshAttempts.current += 1;
      logger.info(`[VideoPlayer] Attempting signed URL refresh (attempt ${signedUrlRefreshAttempts.current}) for reel ${reel.id}`);

      try {
        const token = await getToken();
        if (token) {
          const res = await fetch(`${getApiUrl()}/reels/${reel.id}/signed-url`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const newUrl: string = data?.data?.signedUrl;
            if (newUrl) {
              logger.info(`[VideoPlayer] Signed URL refreshed for reel ${reel.id}`);
              setActiveVideoUrl(newUrl);
              setError(false);
              setErrorDetails('');
              setIsLoading(true);
              setIsVideoLoaded(false);
              return; // Don't show error — retry with new URL
            }
          }
        }
      } catch (refreshErr) {
        logger.warn('[VideoPlayer] Signed URL refresh failed:', refreshErr);
      }
    }

    // Fallback: show error UI
    setError(true);
    setIsLoading(false);
    setIsVideoLoaded(false);
  }, [activeVideoUrl, reel.id, getToken]);

  const handleRetry = () => {
    signedUrlRefreshAttempts.current = 0;
    setError(false);
    setIsLoading(true);
    setIsVideoLoaded(false);
    setActiveVideoUrl(reel.videoUrl); // reset to original URL on manual retry
  };

  /**
   * Handle manual replay when user taps the replay button
   */
  const handleManualReplay = useCallback(async () => {
    onManualReplay();
    if (videoRef.current) {
      try {
        await videoRef.current.setPositionAsync(0);
        await videoRef.current.playAsync();
      } catch (e) {
        console.warn('Error restarting video:', e);
      }
    }
  }, [onManualReplay]);

  /**
   * Handle playback status updates to detect video end and sync playback state
   */
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if ('isBuffering' in status) {
      setIsBuffering(status.isBuffering || false);
    }
    
    // ✅ Sync actual playback state with ref
    if ('isPlaying' in status) {
      isActuallyPlayingRef.current = status.isPlaying || false;
    }
    
    if (!disableReplayLimit && 'isLoaded' in status && status.isLoaded) {
      const { positionMillis, durationMillis, didJustFinish } = status;
      
      // Store duration for reference
      if (durationMillis) {
        durationRef.current = durationMillis;
        setDuration(durationMillis);
      }
      
      // Update progress
      if (positionMillis && durationMillis && durationMillis > 0) {
        setProgress(positionMillis / durationMillis);
      }
      
      // Mark as loaded if not already
      if (!isVideoLoaded) {
        setIsVideoLoaded(true);
      }
      
      // Detect video end (didJustFinish is true when video reaches the end)
      if (didJustFinish && isActive) {
        const shouldContinue = onVideoEnd();
        
        if (!shouldContinue && videoRef.current) {
          // Pause the video - replay limit reached
          videoRef.current.pauseAsync().catch((e: any) => {
            console.warn('Error pausing video after replay limit:', e);
          });
        }
      }
      
      lastPositionRef.current = positionMillis || 0;
    }
  }, [disableReplayLimit, isActive, onVideoEnd, isVideoLoaded]);

  if (error) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Text style={styles.errorText}>{t.reels?.loadFailed || 'Failed to load video'}</Text>
        {errorDetails ? (
          <Text style={styles.errorDetailText}>{errorDetails}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
        >
          <Text style={styles.retryText}>{t.reels?.retry || 'Retry'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.videoContainer, style]}>
      <Video
        ref={videoRef}
        source={{
          uri: activeVideoUrl,
          // ✅ Critical for Android HLS: Tell ExoPlayer this is an HLS stream
          // Without this, Android may fail to detect .m3u8 format from Mux URLs
          ...(activeVideoUrl.includes('.m3u8') ? { overrideFileExtensionAndroid: 'm3u8' } : {}),
        }}
        style={styles.video}
        resizeMode={VIDEO_DEFAULTS.resizeMode}
        shouldPlay={isActive && isVideoLoaded && !isPausedByLimit && VIDEO_DEFAULTS.shouldPlay}
        isLooping={VIDEO_DEFAULTS.looping}
        isMuted={isMuted}
        onLoad={handleLoad}
        onError={handleError}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        progressUpdateIntervalMillis={VIDEO_DEFAULTS.progressUpdateIntervalMillis}
        positionMillis={0}
        useNativeControls={false}
      />

      {/* Loading/Buffering Indicator */}
      {(isLoading || isBuffering) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {isLoading ? (t.reels?.loading || 'Loading...') : (t.reels?.buffering || 'Buffering...')}
          </Text>
        </View>
      )}

      {/* Progress Bar */}
      {showProgressBar && !isLoading && duration > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Replay Button Overlay - Shown when replay limit reached */}
      {isPausedByLimit && !isLoading && (
        <TouchableOpacity
          style={styles.replayOverlay}
          onPress={handleManualReplay}
          activeOpacity={0.8}
          accessibilityLabel={t.reels?.tapToReplay || 'Replay video'}
          accessibilityRole="button"
        >
          <View style={styles.replayButton}>
            <Play size={48} color="#FFFFFF" fill="#FFFFFF" />
          </View>
          <Text style={styles.replayText}>
            {t.reels?.tapToReplay || 'Tap to replay'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 14,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 10,
  },
  progressBackground: {
    flex: 1,
    backgroundColor: COLORS.progressBg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.progressFill,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorDetailText: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center' as const,
    paddingHorizontal: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
  },
  retryText: {
    color: COLORS.background,
    fontWeight: '600',
  },
  replayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  replayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  replayText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

/**
 * Unified Video Player Component (Exported with Error Boundary)
 * Requirement: Critical Priority #3 - Add Error Boundary for videos
 */
export const UnifiedVideoPlayer: React.FC<UnifiedVideoPlayerProps> = (props) => {
  return (
    <VideoErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('[UnifiedVideoPlayer] Error caught by boundary:', {
          reelId: props.reel.id,
          error: error.message,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      <UnifiedVideoPlayerInternal {...props} />
    </VideoErrorBoundary>
  );
};