import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Play } from 'lucide-react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVideoReplayLimit, MAX_AUTO_REPLAYS } from '../../hooks/useVideoReplayLimit';
import { VIDEO_DEFAULTS } from '../../utils/videoConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface ReelData {
  id: string;
  videoUrl: string;
  thumbnail: string;
  duration: number;
  muted: boolean;
}

interface VideoPlayerProps {
  reel: ReelData;
  isActive: boolean;
  onVideoRef: (ref: any, id: string) => void;
  /** Optional: Disable replay limit (for testing or special cases) */
  disableReplayLimit?: boolean;
  /** Optional: Show progress bar */
  showProgressBar?: boolean;
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
 * Enhanced Video Player Component with Replay Limit
 * 
 * Requirements 17.1, 17.2, 17.3, 17.4:
 * - Auto-replay up to 2 times
 * - Pause and show replay button after 2 replays
 * - Manual tap restarts playback
 * - Replay count resets when scrolling away
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  reel,
  isActive,
  onVideoRef,
  disableReplayLimit = false,
  showProgressBar = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false); // ✅ Track video load state
  const videoRef = useRef<any>(null);
  const { t } = useLanguage();
  
  // Replay limit tracking (Requirements 17.1, 17.2, 17.3, 17.4)
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

  // Reset replay count when video becomes inactive (scrolled away)
  // Requirement 17.4: Replay count SHALL reset when scrolling away and back
  useEffect(() => {
    if (!isActive) {
      resetReplayCount();
    }
  }, [isActive, resetReplayCount]);

  useEffect(() => {
    if (videoRef.current && isVideoLoaded) {
      if (isActive && !isPausedByLimit) {
        videoRef.current.playAsync().catch((e: any) => {
          console.warn('Error playing video:', e);
        });
      } else {
        videoRef.current.pauseAsync().catch((e: any) => {
          console.warn('Error pausing video:', e);
        });
      }
    }
  }, [isActive, isPausedByLimit, isVideoLoaded]);

  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  const handleRetry = () => {
    setError(false);
    setIsLoading(true);
  };

  /**
   * Handle manual replay when user taps the replay button
   * Requirement 17.3: Manual tap SHALL restart playback
   */
  const handleManualReplay = useCallback(async () => {
    onManualReplay();
    if (videoRef.current) {
      try {
        await videoRef.current.setPositionAsync(0);
        await videoRef.current.playAsync();
      } catch (e: any) {
        console.warn('Error restarting video:', e);
      }
    }
  }, [onManualReplay]);

  /**
   * Handle playback status updates to detect video end
   * Requirements 17.1, 17.2: Auto-replay up to 2 times, then pause
   */
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if ('isBuffering' in status) {
      setIsBuffering(status.isBuffering || false);
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
  }, [disableReplayLimit, isActive, onVideoEnd]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t.reels.loadFailed}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
        >
          <Text style={styles.retryText}>{t.reels.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      <Video
        ref={videoRef}
        source={{
          uri: reel.videoUrl,
          // ✅ Critical for Android HLS: Tell ExoPlayer this is an HLS stream
          ...(reel.videoUrl.includes('.m3u8') ? { overrideFileExtensionAndroid: 'm3u8' } : {}),
        }}
        style={styles.video}
        resizeMode={VIDEO_DEFAULTS.resizeMode}
        shouldPlay={isActive && isVideoLoaded && !isPausedByLimit && VIDEO_DEFAULTS.shouldPlay}
        isLooping={VIDEO_DEFAULTS.looping}
        isMuted={reel.muted !== undefined ? reel.muted : VIDEO_DEFAULTS.muted}
        onLoad={() => {
          console.log('✅ [Matches/VideoPlayer] Video loaded:', reel.videoUrl?.substring(0, 60));
          setIsLoading(false);
          setIsVideoLoaded(true);
        }}
        onError={(err: any) => {
          console.error('❌ [Matches/VideoPlayer] Error:', err, '| URL:', reel.videoUrl?.substring(0, 60));
          handleError();
        }}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        progressUpdateIntervalMillis={500}
        positionMillis={0}
      />

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
      {/* Requirement 17.2: Show replay button after 2 auto-replays */}
      {isPausedByLimit && !isLoading && (
        <TouchableOpacity
          style={styles.replayOverlay}
          onPress={handleManualReplay}
          activeOpacity={0.8}
          accessibilityLabel="Replay video"
          accessibilityRole="button"
        >
          <View style={styles.replayButton}>
            <Play size={48} color="#FFFFFF" fill="#FFFFFF" />
          </View>
          <Text style={styles.replayText}>
            Tap to replay
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
  // Replay overlay styles (Requirement 17.2)
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
