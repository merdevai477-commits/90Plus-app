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
  AppState,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type AppStateStatus,
} from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { Play } from 'lucide-react-native';
import { useAuth } from '@clerk/clerk-expo';

import { useLanguage } from '../../contexts/LanguageContext';
import { useVideoReplayLimit, MAX_AUTO_REPLAYS } from '../../hooks/useVideoReplayLimit';
import { VIDEO_DEFAULTS } from '../../utils/videoConfig';
import { VideoErrorBoundary } from './VideoErrorBoundary';
import { logger } from '../../utils/logger';
import { captureException } from '../../services/sentry.service';
import { getApiUrl } from '../../config/api.config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  /** Called when the error boundary catches a playback/render failure. */
  onNativeError?: (error: Error) => void;
}

// ─── Styling tokens ───────────────────────────────────────────────────────────

const COLORS = {
  primary: '#22c55e',
  background: '#000000',
  error: '#FF5252',
  progressBg: 'rgba(255, 255, 255, 0.3)',
  progressFill: '#22c55e',
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

/**
 * Returns true if the given URL is clearly NOT a playable video source
 * (empty, a thumbnail endpoint, or an obvious image extension). Prevents
 * the player from spending 15s trying to decode an image as video.
 */
function isInvalidVideoUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (trimmed.length === 0) return true;
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('file://')) return true;
  const lower = trimmed.toLowerCase();
  // Thumbnail endpoints and image extensions are never valid video sources.
  if (lower.includes('/thumbnails/') || lower.includes('/thumbnail/')) return true;
  if (/\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|$)/i.test(lower)) return true;
  return false;
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
  const { t } = useLanguage();
  const mountedRef = useRef(true);
  /** Skip player.replace on first mount — useVideoPlayer already loads the source; double-load crashes AVPlayer on iOS. */
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadedUrlRef.current = null;
  }, [reel.id]);

  // -------- URL management (signed URL refresh support) --------
  const [activeVideoUrl, setActiveVideoUrl] = useState(reel.videoUrl);
  const signedUrlRefreshAttempts = useRef(0);
  const MAX_SIGNED_URL_REFRESHES = 2;

  // Guard: fail-fast if the URL is clearly not a video (empty, thumbnail
  // endpoint, image extension). Prevents the 15s spin-and-timeout cycle.
  const invalidSource = isInvalidVideoUrl(activeVideoUrl);

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
  // When the URL is invalid we pass an empty source so expo-video stays idle
  // instead of trying (and failing) to decode an image as a video. The
  // early-return below renders a proper error UI immediately.
  const player = useVideoPlayer(
    invalidSource ? null : buildVideoSource(activeVideoUrl),
    (p) => {
      try {
        p.muted = isMuted;
        p.loop = VIDEO_DEFAULTS.looping;
        p.timeUpdateEventInterval = VIDEO_DEFAULTS.timeUpdateEventInterval;
        p.audioMixingMode = 'auto';
      } catch (e) {
        logger.warn('[UnifiedVideoPlayer] Player init failed:', e);
      }
      // Never call play() here — multiple reels mounting together on iOS
      // causes native AVPlayer crashes. Playback starts in the isActive effect.
    },
  );

  // Swap HLS only when URL changes after initial mount (signed-URL refresh, etc.).
  useEffect(() => {
    const nextUrl = reel.videoUrl;
    if (isInvalidVideoUrl(nextUrl)) return;

    if (loadedUrlRef.current === null) {
      loadedUrlRef.current = nextUrl;
      return;
    }
    if (loadedUrlRef.current === nextUrl) return;

    loadedUrlRef.current = nextUrl;
    try {
      if (player.playing) player.pause();
      player.replace(buildVideoSource(nextUrl));
    } catch (e) {
      logger.warn('[UnifiedVideoPlayer] replace on URL change failed:', e);
    }
  }, [reel.videoUrl, reel.id, player]);

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

  // `playToEnd` fires once when the video hits the end — count replays off
  // that. We register a single listener via `addListener` below; the previous
  // additional `useEvent(player, 'playToEnd', undefined)` line was a redundant
  // subscription that caused the end-of-video logic to run twice and exhaust
  // the auto-replay budget after a single play.
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
  const attemptPlay = useCallback(() => {
    if (!player || invalidSource) return;
    const shouldPlay = isActive && !isPausedByLimit && VIDEO_DEFAULTS.autoplay;
    try {
      if (!shouldPlay) {
        if (player.playing) player.pause();
        return;
      }
      // iOS can start audio before the VideoView layer is ready — keep paused until ready.
      if (status !== 'readyToPlay') {
        if (player.playing) player.pause();
        return;
      }
      if (!player.playing) player.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('released') && !msg.includes('already')) {
        logger.debug(`[UnifiedVideoPlayer] play/pause for ${reel.id}:`, msg);
      }
    }
  }, [player, isActive, isPausedByLimit, invalidSource, status, reel.id]);

  useEffect(() => {
    attemptPlay();
  }, [attemptPlay]);

  // AVPlayer on iOS often misses the first play() after mount, tab return, or foreground.
  useEffect(() => {
    if (!isActive || invalidSource) return;
    const delays = Platform.OS === 'ios' ? [150, 400, 900] : [200];
    const timers = delays.map((ms) => setTimeout(() => attemptPlay(), ms));
    return () => timers.forEach(clearTimeout);
  }, [isActive, player, reel.id, invalidSource, attemptPlay]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setTimeout(() => attemptPlay(), 100);
      }
    });
    return () => sub.remove();
  }, [attemptPlay]);

  // Pause promptly on unmount / swap so iOS releases AVPlayer before the next source mounts.
  useEffect(() => {
    return () => {
      try {
        if (player.playing) player.pause();
        player.currentTime = 0;
      } catch {
        /* player may already be released by useVideoPlayer cleanup */
      }
    };
  }, [player, reel.id]);

  // Playback resume on tab return is handled by the parent (reels feed unmounts
  // players on blur and remounts with a fresh generation on focus).

  // -------- Loading / error UI state --------
  // If the source is invalid we report "not loading" so the timeout effect
  // never arms and we drop straight into the error UI below.
  const isLoading = !invalidSource && (status === 'loading' || status === 'idle');
  const isReady = status === 'readyToPlay';
  const hasError = !invalidSource && status === 'error';

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
  // Stable ref for getToken — avoids re-firing the error-recovery effect
  // every parent render (Clerk returns a new function reference each render).
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);
  const [errorDetails, setErrorDetails] = useState<string>('');
  // Track which (reel.id, url) pair we've already logged so we don't spam
  // the same failure message every render.
  const loggedErrorKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasError) return;
    const msg = playerError?.message ?? 'Unknown error';
    const errorKey = `${reel.id}|${activeVideoUrl}`;
    if (loggedErrorKeyRef.current !== errorKey) {
      loggedErrorKeyRef.current = errorKey;
      logger.warn(
        `[UnifiedVideoPlayer] Video load failed for reel ${reel.id}: ${msg} — url prefix: ${activeVideoUrl.substring(0, 80)}`,
      );
      const isLocalUri =
        /^file:\/\//i.test(activeVideoUrl) ||
        /^ph:\/\//i.test(activeVideoUrl) ||
        /^assets-library:\/\//i.test(activeVideoUrl) ||
        activeVideoUrl.startsWith('content://');
      if (!isLocalUri) {
        captureException(new Error(`Video load failed: ${msg}`), {
          tags: { area: 'reels', component: 'UnifiedVideoPlayer' },
          extra: { reelId: reel.id, urlPrefix: activeVideoUrl.substring(0, 80) },
        });
      }
    }

    // Refresh playback URL from API (R2 signed URL or Mux HLS) when load fails.
    const isMux = activeVideoUrl.includes('stream.mux.com') || activeVideoUrl.includes('.m3u8');
    const isSignedUrl = activeVideoUrl.includes('X-Amz-Signature');
    const canRefreshFromApi =
      !!reel.id &&
      reel.id !== 'undefined' &&
      (isSignedUrl || isMux) &&
      signedUrlRefreshAttempts.current < MAX_SIGNED_URL_REFRESHES;

    if (canRefreshFromApi) {
      signedUrlRefreshAttempts.current += 1;
      logger.info(
        `[UnifiedVideoPlayer] Refreshing playback URL (attempt ${signedUrlRefreshAttempts.current}) for reel ${reel.id}`,
      );

      (async () => {
        try {
          const token = await getTokenRef.current();
          if (!token || !mountedRef.current) return;
          const res = await fetch(`${getApiUrl()}/reels/${reel.id}/signed-url`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok || !mountedRef.current) return;
          const data = await res.json();
          const newUrl: string | undefined = data?.data?.signedUrl;
          if (newUrl && !isInvalidVideoUrl(newUrl) && mountedRef.current) {
            logger.info(`[UnifiedVideoPlayer] Playback URL refreshed for reel ${reel.id}`);
            setActiveVideoUrl(newUrl);
            loadedUrlRef.current = newUrl;
            setErrorDetails('');
            try {
              player.replace(buildVideoSource(newUrl));
              if (
                isActive &&
                mountedRef.current &&
                player.status === 'readyToPlay' &&
                !player.playing
              ) {
                player.play();
              }
            } catch (replaceErr) {
              logger.warn('[UnifiedVideoPlayer] replace failed:', replaceErr);
            }
          }
        } catch (refreshErr) {
          logger.warn('[UnifiedVideoPlayer] Playback URL refresh failed:', refreshErr);
        }
      })();
      return;
    }

    // Mux-specific diagnostic: HEAD the URL to surface 403/404 in the UI.
    if (isMux) {
      (async () => {
        try {
          const head = await fetch(activeVideoUrl, { method: 'HEAD' });
          if (!mountedRef.current) return;
          logger.info(`[UnifiedVideoPlayer] 🔍 Mux HEAD status: ${head.status} ${head.statusText}`);
          if (head.status === 403 || head.status === 404) {
            setErrorDetails(
              `Mux: ${head.status} - ${t.reels?.videoUnavailable || 'Video unavailable or link expired'}`,
            );
          }
        } catch (headErr) {
          if (!mountedRef.current) return;
          logger.warn('[UnifiedVideoPlayer] 🔍 HEAD request failed (network issue):', headErr);
          setErrorDetails(t.reels?.videoConnectionError || 'Could not reach the video server');
        }
      })();
    }
  }, [hasError, playerError, activeVideoUrl, reel.id, player, isActive, t]);

  // -------- Manual retry / manual replay --------
  const handleRetry = useCallback(() => {
    signedUrlRefreshAttempts.current = 0;
    setErrorDetails('');
    setLoadTimedOut(false);
    setActiveVideoUrl(reel.videoUrl);
    try {
      player.replace(buildVideoSource(reel.videoUrl));
      if (isActive && status === 'readyToPlay' && !player.playing) {
        player.play();
      }
    } catch (e) {
      logger.warn('[UnifiedVideoPlayer] handleRetry replace failed:', e);
    }
  }, [reel.videoUrl, player, isActive, status]);

  const handleManualReplay = useCallback(() => {
    onManualReplay();
    try {
      player.currentTime = 0;
      if (status === 'readyToPlay' && !player.playing) {
        player.play();
      }
    } catch (e) {
      logger.warn('[UnifiedVideoPlayer] Error restarting video:', e);
    }
  }, [onManualReplay, player, status]);

  // -------- Render ---------
  const showErrorUi = (hasError || loadTimedOut || invalidSource) && !isLoading;

  if (showErrorUi) {
    const invalidReason = invalidSource
      ? (t.reels?.invalidVideoSource || 'Invalid video source')
      : errorDetails
        ? errorDetails
        : loadTimedOut
          ? (t.reels?.videoLoadTimeout || 'Video load timed out. Check your connection.')
          : '';
    return (
      <View style={[styles.errorContainer, style]}>
        <Text style={styles.errorText}>{t.reels?.loadFailed || 'Failed to load video'}</Text>
        {invalidReason ? <Text style={styles.errorDetailText}>{invalidReason}</Text> : null}
        {!invalidSource && (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>{t.reels?.retry || 'Retry'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const duration = player.duration;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const containerStyle = [
    styles.videoContainer,
    Platform.OS === 'ios' && styles.videoContainerIos,
    style,
  ];
  const videoStyle = Platform.OS === 'ios' ? styles.videoIos : styles.video;

  return (
    <View style={containerStyle}>
      <VideoView
        style={videoStyle}
        player={player}
        contentFit={VIDEO_DEFAULTS.contentFit}
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      {/* Loading / buffering indicator — hide when user paused or replay cap reached */}
      {isLoading && !hasError && isActive && !isPausedByLimit && (
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
  videoContainerIos: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
  videoIos: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
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
        props.onNativeError?.(error);
      }}
    >
      <UnifiedVideoPlayerInternal {...props} />
    </VideoErrorBoundary>
  );
};

export default UnifiedVideoPlayer;
