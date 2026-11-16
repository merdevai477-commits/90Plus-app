import { isDirectHighlightFile, resolveHighlightPlaybackUrl } from '../highlightPlaybackUrl';

describe('resolveHighlightPlaybackUrl', () => {
  it('turns a Streamin watch page into the mp4 file', () => {
    expect(resolveHighlightPlaybackUrl('https://streamin.link/v/76ce927b')).toBe(
      'https://c-cdn.streamin.top/uploads/76ce927b.mp4',
    );
    expect(resolveHighlightPlaybackUrl('https://streamin.me/v/76ce927b')).toBe(
      'https://c-cdn.streamin.top/uploads/76ce927b.mp4',
    );
    expect(isDirectHighlightFile('https://c-cdn.streamin.top/uploads/76ce927b.mp4')).toBe(true);
  });

  it('leaves an existing video file untouched', () => {
    const file = 'https://cdn.example.com/goal.mp4?token=1';
    expect(resolveHighlightPlaybackUrl(file)).toBe(file);
  });
});
