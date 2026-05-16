/**
 * Reels Audio Manager Hook
 *
 * Manages audio / playback cleanup for the reels page:
 *  - Stops all video audio when leaving the reels page (navigation)
 *  - Pauses playback when the app goes to background
 *  - Resumes automatically when returning to the reels page (via the
 *    UnifiedVideoPlayer's own focus-effect — we just stop; we don't force
 *    play here to avoid AudioFocusNotAcquiredException races)
 *
 * SDK 55 migration:
 *  - `videoRefs` now holds `VideoPlayer` instances from `expo-video` instead
 *    of `<Video>` refs from `expo-av`.
 *  - `expo-video`'s API is synchronous (`player.pause()` / `player.play()`);
 *    there's no `pauseAsync` / `playAsync` / `setIsMutedAsync` anymore.
 *  - Audio session is configured via `setAudioModeAsync` from `expo-audio`.
 *
 * **Validates: Requirements 16.1, 16.2, 16.3**
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { logger } from '../services/logger';

// Track which videos are loaded and ready for playback control.
const loadedVideosSet = new Set<string>();

export interface AudioManagerState {
  isPageFocused: boolean;
  isAppActive: boolean;
  wasPlayingBeforeBackground: boolean;
}

export interface UseReelsAudioManagerOptions {
  /** Map of reelId → expo-video `VideoPlayer` instance, populated by UnifiedVideoPlayer's onVideoRef. */
  videoRefs: React.MutableRefObject<Map<string, any>>;
  currentIndex: number;
  onPauseAll?: () => void;
  onResumeActive?: (index: number) => void;
}

export interface UseReelsAudioManagerReturn {
  pauseAllVideos: () => void;
  resumeActiveVideo: () => void;
  markVideoLoaded: (id: string) => void;
  markVideoUnloaded: (id: string) => void;
  isVideoLoaded: (id: string) => boolean;
  state: AudioManagerState;
}

/** Mark a video as loaded and ready for playback control. */
export const markVideoAsLoaded = (id: string): void => {
  loadedVideosSet.add(id);
};

/** Mark a video as unloaded. */
export const markVideoAsUnloaded = (id: string): void => {
  loadedVideosSet.delete(id);
};

/** Check if a video is loaded. */
export const isVideoLoaded = (id: string): boolean => {
  return loadedVideosSet.has(id);
};

/** Clear all loaded video tracking. */
export const clearLoadedVideos = (): void => {
  loadedVideosSet.clear();
};

/**
 * Safely try to pause a player. Swallows the errors that naturally happen
 * when the player has already been released by `useVideoPlayer` cleanup.
 */
function safePause(player: any, id: string): void {
  if (!player) return;
  try {
    if (typeof player.pause === 'function') {
      player.pause();
    }
  } catch (error: any) {
    const msg = error?.message || 'unknown';
    if (!msg.includes('released') && !msg.includes('already')) {
      logger.warn(`[AudioManager] Error pausing video ${id}:`, msg);
    }
  }
}

/**
 * Safely try to resume a player.
 */
function safePlay(player: any, id: string): void {
  if (!player) return;
  try {
    if (typeof player.play === 'function' && !player.playing) {
      player.play();
    }
  } catch (error: any) {
    const msg = error?.message || 'unknown';
    if (!msg.includes('released') && !msg.includes('already')) {
      logger.warn(`[AudioManager] Error resuming video ${id}:`, msg);
    }
  }
}

/**
 * Custom hook for managing reels playback on navigation and app-state changes.
 */
export const useReelsAudioManager = ({
  videoRefs,
  currentIndex,
  onPauseAll,
  onResumeActive,
}: UseReelsAudioManagerOptions): UseReelsAudioManagerReturn => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const wasPlayingBeforeBackground = useRef<boolean>(false);
  const isPageFocused = useRef<boolean>(true);
  const isAppActive = useRef<boolean>(true);

  /**
   * Pause all tracked videos.
   * Requirement 16.1 / 16.2
   */
  const pauseAllVideos = useCallback((): void => {
    for (const [id, player] of videoRefs.current.entries()) {
      safePause(player, id);
    }
    onPauseAll?.();
  }, [videoRefs, onPauseAll]);

  /**
   * Resume the currently active video.
   * Requirement 16.3 (the UnifiedVideoPlayer also runs its own focus-effect;
   * this is a belt-and-suspenders path for the audio manager).
   */
  const resumeActiveVideo = useCallback((): void => {
    if (!isPageFocused.current || !isAppActive.current) return;
    const entries = Array.from(videoRefs.current.entries());
    const active = entries[currentIndex];
    if (!active) return;
    const [id, player] = active;
    safePlay(player, id);
    onResumeActive?.(currentIndex);
  }, [videoRefs, currentIndex, onResumeActive]);

  /**
   * Handle app-state changes (background / foreground).
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      const previousState = appState.current;

      // App going to background
      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        isAppActive.current = false;
        wasPlayingBeforeBackground.current = isPageFocused.current;
        pauseAllVideos();
      }

      // App returning to foreground
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        isAppActive.current = true;
        // Don't force-resume here — UnifiedVideoPlayer's own effect will resume
        // the active video once `isActive` is true again. This avoids a race
        // with Android's audio-focus acquisition.
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Audio session is already configured globally at app startup via configureAudioVideo()
    // in videoConfig.ts (called from _layout.tsx). No need to reconfigure here —
    // doing so can cause audio session interruptions with other screens.

    return () => {
      subscription.remove();
    };
  }, [pauseAllVideos]);

  // Keep latest callbacks in refs so `useFocusEffect` below doesn't re-fire on every render.
  const pauseAllVideosRef = useRef(pauseAllVideos);
  useEffect(() => {
    pauseAllVideosRef.current = pauseAllVideos;
  }, [pauseAllVideos]);

  /**
   * Handle navigation focus/blur.
   * Requirement 16.1: stop audio on navigate-away.
   */
  useFocusEffect(
    useCallback(() => {
      isPageFocused.current = true;
      logger.debug('[AudioManager] Reels page focused');

      return () => {
        isPageFocused.current = false;
        logger.debug('[AudioManager] Reels page unfocused — pausing all videos');
        pauseAllVideosRef.current();
      };
    }, []),
  );

  /** Pause everything and clear the tracking set on unmount. */
  useEffect(() => {
    return () => {
      pauseAllVideos();
      clearLoadedVideos();
    };
  }, [pauseAllVideos]);

  return {
    pauseAllVideos,
    resumeActiveVideo,
    markVideoLoaded: markVideoAsLoaded,
    markVideoUnloaded: markVideoAsUnloaded,
    isVideoLoaded,
    state: {
      isPageFocused: isPageFocused.current,
      isAppActive: isAppActive.current,
      wasPlayingBeforeBackground: wasPlayingBeforeBackground.current,
    },
  };
};

export default useReelsAudioManager;
