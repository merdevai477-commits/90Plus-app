/**
 * YouTube highlight playback session — separates player init from actual PLAYING.
 *
 * PLAYER_READY means the IFrame API constructed the player (and hosted HTML
 * attempts muted autoplay). It is NOT playback success. Only PLAYING confirms
 * the clip is running. Watchdogs:
 *  - load: armed until PLAYER_READY / PLAYING / FAIL
 *  - playback: armed after autoplay attempt (PLAYER_READY) or USER_PLAY;
 *    cleared only by PLAYING / FAIL
 */

export type YoutubePlaybackPhase = 'loading' | 'ready' | 'playing' | 'failed';

export type YoutubePlaybackSessionState = {
  phase: YoutubePlaybackPhase;
  /** IFrame / player initialized (PLAYER_READY). */
  playerReady: boolean;
  /** Actual YT.PlayerState.PLAYING observed. */
  playing: boolean;
  failed: boolean;
  /** Ready but not yet playing — show a clear play affordance. */
  showPlayAffordance: boolean;
  /** YOUTUBE_LOAD_MS — HTML / player never became ready. */
  loadWatchdogActive: boolean;
  /** PLAYBACK_START_MS — autoplay or user tap attempted, PLAYING not yet seen. */
  playbackWatchdogActive: boolean;
  /** Bumped when playback watchdog should (re)start its timer. */
  playbackWatchdogEpoch: number;
};

export type YoutubePlaybackSessionEvent =
  | { type: 'RESET' }
  | { type: 'PLAYER_READY' }
  | { type: 'USER_PLAY' }
  | { type: 'PLAYING' }
  | { type: 'FAIL' }
  | { type: 'LOAD_TIMEOUT' }
  | { type: 'PLAYBACK_TIMEOUT' };

export function createInitialYoutubePlaybackSession(): YoutubePlaybackSessionState {
  return {
    phase: 'loading',
    playerReady: false,
    playing: false,
    failed: false,
    showPlayAffordance: false,
    loadWatchdogActive: true,
    playbackWatchdogActive: false,
    playbackWatchdogEpoch: 0,
  };
}

export function reduceYoutubePlaybackSession(
  state: YoutubePlaybackSessionState,
  event: YoutubePlaybackSessionEvent,
): YoutubePlaybackSessionState {
  switch (event.type) {
    case 'RESET':
      return createInitialYoutubePlaybackSession();

    case 'PLAYER_READY': {
      // Duplicate READY must not flip playing / re-arm incorrectly.
      if (state.failed || state.playing) return state;
      if (state.playerReady) return state;
      return {
        ...state,
        phase: 'ready',
        playerReady: true,
        showPlayAffordance: true,
        // Load watchdog stops — player did initialize — but playback monitoring continues.
        loadWatchdogActive: false,
        // Hosted HTML calls tryPlay(false) on ready → autoplay attempt → arm playback watchdog.
        playbackWatchdogActive: true,
        playbackWatchdogEpoch: state.playbackWatchdogEpoch + 1,
      };
    }

    case 'USER_PLAY': {
      if (state.failed || state.playing) return state;
      // Explicit gesture: (re)start playback-start monitoring. Do not claim success.
      return {
        ...state,
        phase: state.playerReady ? 'ready' : state.phase,
        playerReady: state.playerReady,
        showPlayAffordance: true,
        loadWatchdogActive: false,
        playbackWatchdogActive: true,
        playbackWatchdogEpoch: state.playbackWatchdogEpoch + 1,
      };
    }

    case 'PLAYING': {
      if (state.failed) return state;
      if (state.playing) return state;
      return {
        ...state,
        phase: 'playing',
        playerReady: true,
        playing: true,
        showPlayAffordance: false,
        loadWatchdogActive: false,
        playbackWatchdogActive: false,
      };
    }

    case 'FAIL':
      return {
        ...state,
        phase: 'failed',
        failed: true,
        showPlayAffordance: false,
        loadWatchdogActive: false,
        playbackWatchdogActive: false,
      };

    case 'LOAD_TIMEOUT': {
      if (!state.loadWatchdogActive || state.playerReady || state.playing || state.failed) {
        return state;
      }
      return {
        ...state,
        phase: 'failed',
        failed: true,
        showPlayAffordance: false,
        loadWatchdogActive: false,
        playbackWatchdogActive: false,
      };
    }

    case 'PLAYBACK_TIMEOUT': {
      if (!state.playbackWatchdogActive || state.playing || state.failed) {
        return state;
      }
      return {
        ...state,
        phase: 'failed',
        failed: true,
        showPlayAffordance: false,
        loadWatchdogActive: false,
        playbackWatchdogActive: false,
      };
    }

    default:
      return state;
  }
}

/** Spinner only while HTML / player init is unfinished — never once ready/playing. */
export function youtubeSessionShowsLoadingSpinner(state: YoutubePlaybackSessionState): boolean {
  return state.phase === 'loading' && !state.playerReady && !state.playing && !state.failed;
}
