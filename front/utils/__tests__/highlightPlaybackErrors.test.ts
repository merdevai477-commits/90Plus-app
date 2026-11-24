import {
  classifyHttpStatusForDirectSource,
  classifyYouTubeErrorCode,
  classifyYouTubeProbeSignal,
  isYouTubeBridgeDiagnosticSignal,
  isYouTubePlaybackProgressSignal,
  isYouTubePlayerReadySignal,
  isYouTubePlayingSignal,
  parseYouTubeProbeMessage,
  pickFinalPlaybackReason,
  playbackErrorMessageKey,
  shouldOfferOpenInYouTube,
  youtubeBridgeMessageKind,
} from '../highlightPlaybackErrors';

describe('highlightPlaybackErrors', () => {
  describe('classifyHttpStatusForDirectSource', () => {
    it('treats 404 as SOURCE_NOT_FOUND', () => {
      expect(classifyHttpStatusForDirectSource(404)).toBe('SOURCE_NOT_FOUND');
    });

    it('treats 410 as SOURCE_EXPIRED', () => {
      expect(classifyHttpStatusForDirectSource(410)).toBe('SOURCE_EXPIRED');
    });

    it('does not classify generic 403 as GEO_RESTRICTED', () => {
      expect(classifyHttpStatusForDirectSource(403)).toBe('UNKNOWN_ERROR');
      expect(classifyHttpStatusForDirectSource(403)).not.toBe('GEO_RESTRICTED');
    });

    it('returns null for successful 200/206', () => {
      expect(classifyHttpStatusForDirectSource(200)).toBeNull();
      expect(classifyHttpStatusForDirectSource(206)).toBeNull();
    });
  });

  describe('classifyYouTubeProbeSignal', () => {
    it('keeps explicit GEO_RESTRICTED distinct from fake-country DOM copy', () => {
      expect(
        classifyYouTubeProbeSignal(
          'reason:GEO_RESTRICTED:abc:https://www.youtube-nocookie.com/embed/abc',
        ),
      ).toBe('GEO_RESTRICTED');
      expect(
        classifyYouTubeProbeSignal(
          'The owner has not made this video available in your country',
        ),
      ).toBe('EMBED_UNAVAILABLE');
    });

    it('maps embed-disabled and error 150 to EMBED_UNAVAILABLE', () => {
      expect(
        classifyYouTubeProbeSignal('Playback on other websites has been disabled by the video owner'),
      ).toBe('EMBED_UNAVAILABLE');
      expect(classifyYouTubeProbeSignal('reason:EMBED_UNAVAILABLE:https://yt.example/x')).toBe(
        'EMBED_UNAVAILABLE',
      );
      expect(classifyYouTubeProbeSignal('onError {"info": 150}')).toBe('EMBED_UNAVAILABLE');
    });

    it('maps YouTube IFrame error codes including 5 and 153', () => {
      expect(classifyYouTubeProbeSignal('onError {"info": 100}')).toBe('SOURCE_NOT_FOUND');
      expect(classifyYouTubeErrorCode(100)).toBe('SOURCE_NOT_FOUND');
      expect(classifyYouTubeErrorCode(150)).toBe('EMBED_UNAVAILABLE');
      expect(classifyYouTubeErrorCode(101)).toBe('EMBED_UNAVAILABLE');
      expect(classifyYouTubeErrorCode(153)).toBe('EMBED_UNAVAILABLE');
      expect(classifyYouTubeErrorCode(5)).toBe('PLAYER_INITIALIZATION_FAILED');
      expect(parseYouTubeProbeMessage('reason:YT_ERROR:153:vid:https://90plus.pro/')).toEqual({
        reason: 'EMBED_UNAVAILABLE',
        youtubeErrorCode: 153,
        isProgress: false,
      });
      expect(parseYouTubeProbeMessage('reason:YT_ERROR:101:vid:https://90plus.pro/').youtubeErrorCode).toBe(
        101,
      );
      expect(parseYouTubeProbeMessage('reason:YT_ERROR:5:vid:https://90plus.pro/')).toEqual({
        reason: 'PLAYER_INITIALIZATION_FAILED',
        youtubeErrorCode: 5,
        isProgress: false,
      });
      expect(shouldOfferOpenInYouTube('EMBED_UNAVAILABLE')).toBe(true);
      expect(shouldOfferOpenInYouTube('SOURCE_NOT_FOUND')).toBe(false);
    });

    it('does not invent geo from bare video unavailable text', () => {
      expect(classifyYouTubeProbeSignal('Video unavailable')).toBeNull();
    });

    it('treats PLAYER_READY / PLAYING as progress, not failure', () => {
      expect(isYouTubePlayerReadySignal('reason:PLAYER_READY:abc:https://90plus.pro/')).toBe(true);
      expect(isYouTubePlayingSignal('reason:PLAYING:abc:https://90plus.pro/')).toBe(true);
      expect(isYouTubePlayingSignal('reason:PLAYER_READY:abc:https://90plus.pro/')).toBe(false);
      expect(isYouTubePlaybackProgressSignal('reason:PLAYER_READY:https://90plus.pro/')).toBe(true);
      expect(classifyYouTubeProbeSignal('reason:PLAYER_READY:https://90plus.pro/')).toBeNull();
      expect(classifyYouTubeProbeSignal('reason:PLAYING:https://90plus.pro/')).toBeNull();
    });

    it('accepts embed failures posted with video id but 90plus location', () => {
      expect(
        classifyYouTubeProbeSignal('reason:EMBED_UNAVAILABLE:qjEXEEBQgqo:https://90plus.pro/'),
      ).toBe('EMBED_UNAVAILABLE');
    });

    it('treats bridge diagnostics as non-failure progress', () => {
      expect(isYouTubeBridgeDiagnosticSignal('reason:BRIDGE_HELLO:vid:https://90plus.pro/')).toBe(
        true,
      );
      expect(isYouTubeBridgeDiagnosticSignal('reason:PAGE_SCRIPT_START:vid:https://90plus.pro/')).toBe(
        true,
      );
      expect(isYouTubeBridgeDiagnosticSignal('reason:PAGE_LOADED:vid:https://90plus.pro/')).toBe(true);
      expect(parseYouTubeProbeMessage('reason:BRIDGE_HELLO:vid:https://90plus.pro/')).toEqual({
        reason: null,
        youtubeErrorCode: null,
        isProgress: true,
      });
      expect(youtubeBridgeMessageKind('reason:YT_ERROR:153:vid:https://90plus.pro/?rn_sid=1')).toBe(
        'YT_ERROR:153',
      );
      expect(youtubeBridgeMessageKind('reason:PLAYER_READY:vid:https://90plus.pro/')).toBe(
        'PLAYER_READY',
      );
    });
  });

  describe('message keys and final reason', () => {
    it('maps unsupported host reason to unsupported message key', () => {
      expect(playbackErrorMessageKey('UNSUPPORTED_PROVIDER')).toBe('playbackUnsupportedProvider');
      expect(playbackErrorMessageKey('GEO_RESTRICTED')).toBe('playbackGeoRestricted');
      expect(playbackErrorMessageKey('EMBED_UNAVAILABLE')).toBe('playbackEmbedUnavailable');
    });

    it('picks the most actionable final reason', () => {
      expect(
        pickFinalPlaybackReason(['UNSUPPORTED_PROVIDER', 'SOURCE_NOT_FOUND', 'NETWORK_ERROR']),
      ).toBe('SOURCE_NOT_FOUND');
      expect(pickFinalPlaybackReason(['NETWORK_ERROR', 'GEO_RESTRICTED'])).toBe('GEO_RESTRICTED');
      expect(pickFinalPlaybackReason(['GEO_RESTRICTED', 'EMBED_UNAVAILABLE'])).toBe(
        'EMBED_UNAVAILABLE',
      );
      expect(pickFinalPlaybackReason([])).toBe('UNKNOWN_ERROR');
    });
  });
});
