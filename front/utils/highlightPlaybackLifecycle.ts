import { Platform } from 'react-native';
import type { VideoSource } from 'expo-video';
import { addBreadcrumb } from '../services/sentry.service';
import type { PlaybackFailureReason } from './highlightPlaybackErrors';
import { isDirectHighlightFile, youtubeVideoId } from './highlightPlaybackUrl';

/** Configurable playback watchdogs (ms). */
export const HIGHLIGHT_PLAYBACK_TIMEOUTS = {
  INITIALIZATION_MS: 12_000,
  PLAYBACK_START_MS: 15_000,
  YOUTUBE_LOAD_MS: 15_000,
} as const;

export type HighlightUiPhase =
  | 'idle'
  | 'initializing'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'error_recoverable'
  | 'error_unrecoverable'
  | 'timed_out';

export type HighlightPlaybackStage =
  | 'VIDEO_REQUESTED'
  | 'PLAYER_INITIALIZING'
  | 'PLAYER_READY'
  | 'PLAYBACK_STARTED'
  | 'PLAYBACK_STARTED_OBSERVED'
  | 'FIRST_FRAME_RENDERED'
  | 'PLAYBACK_CONFIRMED'
  | 'PLAYBACK_ERROR'
  | 'PLAYER_TIMEOUT'
  | 'PLAYER_RETRY'
  | 'PLAYER_DISPOSED';

export type HighlightSourceType = 'youtube' | 'mp4' | 'hls' | 'unsupported';

export type HighlightPlaybackDiagnosticPayload = {
  sessionId: string;
  stage: HighlightPlaybackStage;
  platform?: string;
  sourceType?: HighlightSourceType;
  provider?: string;
  playerStatus?: string;
  errorCategory?: PlaybackFailureReason | string;
  errorCode?: string;
  initMs?: number;
  readyMs?: number;
  playbackStartMs?: number;
  retryCount?: number;
  timeoutStage?: 'initialization' | 'playback_start' | 'youtube_load';
  /** Sanitized URL host/path only — never signed query tokens. */
  sourceHost?: string;
};

const RECOVERABLE: ReadonlySet<PlaybackFailureReason> = new Set([
  'NETWORK_ERROR',
  'PLAYBACK_TIMEOUT',
  'PLAYER_INITIALIZATION_FAILED',
  'DECODER_ERROR',
  'UNKNOWN_ERROR',
  'EMBED_UNAVAILABLE',
]);

export function isRecoverablePlaybackFailure(reason: PlaybackFailureReason): boolean {
  return RECOVERABLE.has(reason);
}

export function highlightUiPhaseForFailure(
  reason: PlaybackFailureReason,
): Extract<HighlightUiPhase, 'error_recoverable' | 'error_unrecoverable' | 'timed_out'> {
  if (reason === 'PLAYBACK_TIMEOUT') return 'timed_out';
  return isRecoverablePlaybackFailure(reason) ? 'error_recoverable' : 'error_unrecoverable';
}

export function classifyHighlightSourceType(url: string): HighlightSourceType {
  if (!url.trim()) return 'unsupported';
  if (youtubeVideoId(url)) return 'youtube';
  if (/\.m3u8(?:$|\?)/i.test(url)) return 'hls';
  if (isDirectHighlightFile(url) || /\.mp4(?:$|\?)/i.test(url)) return 'mp4';
  return 'unsupported';
}

export function inferHighlightProvider(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('youtube') || host === 'youtu.be') return 'youtube';
    if (host.includes('streamin')) return 'streamin';
    if (host.includes('mux.com')) return 'mux';
    return host || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Build expo-video source; set HLS contentType when needed (iOS AVPlayer requirement). */
export function buildHighlightVideoSource(url: string): VideoSource {
  const isHls = /\.m3u8(?:$|\?)/i.test(url) || url.includes('stream.mux.com');
  return {
    uri: url,
    ...(isHls ? { contentType: 'hls' as const } : {}),
    // Caching is unsupported for HLS on iOS.
    useCaching: !isHls,
  };
}

export function createHighlightPlaybackSessionId(): string {
  return `hl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip query/hash so signed tokens never reach diagnostics. */
export function sanitizePlaybackUrlForDiagnostics(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url.split('?')[0]?.split('#')[0] || 'invalid-url';
  }
}

/**
 * Platform WebView UA for YouTube embeds.
 * iOS uses Safari Mobile (WKWebView-native). Android keeps Chrome Mobile.
 * The previous Android Chrome UA on iOS was a historical spoof and is not retained.
 */
export function youtubeWebViewUserAgent(): string {
  if (Platform.OS === 'ios') {
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  }
  return 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
}

/** Fullscreen inside the modal sheet conflicts with RN Modal layout on iOS — keep disabled there. */
export function youtubeAllowsFullscreenVideo(): boolean {
  return Platform.OS !== 'ios';
}

export function emitHighlightPlaybackDiagnostic(payload: HighlightPlaybackDiagnosticPayload): void {
  try {
    addBreadcrumb(payload.stage, 'highlight-playback', payload.stage.includes('ERROR') || payload.stage.includes('TIMEOUT') ? 'error' : 'info', {
      ...payload,
      platform: payload.platform ?? Platform.OS,
    });
  } catch {
    /* diagnostics must never break playback */
  }
}

export function resolveTimeoutReason(
  stage: 'initialization' | 'playback_start' | 'youtube_load',
): PlaybackFailureReason {
  void stage;
  return 'PLAYBACK_TIMEOUT';
}
