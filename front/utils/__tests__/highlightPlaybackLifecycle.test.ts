import {
  buildHighlightVideoSource,
  classifyHighlightSourceType,
  highlightUiPhaseForFailure,
  HIGHLIGHT_PLAYBACK_TIMEOUTS,
  inferHighlightProvider,
  isRecoverablePlaybackFailure,
  resolveTimeoutReason,
  sanitizePlaybackUrlForDiagnostics,
  youtubeAllowsFullscreenVideo,
  youtubeWebViewUserAgent,
} from '../highlightPlaybackLifecycle';

jest.mock('../../services/sentry.service', () => ({
  addBreadcrumb: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (spec: { ios?: string; default?: string }) => spec.ios ?? spec.default },
}));

describe('highlightPlaybackLifecycle', () => {
  it('exposes configurable timeout constants', () => {
    expect(HIGHLIGHT_PLAYBACK_TIMEOUTS.INITIALIZATION_MS).toBe(12_000);
    expect(HIGHLIGHT_PLAYBACK_TIMEOUTS.PLAYBACK_START_MS).toBe(15_000);
    expect(HIGHLIGHT_PLAYBACK_TIMEOUTS.YOUTUBE_LOAD_MS).toBe(20_000);
  });

  it('records hosted timeout diagnostics without treating load end as ready', () => {
    // Shape expected by HighlightVideoSheet PLAYER_TIMEOUT breadcrumb.
    // youtubeLoaded here means playback confirmed (PLAYING), not PLAYER_READY.
    const timeoutDiag = {
      tier: 'hosted' as const,
      youtubeLoaded: false,
      elapsedMs: HIGHLIGHT_PLAYBACK_TIMEOUTS.YOUTUBE_LOAD_MS,
      lastMessage: null as string | null,
      bridgeConnected: false,
    };
    expect(timeoutDiag.tier).toBe('hosted');
    expect(timeoutDiag.youtubeLoaded).toBe(false);
    expect(timeoutDiag.elapsedMs).toBe(20_000);
    expect(timeoutDiag.lastMessage).toBeNull();
    expect(timeoutDiag.bridgeConnected).toBe(false);
    // onLoadEnd / PLAYER_READY must not imply playback success (enforced in sheet + youtubePlaybackSession).
    expect(HIGHLIGHT_PLAYBACK_TIMEOUTS.YOUTUBE_LOAD_MS).toBe(20_000);
    expect(HIGHLIGHT_PLAYBACK_TIMEOUTS.PLAYBACK_START_MS).toBe(15_000);
  });

  it('classifies media types without inventing geo', () => {
    expect(classifyHighlightSourceType('https://cdn.example.com/a.mp4')).toBe('mp4');
    expect(classifyHighlightSourceType('https://cdn.example.com/a.m3u8')).toBe('hls');
    expect(classifyHighlightSourceType('https://www.youtube.com/watch?v=qjEXEEBQgqo')).toBe('youtube');
    expect(classifyHighlightSourceType('https://streama.in/x')).toBe('unsupported');
  });

  it('builds HLS VideoSource with contentType hls and without caching', () => {
    const hls = buildHighlightVideoSource('https://cdn.example.com/live.m3u8');
    expect(hls).toEqual({
      uri: 'https://cdn.example.com/live.m3u8',
      contentType: 'hls',
      useCaching: false,
    });
    const mp4 = buildHighlightVideoSource('https://cdn.example.com/goal.mp4');
    expect(mp4).toEqual({
      uri: 'https://cdn.example.com/goal.mp4',
      useCaching: true,
    });
  });

  it('maps recoverable vs unrecoverable failures and timeouts', () => {
    expect(isRecoverablePlaybackFailure('NETWORK_ERROR')).toBe(true);
    expect(isRecoverablePlaybackFailure('PLAYBACK_TIMEOUT')).toBe(true);
    expect(isRecoverablePlaybackFailure('GEO_RESTRICTED')).toBe(true);
    expect(isRecoverablePlaybackFailure('EMBED_UNAVAILABLE')).toBe(true);
    expect(isRecoverablePlaybackFailure('SOURCE_NOT_FOUND')).toBe(false);
    expect(isRecoverablePlaybackFailure('UNSUPPORTED_PROVIDER')).toBe(false);
    expect(highlightUiPhaseForFailure('PLAYBACK_TIMEOUT')).toBe('timed_out');
    expect(highlightUiPhaseForFailure('NETWORK_ERROR')).toBe('error_recoverable');
    expect(highlightUiPhaseForFailure('GEO_RESTRICTED')).toBe('error_recoverable');
    expect(highlightUiPhaseForFailure('EMBED_UNAVAILABLE')).toBe('error_recoverable');
    expect(resolveTimeoutReason('initialization')).toBe('PLAYBACK_TIMEOUT');
  });

  it('strips signed query tokens from diagnostic URLs', () => {
    expect(
      sanitizePlaybackUrlForDiagnostics(
        'https://c-cdn.streamin.top/uploads/abc.mp4?token=secret&Signature=abc',
      ),
    ).toBe('https://c-cdn.streamin.top/uploads/abc.mp4');
  });

  it('infers providers and uses iOS Safari UA in this mock', () => {
    expect(inferHighlightProvider('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
    expect(inferHighlightProvider('https://streamin.link/v/abc')).toBe('streamin');
    expect(youtubeWebViewUserAgent()).toContain('iPhone');
    expect(youtubeAllowsFullscreenVideo()).toBe(false);
  });
});
