/**
 * Typed failure reasons for Match Highlights / Goal Clips playback.
 * Geo is only used when provider-authoritative evidence exists.
 */

export const PLAYBACK_FAILURE_REASONS = [
  'GEO_RESTRICTED',
  'SOURCE_NOT_FOUND',
  'SOURCE_EXPIRED',
  'UNSUPPORTED_PROVIDER',
  'NETWORK_ERROR',
  'PLAYER_INITIALIZATION_FAILED',
  'DECODER_ERROR',
  'EMBED_UNAVAILABLE',
  'PLAYBACK_TIMEOUT',
  'UNKNOWN_ERROR',
] as const;

export type PlaybackFailureReason = (typeof PLAYBACK_FAILURE_REASONS)[number];

export type HighlightSourceKind = 'youtube' | 'direct' | 'unsupported';

/** Locale keys under matchDetails for user-facing playback errors. */
export type PlaybackErrorMessageKey =
  | 'playbackGeoRestricted'
  | 'playbackSourceUnavailable'
  | 'playbackSourceExpired'
  | 'playbackUnsupportedProvider'
  | 'playbackNetworkError'
  | 'playbackPlayerFailed'
  | 'playbackEmbedUnavailable'
  | 'playbackTimeout'
  | 'playbackUnknownError';

const MESSAGE_BY_REASON: Record<PlaybackFailureReason, PlaybackErrorMessageKey> = {
  GEO_RESTRICTED: 'playbackGeoRestricted',
  SOURCE_NOT_FOUND: 'playbackSourceUnavailable',
  SOURCE_EXPIRED: 'playbackSourceExpired',
  UNSUPPORTED_PROVIDER: 'playbackUnsupportedProvider',
  NETWORK_ERROR: 'playbackNetworkError',
  PLAYER_INITIALIZATION_FAILED: 'playbackPlayerFailed',
  DECODER_ERROR: 'playbackPlayerFailed',
  EMBED_UNAVAILABLE: 'playbackEmbedUnavailable',
  PLAYBACK_TIMEOUT: 'playbackTimeout',
  UNKNOWN_ERROR: 'playbackUnknownError',
};

export function playbackErrorMessageKey(reason: PlaybackFailureReason): PlaybackErrorMessageKey {
  return MESSAGE_BY_REASON[reason];
}

/** Map HTTP status from a direct-file probe. Never invents GEO from 403. */
export function classifyHttpStatusForDirectSource(status: number): PlaybackFailureReason | null {
  if (status === 404) return 'SOURCE_NOT_FOUND';
  if (status === 410) return 'SOURCE_EXPIRED';
  if (status === 200 || status === 206) return null;
  if (status === 408 || status === 504) return 'PLAYBACK_TIMEOUT';
  if (status >= 500) return 'NETWORK_ERROR';
  if (status === 403 || status === 401) return 'UNKNOWN_ERROR';
  if (status >= 400) return 'SOURCE_NOT_FOUND';
  return 'UNKNOWN_ERROR';
}

/** Player iframe constructed — NOT proof the clip can play (errors often follow). */
export function isYouTubePlayerReadySignal(raw: string): boolean {
  return /^reason:PLAYER_READY:/i.test(raw.trim());
}

/** Actual playback started (YT.PlayerState.PLAYING = 1). */
export function isYouTubePlayingSignal(raw: string): boolean {
  return /^reason:PLAYING:/i.test(raw.trim());
}

/** @deprecated Prefer isYouTubePlayingSignal — READY alone used to clear watchdogs too early. */
export function isYouTubePlaybackProgressSignal(raw: string): boolean {
  return isYouTubePlayingSignal(raw) || isYouTubePlayerReadySignal(raw);
}

/**
 * YouTube IFrame API onError codes:
 * 2 invalid request, 5 HTML5/player error, 100 not found,
 * 101/150 embedding disabled, 153 player configuration / referer.
 */
export function classifyYouTubeErrorCode(code: number): PlaybackFailureReason {
  if (code === 100) return 'SOURCE_NOT_FOUND';
  if (code === 101 || code === 150 || code === 153) return 'EMBED_UNAVAILABLE';
  if (code === 5 || code === 2) return 'PLAYER_INITIALIZATION_FAILED';
  return 'UNKNOWN_ERROR';
}

export type YouTubeProbeParseResult = {
  reason: PlaybackFailureReason | null;
  /** Raw numeric YouTube onError code when known (5, 100, 101, 150, 153, …). */
  youtubeErrorCode: number | null;
  isProgress: boolean;
};

/**
 * Parse WebView bridge messages from the hosted IFrame page / DOM probes.
 * Preserves raw YouTube error codes for Sentry; maps them to typed reasons.
 */
export function parseYouTubeProbeMessage(raw: string): YouTubeProbeParseResult {
  const text = raw.trim();
  if (!text) return { reason: null, youtubeErrorCode: null, isProgress: false };

  if (isYouTubePlaybackProgressSignal(text) || /^reason:USER_PLAY:/i.test(text)) {
    return { reason: null, youtubeErrorCode: null, isProgress: true };
  }

  const ytError = text.match(/^reason:YT_ERROR:(\d+)(?::|$)/i);
  if (ytError) {
    const code = Number.parseInt(ytError[1], 10);
    return {
      reason: classifyYouTubeErrorCode(code),
      youtubeErrorCode: Number.isFinite(code) ? code : null,
      isProgress: false,
    };
  }

  const reasonWithCode = text.match(/^reason:([A-Z_]+):(\d+)(?::|$)/i);
  if (reasonWithCode) {
    const label = reasonWithCode[1].toUpperCase();
    const code = Number.parseInt(reasonWithCode[2], 10);
    if (label === 'YT_ERROR' || Number.isFinite(code)) {
      const fromCode = Number.isFinite(code) ? classifyYouTubeErrorCode(code) : null;
      if (
        label === 'YT_ERROR' ||
        (fromCode &&
          (label === 'EMBED_UNAVAILABLE' ||
            label === 'SOURCE_NOT_FOUND' ||
            label === 'PLAYER_INITIALIZATION_FAILED'))
      ) {
        return {
          reason: fromCode ?? classifyYouTubeProbeSignal(text),
          youtubeErrorCode: Number.isFinite(code) ? code : null,
          isProgress: false,
        };
      }
    }
  }

  const inlineCode =
    text.match(/"info"\s*:\s*(2|5|100|101|150|153)\b/) ||
    text.match(/\berror\s*(2|5|100|101|150|153)\b/i) ||
    text.match(/\binfo["']?\s*[:=]\s*(2|5|100|101|150|153)\b/i);
  if (inlineCode) {
    const code = Number.parseInt(inlineCode[1], 10);
    return {
      reason: classifyYouTubeErrorCode(code),
      youtubeErrorCode: code,
      isProgress: false,
    };
  }

  return {
    reason: classifyYouTubeProbeSignal(text),
    youtubeErrorCode: null,
    isProgress: false,
  };
}

export function classifyYouTubeProbeSignal(raw: string): PlaybackFailureReason | null {
  const text = raw.trim();
  if (!text) return null;

  if (isYouTubePlaybackProgressSignal(text)) return null;

  const reasonPrefix = text.match(/^reason:([A-Z_]+):/i);
  if (reasonPrefix) {
    const code = reasonPrefix[1].toUpperCase();
    if (code === 'YT_ERROR') {
      const num = text.match(/^reason:YT_ERROR:(\d+)/i);
      if (num) return classifyYouTubeErrorCode(Number.parseInt(num[1], 10));
      return 'UNKNOWN_ERROR';
    }
    // Explicit GEO from the hosted player (rare). Do not remap — distinguish from embed blocks.
    if (code === 'GEO_RESTRICTED') return 'GEO_RESTRICTED';
    if ((PLAYBACK_FAILURE_REASONS as readonly string[]).includes(code)) {
      return code as PlaybackFailureReason;
    }
  }

  if (text.startsWith('unavailable:')) {
    return 'UNKNOWN_ERROR';
  }

  const lower = text.toLowerCase();

  if (/playback on other websites has been disabled/i.test(text)) {
    return 'EMBED_UNAVAILABLE';
  }

  if (/"info"\s*:\s*150\b/.test(text) || /\berror\s*150\b/i.test(text) || /\binfo["']?\s*[:=]\s*150\b/i.test(text)) {
    return 'EMBED_UNAVAILABLE';
  }
  if (/"info"\s*:\s*153\b/.test(text) || /\berror\s*153\b/i.test(text) || /video player configuration error/i.test(text)) {
    return 'EMBED_UNAVAILABLE';
  }
  if (/"info"\s*:\s*101\b/.test(text) || /\berror\s*101\b/i.test(text)) {
    return 'EMBED_UNAVAILABLE';
  }
  if (/"info"\s*:\s*100\b/.test(text) || /\berror\s*100\b/i.test(text)) {
    return 'SOURCE_NOT_FOUND';
  }
  if (/"info"\s*:\s*5\b/.test(text) || /\berror\s*5\b/i.test(text)) {
    return 'PLAYER_INITIALIZATION_FAILED';
  }

  // DOM "unavailable in your country" without a numeric YT error is usually a
  // fake banner for embed/referer failures — treat as embed, not geo.
  const youtubeFakeCountryOrEmbed =
    /not made this video available in your country/i.test(text) ||
    /unavailable in your country/i.test(text) ||
    /isn't available in your country/i.test(text) ||
    /is not available in your country/i.test(text) ||
    /غير متاح في بلدك/i.test(text) ||
    /غير متاح في بلدكم/i.test(text) ||
    (/video unavailable/i.test(text) && /country|region|بلد/i.test(text));

  if (youtubeFakeCountryOrEmbed) return 'EMBED_UNAVAILABLE';

  if (/onError/i.test(text) && /150|153|101/.test(text)) return 'EMBED_UNAVAILABLE';
  if (/onError/i.test(text) && /100/.test(text)) return 'SOURCE_NOT_FOUND';
  if (/onError/i.test(text) && /\b5\b/.test(text)) return 'PLAYER_INITIALIZATION_FAILED';

  if (lower.includes('network') || lower.includes('timeout')) {
    return lower.includes('timeout') ? 'PLAYBACK_TIMEOUT' : 'NETWORK_ERROR';
  }

  return null;
}

/** Prefer actionable reasons when collapsing a list of failures. */
export function pickFinalPlaybackReason(
  reasons: PlaybackFailureReason[],
): PlaybackFailureReason {
  if (!reasons.length) return 'UNKNOWN_ERROR';
  // Prefer EMBED_UNAVAILABLE over GEO when both appear: rights/embed blocks
  // often ship with misleading country copy.
  const priority: PlaybackFailureReason[] = [
    'EMBED_UNAVAILABLE',
    'GEO_RESTRICTED',
    'SOURCE_EXPIRED',
    'SOURCE_NOT_FOUND',
    'UNSUPPORTED_PROVIDER',
    'DECODER_ERROR',
    'PLAYER_INITIALIZATION_FAILED',
    'PLAYBACK_TIMEOUT',
    'NETWORK_ERROR',
    'UNKNOWN_ERROR',
  ];
  for (const candidate of priority) {
    if (reasons.includes(candidate)) return candidate;
  }
  return reasons[reasons.length - 1] ?? 'UNKNOWN_ERROR';
}

/** User-initiated YouTube open is appropriate for these outcomes. */
export function shouldOfferOpenInYouTube(reason: PlaybackFailureReason | null): boolean {
  return (
    reason === 'EMBED_UNAVAILABLE' ||
    reason === 'GEO_RESTRICTED' ||
    reason === 'PLAYBACK_TIMEOUT' ||
    reason === 'PLAYER_INITIALIZATION_FAILED'
  );
}
