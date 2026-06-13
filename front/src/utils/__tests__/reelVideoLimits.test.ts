import {
  MAX_REEL_VIDEO_BYTES,
  MAX_REEL_VIDEO_MB,
  formatReelTooLargeMessage,
  formatVideoSizeMb,
  isReelVideoOverSizeLimit,
  isStagedReelUploadUri,
} from '../reelVideoLimits';

describe('reelVideoLimits', () => {
  it('uses 50MB limit matching backend', () => {
    expect(MAX_REEL_VIDEO_MB).toBe(50);
    expect(MAX_REEL_VIDEO_BYTES).toBe(50 * 1024 * 1024);
  });

  it('detects oversized files', () => {
    expect(isReelVideoOverSizeLimit(MAX_REEL_VIDEO_BYTES)).toBe(false);
    expect(isReelVideoOverSizeLimit(MAX_REEL_VIDEO_BYTES + 1)).toBe(true);
  });

  it('formats size in MB safely', () => {
    expect(formatVideoSizeMb(0)).toBe('0.0');
    expect(formatVideoSizeMb(52 * 1024 * 1024)).toBe('52.0');
  });

  it('formats too-large message without throwing', () => {
    const msg = formatReelTooLargeMessage('', 55 * 1024 * 1024);
    expect(msg).toContain('55.0');
    expect(msg).toContain('50');
  });

  it('replaces i18n placeholders', () => {
    const msg = formatReelTooLargeMessage(
      'Video {size} MB max {max}',
      60 * 1024 * 1024,
    );
    expect(msg).toBe('Video 60.0 MB max 50');
  });

  it('detects staged cache URIs', () => {
    expect(isStagedReelUploadUri('file:///cache/reel-upload-123.mp4')).toBe(true);
    expect(isStagedReelUploadUri('ph://asset')).toBe(false);
    expect(isStagedReelUploadUri(null)).toBe(false);
  });
});
