import {
  buildHostedBridgePayload,
  createHostedBridgeQueue,
  isOnceBridgeReason,
  YOUTUBE_BRIDGE_QUEUE_MAX,
} from '../youtubeHostedBridgeQueue';

describe('youtubeHostedBridgeQueue', () => {
  it('builds the existing reason:payload contract', () => {
    expect(buildHostedBridgePayload('PLAYER_READY', 'abc123', 'https://90plus.pro/embed/youtube.html?v=abc')).toBe(
      'reason:PLAYER_READY:abc123:https://90plus.pro/embed/youtube.html?v=abc',
    );
  });

  it('sends immediately when the bridge is available', () => {
    const sent: string[] = [];
    const q = createHostedBridgeQueue({
      videoId: 'vid1',
      getHref: () => 'https://90plus.pro/embed/youtube.html?v=vid1&rn_sid=s1',
      send: (payload) => {
        sent.push(payload);
        return true;
      },
    });
    q.post('PAGE_SCRIPT_START');
    q.post('BRIDGE_HELLO');
    q.post('PLAYER_READY');
    expect(sent).toEqual([
      'reason:PAGE_SCRIPT_START:vid1:https://90plus.pro/embed/youtube.html?v=vid1&rn_sid=s1',
      'reason:BRIDGE_HELLO:vid1:https://90plus.pro/embed/youtube.html?v=vid1&rn_sid=s1',
      'reason:PLAYER_READY:vid1:https://90plus.pro/embed/youtube.html?v=vid1&rn_sid=s1',
    ]);
    expect(q.pendingCount()).toBe(0);
    q.stop();
  });

  it('queues while bridge is unavailable and flushes when it appears', () => {
    let bridgeUp = false;
    const sent: string[] = [];
    const timers: Array<() => void> = [];
    let t = 0;

    const q = createHostedBridgeQueue({
      videoId: 'vid1',
      getHref: () => 'https://90plus.pro/x',
      now: () => t,
      schedule: (fn) => {
        timers.push(fn);
        return () => {
          const idx = timers.indexOf(fn);
          if (idx >= 0) timers.splice(idx, 1);
        };
      },
      send: (payload) => {
        if (!bridgeUp) return false;
        sent.push(payload);
        return true;
      },
    });

    q.post('PAGE_SCRIPT_START');
    q.post('BRIDGE_HELLO');
    q.post('PLAYER_READY');
    expect(q.pendingCount()).toBe(3);
    expect(sent).toEqual([]);

    bridgeUp = true;
    t = 100;
    timers.forEach((fn) => fn());
    expect(sent.map((p) => p.split(':')[1])).toEqual([
      'PAGE_SCRIPT_START',
      'BRIDGE_HELLO',
      'PLAYER_READY',
    ]);
    expect(q.pendingCount()).toBe(0);
    q.stop();
  });

  it('does not duplicate once-only reasons', () => {
    const sent: string[] = [];
    const q = createHostedBridgeQueue({
      videoId: 'vid1',
      getHref: () => 'https://90plus.pro/x',
      send: (payload) => {
        sent.push(payload);
        return true;
      },
    });
    q.post('PLAYER_READY');
    q.post('PLAYER_READY');
    q.post('PLAYING');
    q.post('PLAYING');
    q.post('YT_ERROR:153');
    q.post('YT_ERROR:153');
    expect(sent).toHaveLength(3);
    expect(isOnceBridgeReason('PLAYER_READY')).toBe(true);
    expect(isOnceBridgeReason('YT_ERROR:153')).toBe(true);
    q.stop();
  });

  it('discards the queue when the retry window expires', () => {
    const timers: Array<() => void> = [];
    let t = 0;
    const q = createHostedBridgeQueue({
      videoId: 'vid1',
      getHref: () => 'https://90plus.pro/x',
      now: () => t,
      retryWindowMs: 200,
      retryMs: 50,
      schedule: (fn) => {
        timers.push(fn);
        return () => {
          const idx = timers.indexOf(fn);
          if (idx >= 0) timers.splice(idx, 1);
        };
      },
      send: () => false,
    });
    q.post('PLAYER_READY');
    expect(q.pendingCount()).toBe(1);
    t = 250;
    timers.forEach((fn) => fn());
    expect(q.pendingCount()).toBe(0);
    q.stop();
  });

  it('bounds queue size', () => {
    const q = createHostedBridgeQueue({
      videoId: 'vid1',
      getHref: () => 'https://90plus.pro/x',
      maxQueue: 3,
      send: () => false,
      schedule: () => () => undefined,
    });
    // Non-once reasons would need unique keys — use USER_PLAY once + force unique by
    // posting EMBED then many YT codes. Use raw unique via YT_ERROR codes.
    q.post('YT_ERROR:2');
    q.post('YT_ERROR:5');
    q.post('YT_ERROR:100');
    q.post('YT_ERROR:101');
    expect(q.pendingCount()).toBeLessThanOrEqual(3);
    expect(q.pendingCount()).toBe(3);
    expect(YOUTUBE_BRIDGE_QUEUE_MAX).toBe(20);
    q.stop();
  });
});
