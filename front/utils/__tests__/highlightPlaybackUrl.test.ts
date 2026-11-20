import { isDirectHighlightFile, resolveHighlightPlaybackUrl, youtubeEmbedDocument, youtubeEmbedUrl } from '../highlightPlaybackUrl';

describe('resolveHighlightPlaybackUrl', () => {
  it('turns a Streamin watch page into the mp4 file', () => {
    expect(resolveHighlightPlaybackUrl('https://streamin.link/v/76ce927b')).toBe(
      'https://w-cdn.streamin.top/uploads/76ce927b.mp4',
    );
    expect(resolveHighlightPlaybackUrl('https://streamin.me/v/76ce927b')).toBe(
      'https://w-cdn.streamin.top/uploads/76ce927b.mp4',
    );
    expect(isDirectHighlightFile('https://w-cdn.streamin.top/uploads/76ce927b.mp4')).toBe(true);
  });

  it('leaves an existing video file untouched', () => {
    const file = 'https://cdn.example.com/goal.mp4?token=1';
    expect(resolveHighlightPlaybackUrl(file)).toBe(file);
  });

  it('builds a player-only YouTube embed from a watch link', () => {
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=qjEXEEBQgqo')).toBe(
      'https://www.youtube.com/embed/qjEXEEBQgqo?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=1&iv_load_policy=3&enablejsapi=1&origin=https%3A%2F%2F90plus.pro',
    );
    expect(youtubeEmbedUrl('https://youtu.be/6Nk3FShw4XM')).toContain('/embed/6Nk3FShw4XM?');
    expect(youtubeEmbedDocument('_jxHAw-yH3E')).toContain('youtube.com/embed/_jxHAw-yH3E');
  });
});
