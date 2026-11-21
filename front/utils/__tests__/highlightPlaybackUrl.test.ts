import {
  isDirectHighlightFile,
  preferDirectHighlightUrls,
  resolveHighlightPlaybackUrl,
  youtubeEmbedDocument,
  youtubeEmbedUrl,
} from '../highlightPlaybackUrl';

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
    const embed = youtubeEmbedUrl('https://www.youtube.com/watch?v=qjEXEEBQgqo');
    expect(embed).toContain('youtube-nocookie.com/embed/qjEXEEBQgqo?');
    expect(embed).toContain('origin=https%3A%2F%2F90plus.pro');
    expect(embed).toContain('widget_referrer=https%3A%2F%2F90plus.pro');
    expect(youtubeEmbedUrl('https://youtu.be/6Nk3FShw4XM')).toContain('/embed/6Nk3FShw4XM?');
    const doc = youtubeEmbedDocument('_jxHAw-yH3E');
    expect(doc).toContain("videoId:'_jxHAw-yH3E'");
    expect(doc).toContain('iframe_api');
    expect(doc).toContain("post('PLAYER_READY')");
    expect(doc).toContain('<base href="https://90plus.pro/">');
    expect(doc).toContain("host:'https://www.youtube-nocookie.com'");
  });

  it('orders direct MP4 ahead of YouTube', () => {
    expect(
      preferDirectHighlightUrls([
        'https://www.youtube.com/watch?v=abc1234',
        'https://w-cdn.streamin.top/uploads/aa.mp4',
      ]),
    ).toEqual([
      'https://w-cdn.streamin.top/uploads/aa.mp4',
      'https://www.youtube.com/watch?v=abc1234',
    ]);
  });
});
