import { optimizeReelPlaybackUrl } from '../reelPlaybackUrl';

describe('optimizeReelPlaybackUrl', () => {
  it('caps a Mux HLS master at 720p', () => {
    expect(optimizeReelPlaybackUrl('https://stream.mux.com/abc.m3u8')).toBe(
      'https://stream.mux.com/abc.m3u8?max_resolution=720p',
    );
  });

  it('keeps an existing query string', () => {
    expect(
      optimizeReelPlaybackUrl('https://stream.mux.com/abc.m3u8?redundant_streams=true'),
    ).toBe('https://stream.mux.com/abc.m3u8?redundant_streams=true&max_resolution=720p');
  });

  it('does not stack the cap twice', () => {
    const url = 'https://stream.mux.com/abc.m3u8?max_resolution=1080p';
    expect(optimizeReelPlaybackUrl(url)).toBe(url);
  });

  it('leaves progressive files and non-Mux urls unchanged', () => {
    expect(optimizeReelPlaybackUrl('https://cdn.example.com/v.mp4')).toBe(
      'https://cdn.example.com/v.mp4',
    );
    expect(optimizeReelPlaybackUrl('https://stream.mux.com/abc/high.mp4')).toBe(
      'https://stream.mux.com/abc/high.mp4',
    );
  });
});
