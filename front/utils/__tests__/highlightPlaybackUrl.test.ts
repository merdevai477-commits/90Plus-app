import {
  isDirectHighlightFile,
  preferDirectHighlightUrls,
  resolveHighlightPlaybackUrl,
  YOUTUBE_APP_REFERER,
  youtubeEmbedDocument,
  youtubeEmbedUrl,
  youtubeHostedPlayerUrl,
  youtubeMobileWatchUrl,
  youtubeWebViewEmbedSource,
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
    expect(embed).toContain('youtube.com/embed/qjEXEEBQgqo?');
    expect(embed).toContain('mute=1');
    expect(youtubeEmbedUrl('https://youtu.be/6Nk3FShw4XM')).toContain('/embed/6Nk3FShw4XM?');
    expect(youtubeWebViewEmbedSource('qjEXEEBQgqo')).toEqual({
      uri: expect.stringContaining('youtube.com/embed/qjEXEEBQgqo?'),
      headers: {
        Referer: YOUTUBE_APP_REFERER,
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
    expect(youtubeHostedPlayerUrl('https://www.youtube.com/watch?v=qjEXEEBQgqo')).toBe(
      'https://90plus.pro/embed/youtube.html?v=qjEXEEBQgqo',
    );
    expect(youtubeMobileWatchUrl('qjEXEEBQgqo')).toBe(
      'https://www.youtube.com/watch?v=qjEXEEBQgqo&playsinline=1',
    );
    const doc = youtubeEmbedDocument('_jxHAw-yH3E', { requireTap: true });
    expect(doc).toContain("videoId:'_jxHAw-yH3E'");
    expect(doc).toContain('iframe_api');
    expect(doc).toContain("post('PLAYER_READY')");
    expect(doc).toContain("window.__HL_VID='_jxHAw-yH3E'");
    expect(doc).toContain('<base href="https://90plus.pro/">');
    expect(doc).toContain("host:'https://www.youtube-nocookie.com'");
    expect(doc).toContain("reason:'+reason+':_jxHAw-yH3E:");
    expect(doc).toContain('id="tap"');
    expect(doc).toContain('mute:1');
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
