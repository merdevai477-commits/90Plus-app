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

/**
 * Classify YouTube embed probe payloads.
 * Only confirmed country/region phrasing becomes GEO_RESTRICTED.
 */
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

export function classifyYouTubeProbeSignal(raw: string): PlaybackFailureReason | null {
  const text = raw.trim();
  if (!text) return null;

  // Success / progress messages must never map to a failure reason.
  if (isYouTubePlaybackProgressSignal(text)) return null;

  const reasonPrefix = text.match(/^reason:([A-Z_]+):/i);
  if (reasonPrefix) {
    const code = reasonPrefix[1].toUpperCase() as PlaybackFailureReason;
    // Legacy probes sent GEO_RESTRICTED for YouTube's fake country banner.
    if (code === 'GEO_RESTRICTED') return 'EMBED_UNAVAILABLE';
    if ((PLAYBACK_FAILURE_REASONS as readonly string[]).includes(code)) return code;
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
  if (/"info"\s*:\s*101\b/.test(text) || /\berror\s*101\b/i.test(text)) {
    return 'EMBED_UNAVAILABLE';
  }
  if (/"info"\s*:\s*100\b/.test(text) || /\berror\s*100\b/i.test(text)) {
    return 'SOURCE_NOT_FOUND';
  }

  // YouTube embeds (esp. iOS WKWebView + rights-claimed clips) often show a
  // *fake* "unavailable in your country" banner for embed/eurl failures while
  // the same watch URL plays fine. Treat as embed-unavailable so we offer
  // Open in YouTube instead of a misleading geo message.
  const youtubeFakeCountryOrEmbed =
    /not made this video available in your country/i.test(text) ||
    /unavailable in your country/i.test(text) ||
    /isn't available in your country/i.test(text) ||
    /is not available in your country/i.test(text) ||
    /غير متاح في بلدك/i.test(text) ||
    /غير متاح في بلدكم/i.test(text) ||
    (/video unavailable/i.test(text) && /country|region|بلد/i.test(text));

  if (youtubeFakeCountryOrEmbed) return 'EMBED_UNAVAILABLE';

  if (/onError/i.test(text) && /150|101/.test(text)) return 'EMBED_UNAVAILABLE';
  if (/onError/i.test(text) && /100/.test(text)) return 'SOURCE_NOT_FOUND';

  if (lower.includes('network') || lower.includes('timeout')) {
    return lower.includes('timeout') ? 'PLAYBACK_TIMEOUT' : 'NETWORK_ERROR';
  }

  return null;
}

export function classifyYouTubeErrorCode(code: number): PlaybackFailureReason {
  if (code === 150 || code === 101) return 'EMBED_UNAVAILABLE';
  if (code === 100) return 'SOURCE_NOT_FOUND';
  return 'UNKNOWN_ERROR';
}

/** Prefer actionable reasons when collapsing a list of failures. */
export function pickFinalPlaybackReason(
  reasons: PlaybackFailureReason[],
): PlaybackFailureReason {
  if (!reasons.length) return 'UNKNOWN_ERROR';
  // Prefer EMBED_UNAVAILABLE over GEO: YouTube often labels embed blocks as
  // "unavailable in your country" while the same watch URL still plays.
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
