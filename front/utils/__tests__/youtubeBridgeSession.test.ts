import { youtubeHostedPlayerUrl } from '../highlightPlaybackUrl';
import { youtubeBridgeMessageKind } from '../highlightPlaybackErrors';

describe('hosted bridge session stamping', () => {
  it('stamps rn_sid so stale WebView posts can be ignored', () => {
    const active = 'hl_abc_2';
    const stale = 'hl_abc_1';
    const url = youtubeHostedPlayerUrl('qjEXEEBQgqo', { sessionId: active });
    expect(url).toContain(`rn_sid=${active}`);

    const liveMessage = `reason:PLAYER_READY:qjEXEEBQgqo:${url}`;
    const staleMessage = `reason:PLAYER_READY:qjEXEEBQgqo:https://90plus.pro/embed/youtube.html?v=qjEXEEBQgqo&rn_sid=${stale}`;

    expect(liveMessage.includes(`rn_sid=${active}`)).toBe(true);
    expect(staleMessage.includes(`rn_sid=${active}`)).toBe(false);
    expect(youtubeBridgeMessageKind(liveMessage)).toBe('PLAYER_READY');
  });
});
