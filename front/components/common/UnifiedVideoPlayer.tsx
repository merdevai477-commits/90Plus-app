/**
 * UnifiedVideoPlayer
 *
 * Single source of truth for vertical reel-style video playback across the
 * app (reels feed, profile grid tap, modal popups). Internally it wraps
 * `expo-video` (SDK 55) — `useVideoPlayer` + `<VideoView>` — and adds:
 *
 *  - Replay limit (auto-replays at most MAX_AUTO_REPLAYS, then shows a
 *    tappable replay overlay)
 *  - Signed-URL refresh (retries the Mux URL if it returns 403)
 *  - Load timeout (shows retry UI after 15s of stuck loading)
 *  - Mux HLS detection (logs diagnostics when a Mux URL fails)
 *  - Compatibility shim for the legacy `onVideoRef` prop: we publish the
 *    `VideoPlayer` instance through the same callback so existing callers
 *    (e.g. `useReelsAudioManager`) can call `.play()` / `.pause()` on it.
 *
 * SDK 55 migration notes:
 *  - `expo-av`'s imperative <Video ref={...}> API is gone. All playback is
 *    driven through a `VideoPlayer` instance returned by `useVideoPlayer`.
 *  - `onPlaybackStatusUpdate` has been replaced by the event system: we use
 *    `useEvent(player, 'statusChange'|'playingChange'|'playToEnd'|'timeUpdate')`.
 *  - `ResizeMode.COVER` → `contentFit="cover"`.
 *  - `overrideFileExtensionAndroid` is gone. For HLS sources we set
 *    `contentType: 'hls'` on the VideoSource, which tells ExoPlayer / AVPlayer
 *    to treat the stream as HLS even when the URL has no .m3u8 extension.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnifiedReelData {
  id: string;
  videoUrl: string;
  thumbnail?: string;
  duration?: number;
  /** Optional — defaults to VIDEO_DEFAULTS.muted (audio ON, Instagram/TikTok style). */
  muted?: boolean;
}

export interface UnifiedVideoPlayerProps {
  reel: UnifiedReelData;
  isActive: boolean;
  /**
   * Receives the underlying `VideoPlayer` instance for this reel, so callers
   * can drive playback imperatively (pause-on-navigate, pause-on-background,
   * etc). Called with `null` on unmount. Shape kept backward-compatible with
   * the old expo-av `ref` shape.
   */
  onVideoRef: (player: any | null, id: string) => void;
  /** Disable the 2-replay cap. Mostly used in tests. */
  disableReplayLimit?: boolean;
  /** Show the horizontal progress bar. Defaults to true. */
  showProgressBar?: boolean;
  /** Override the default muted state (takes precedence over reel.muted). */
  muted?: boolean;
  /** Extra style to merge onto the video container. */
  style?: any;
}

// ─── Styling tokens ───────────────────────────────────────────────────────────

const COLORS = {
  primary: '#FFD700',
  background: '#000000',
  error: '#FF5252',
  progressBg: 'rgba(255, 255, 255, 0.3)',
  progressFill: '#32cd32',
} as const;

/**
 * Build a VideoSource from a plain URL. Adds Mux HLS hints when the URL looks
 * like a Mux playback URL so both Android (ExoPlayer) and iOS (AVPlayer) pick
 * the right loader.
 */
function buildVideoSource(url: string): VideoSource {
  const isHls = url.includes('stream.mux.com') || url.includes('.m3u8');
  return {
    uri: url,
    ...(isHls ? { contentType: 'hls' as const } : {}),
  };
}

// ─── Internal implementation ──────────────────────────────────────────────────

const UnifiedVideoPlayerInternal: React.FC<UnifiedVideoPlayerProps> = ({
  reel,
  isActive,
  onVideoRef,
  disableReplayLimit = false,
  showProgressBar = true,
  muted: overrideMuted,
  style,
}) => {
  // -------- URL management (signed URL refresh support) --------
  const [activeVideoUrl, setActiveVideoUrl] = useState(reel.videoUrl);
  const signedUrlRefreshAttempts = useRef(0);
  const MAX_SIGNED_URL_REFRESHES = 2;

  // Reset URL when the parent passes a new reel.videoUrl (e.g. upload processed → new signed URL).
  useEffect(() => {
    setActiveVideoUrl(reel.videoUrl);
    signedUrlRefreshAttempts.current = 0;
  }, [reel.videoUrl]);

  // -------- Resolve muted state (override > reel prop > default) --------
  const isMuted =
    overrideMuted !== undefined
      ? overrideMuted
      : reel.muted !== undefined
        ? reel.muted
        : VIDEO_DEFAULTS.muted;

  // -------- Create the player --------
  const player = useVideoPlayer(buildVideoSource(activeVideoUrl), (p) => {
    p.muted = isMuted;
    p.loop = VIDEO_DEFAULTS.looping;
    p.timeUpdateEventInterval = VIDEO_DEFAULTS.timeUpdateEventInterval;
    p.audioMixingMode = 'auto';
    if (isActive && VIDEO_DEFAULTS.autoplay) {
      p.play();
    }
  });

  // Publish player to parent (imperative control — backward-compat with useReelsAudioManager).
  useEffect(() => {
    onVideoRef(player, reel.id);
    return () => {
      onVideoRef(null, reel.id);
    };
  }, [player, reel.id, onVideoRef]);

  // Keep muted in sync when prop changes
  useEffect(() => {
    try {
      player.muted = isMuted;
    } catch {
      /* player may be releasing */
    }
  }, [player, isMuted]);

  // -------- Replay limit tracking --------
  const { isPausedByLimit, onVideoEnd, onManualReplay, resetReplayCount } = useVideoReplayLimit(
    reel.id,
    MAX_AUTO_REPLAYS,
  );

  useEffect(() => {
    if (!isActive) resetReplayCount();
  }, [isActive, resetReplayCount]);

  // -------- Status / events via useEvent --------
  // useEvent returns the stateful snapshot of the last payload — perfect for rendering.
  const { status, error: playerError } = useEvent(player, 'statusChange', {
    status: player.status,
    error: undefined as { message: string } | undefined,
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });

  // `playToEnd` fires once when the video hits the end — count replays off that.
  useEvent(player, 'playToEnd', undefined);
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playToEnd', () => {
      if (disableReplayLimit || !isActive) return;
      const shouldContinue = onVideoEnd();
      if (shouldContinue) {
        // replay: seek to start and resume
        try {
          player.currentTime = 0;
          player.play();
        } catch {
          /* ignore */
        }
      } else {
        // cap reached — pause and show overlay
        try {
          player.pause();
        } catch {
          /* ignore */
        }
      }
    });
    return () => {
      sub?.remove?.();
    };
  }, [player, disableReplayLimit, isActive, onVideoEnd]);

  // -------- Playback control (play/pause on isActive change) --------
  useEffect(() => {
    if (!player) return;
    const shouldPlay = isActive && !isPausedByLimit;
    try {
      if (shouldPlay) {
        if (!player.playing) player.play();
      } else if (player.playing) {
        player.pause();
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (!msg.includes('released') && !msg.includes('already')) {
        logger.debug(`[UnifiedVideoPlayer] play/pause for ${reel.id}:`, msg);
      }
    }
  }, [player, isActive, isPausedByLimit, reel.id]);

  // Resume when screen regains focus
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        if (!player || !isActive || isPausedByLimit) return;
        try {
          if (!player.playing) player.play();
        } catch {
          /* ignore */
        }
      }, 200);
      return () => clearTimeout(timer);
    }, [player, isActive, isPausedByLimit]),
  );

  // -------- Loading / error UI state --------
  const isLoading = status === 'loading' || status === 'idle';
  const isReady = status === 'readyToPlay';
  const hasError = status === 'error';

  // Load-timeout: show the retry screen if we're still loading after 15s.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (!isActive) return;
    if (!isLoading || isReady) {
      setLoadTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!isReady) {
        logger.warn(`[UnifiedVideoPlayer] ⏰ Load timeout for reel ${reel.id}`);
        setLoadTimedOut(true);
      }
    }, 15_000);
    return () => clearTimeout(timer);
  }, [isActive, isLoading, isReady, reel.id]);

  // -------- Signed-URL refresh on error --------
  const { getToken } = useAuth();
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    if (!hasError) return;
    const msg = playerError?.message ?? 'Unknown error';
    logger.error(`[UnifiedVideoPlayer] ❌ Video error for reel ${reel.id}: ${msg}`);
    logger.error(`[UnifiedVideoPlayer] ❌ URL was: ${activeVideoUrl.substring(0, 80)}...`);

    // Try to refresh signed URL if this looks like a 403 / expired URL case.
    const isSignedUrl = activeVideoUrl.includes('X-Amz-Signature');
    if (
      isSignedUrl &&
      signedUrlRefreshAttempts.current < MAX_SIGNED_URL_REFRESHES
    ) {
      signedUrlRefreshAttempts.current += 1;
      logger.info(
        `[UnifiedVideoPlayer] Attempting signed URL refresh (attempt ${signedUrlRefreshAttempts.current}) for reel ${reel.id}`,
      );

      (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const res = await fetch(`${getApiUrl()}/reels/${reel.id}/signed-url`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = await res.json();
          const newUrl: string | undefined = data?.data?.signedUrl;
          if (newUrl) {
            logger.info(`[UnifiedVideoPlayer] Signed URL refreshed for reel ${reel.id}`);
            setActiveVideoUrl(newUrl);
            setErrorDetails('');
            try {
              await player.replaceAsync(buildVideoSource(newUrl));
              if (isActive) player.play();
            } catch (replaceErr) {
              logger.warn('[UnifiedVideoPlayer] replaceAsync failed:', replaceErr);
            }
          }
        } catch (refreshErr) {
          logger.warn('[UnifiedVideoPlayer] Signed URL refresh failed:', refreshErr);
        }
      })();
      return;
    }

    // Mux-specific diagnostic: HEAD the URL to surface 403/404 in the UI.
    const isMux = activeVideoUrl.includes('stream.mux.com') || activeVideoUrl.includes('.m3u8');
    if (isMux) {
      (async () => {
        try {
          const head = await fetch(activeVideoUrl, { method: 'HEAD' });
          logger.info(`[UnifiedVideoPlayer] 🔍 Mux HEAD status: ${head.status} ${head.statusText}`);
          if (head.status === 403 || head.status === 404) {
            setErrorDetails(`Mux: ${head.status} - الفيديو غير متاح أو انتهت صلاحيته`);
          }
        } catch (headErr) {
          logger.warn('[UnifiedVideoPlayer] 🔍 HEAD request failed (network issue):', headErr);
          setErrorDetails('مشكلة في الاتصال بخادم الفيديو');
        }
      })();
    }
  }, [hasError, playerError, activeVideoUrl, reel.id, getToken, player, isActive]);

  // -------- Manual retry / manual replay --------
  const handleRetry = useCallback(() => {
    signedUrlRefreshAttempts.current = 0;
    setErrorDetails('');
    setLoadTimedOut(false);
    setActiveVideoUrl(reel.videoUrl);
    try {
      player.replaceAsync(buildVideoSource(reel.videoUrl));
      if (isActive) player.play();
    } catch (e) {
      logger.warn('[UnifiedVideoPlayer] handleRetry replaceAsync failed:', e);
    }
  }, [reel.videoUrl, player, isActive]);

  const handleManualReplay = useCallback(() => {
    onManualReplay();
    try {
      player.currentTime = 0;
      player.play();
    } catch (e) {
      logger.warn('[UnifiedVideoPlayer] Error restarting video:', e);
    }
  }, [onManualReplay, player]);

  // -------- Render ---------
  const { t } = useLanguage();
  const showErrorUi = (hasError || loadTimedOut) && !isLoading;

  if (showErrorUi) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Text style={styles.errorText}>{t.reels?.loadFailed || 'Failed to load video'}</Text>
        {errorDetails ? <Text style={styles.errorDetailText}>{errorDetails}</Text> : null}
        {loadTimedOut && !errorDetails ? (
          <Text style={styles.errorDetailText}>انتهت مهلة تحميل الفيديو. تحقق من اتصالك.</Text>
        ) : null}
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>{t.reels?.retry || 'Retry'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const duration = player.duration;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <View style={[styles.videoContainer, style]}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit={VIDEO_DEFAULTS.contentFit}
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      {/* Loading / buffering indicator */}
      {(isLoading || !isPlaying) && !hasError && isActive && (
        <View style={styles.loadingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {/* Progress bar */}
      {showProgressBar && duration > 0 && (
        <View style={styles.progressContainer} pointerEvents="none">
          <View style={styles.progressBackground}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}

      {/* Replay overlay — shown when user hit the replay cap */}
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
          <Text style={styles.replayText}>{t.reels?.tapToReplay || 'Tap to replay'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  errorDetailText: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center' as const,
    paddingHorizontal: 20,
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

// ─── Exported component with Error Boundary ───────────────────────────────────

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

export default UnifiedVideoPlayer;
