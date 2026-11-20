import {
  classifyHttpStatusForDirectSource,
  classifyYouTubeErrorCode,
  classifyYouTubeProbeSignal,
  pickFinalPlaybackReason,
  playbackErrorMessageKey,
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
    it('maps confirmed geo evidence to GEO_RESTRICTED', () => {
      expect(
        classifyYouTubeProbeSignal(
          'reason:GEO_RESTRICTED:https://www.youtube-nocookie.com/embed/abc',
        ),
      ).toBe('GEO_RESTRICTED');
      expect(
        classifyYouTubeProbeSignal(
          'The owner has not made this video available in your country',
        ),
      ).toBe('GEO_RESTRICTED');
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

    it('maps YouTube error 100 to SOURCE_NOT_FOUND', () => {
      expect(classifyYouTubeProbeSignal('onError {"info": 100}')).toBe('SOURCE_NOT_FOUND');
      expect(classifyYouTubeErrorCode(100)).toBe('SOURCE_NOT_FOUND');
      expect(classifyYouTubeErrorCode(150)).toBe('EMBED_UNAVAILABLE');
      expect(classifyYouTubeErrorCode(101)).toBe('EMBED_UNAVAILABLE');
    });

    it('does not invent geo from bare video unavailable text', () => {
      expect(classifyYouTubeProbeSignal('Video unavailable')).toBeNull();
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
      expect(pickFinalPlaybackReason([])).toBe('UNKNOWN_ERROR');
    });
  });
});
