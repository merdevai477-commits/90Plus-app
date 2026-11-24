import {
  createInitialYoutubePlaybackSession,
  reduceYoutubePlaybackSession,
  youtubeSessionShowsLoadingSpinner,
} from '../youtubePlaybackSession';

describe('youtubePlaybackSession — ready vs playing', () => {
  it('A: PLAYER_READY without PLAYING → ready, not successful, playback watchdog stays armed', () => {
    let state = createInitialYoutubePlaybackSession();
    expect(youtubeSessionShowsLoadingSpinner(state)).toBe(true);

    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });

    expect(state.phase).toBe('ready');
    expect(state.playerReady).toBe(true);
    expect(state.playing).toBe(false);
    expect(state.showPlayAffordance).toBe(true);
    expect(state.loadWatchdogActive).toBe(false);
    expect(state.playbackWatchdogActive).toBe(true);
    expect(youtubeSessionShowsLoadingSpinner(state)).toBe(false);
  });

  it('B: PLAYER_READY then PLAYING → clears overlays and marks playback successful', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYING' });

    expect(state.phase).toBe('playing');
    expect(state.playing).toBe(true);
    expect(state.showPlayAffordance).toBe(false);
    expect(state.loadWatchdogActive).toBe(false);
    expect(state.playbackWatchdogActive).toBe(false);
    expect(youtubeSessionShowsLoadingSpinner(state)).toBe(false);
  });

  it('C: PLAYER_READY then PLAYBACK_TIMEOUT still fails when playback was attempted', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    expect(state.playbackWatchdogActive).toBe(true);

    state = reduceYoutubePlaybackSession(state, { type: 'PLAYBACK_TIMEOUT' });

    expect(state.phase).toBe('failed');
    expect(state.failed).toBe(true);
    expect(state.playing).toBe(false);
    expect(state.playbackWatchdogActive).toBe(false);
  });

  it('C2: LOAD_TIMEOUT after PLAYER_READY is a no-op (must not stop because READY cleared load only)', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    const afterReady = state;
    state = reduceYoutubePlaybackSession(state, { type: 'LOAD_TIMEOUT' });
    expect(state).toEqual(afterReady);
    expect(state.phase).toBe('ready');
    expect(state.failed).toBe(false);
  });

  it('D: PLAYER_READY → USER_PLAY → PLAYING succeeds via user-initiated path', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    const epochAfterReady = state.playbackWatchdogEpoch;

    state = reduceYoutubePlaybackSession(state, { type: 'USER_PLAY' });
    expect(state.phase).toBe('ready');
    expect(state.playing).toBe(false);
    expect(state.playbackWatchdogActive).toBe(true);
    expect(state.playbackWatchdogEpoch).toBe(epochAfterReady + 1);

    state = reduceYoutubePlaybackSession(state, { type: 'PLAYING' });
    expect(state.phase).toBe('playing');
    expect(state.playing).toBe(true);
    expect(state.showPlayAffordance).toBe(false);
  });

  it('E: duplicate PLAYER_READY does not re-transition or claim playing', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    const afterFirst = state;
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    expect(state).toEqual(afterFirst);
    expect(state.playing).toBe(false);
    expect(state.phase).toBe('ready');
  });

  it('E2: duplicate PLAYING is a no-op', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYING' });
    const afterPlay = state;
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYING' });
    expect(state).toEqual(afterPlay);
  });

  it('F: RESET restores a fresh loading session (stale session must be dropped before reduce)', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'PLAYER_READY' });
    state = reduceYoutubePlaybackSession(state, { type: 'RESET' });
    expect(state).toEqual(createInitialYoutubePlaybackSession());
    expect(youtubeSessionShowsLoadingSpinner(state)).toBe(true);
  });

  it('LOAD_TIMEOUT before READY fails initialization', () => {
    let state = createInitialYoutubePlaybackSession();
    state = reduceYoutubePlaybackSession(state, { type: 'LOAD_TIMEOUT' });
    expect(state.failed).toBe(true);
    expect(state.phase).toBe('failed');
  });

  it('PLAYBACK_TIMEOUT while waiting for user without armed playback watchdog is ignored', () => {
    const state = createInitialYoutubePlaybackSession();
    const next = reduceYoutubePlaybackSession(state, { type: 'PLAYBACK_TIMEOUT' });
    expect(next).toEqual(state);
    expect(next.failed).toBe(false);
  });
});
