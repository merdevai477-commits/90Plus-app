/**
 * Reels Audio Manager Hook
 * 
 * Manages audio cleanup for the reels page:
 * - Stops all video audio when leaving reels page (navigation)
 * - Pauses on app background
 * - Resumes on return to app
 * 
 * **Validates: Requirements 16.1, 16.2, 16.3**
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Video, Audio } from 'expo-av';

// Track which videos are loaded and ready for playback control
const loadedVideosSet = new Set<string>();

export interface AudioManagerState {
  isPageFocused: boolean;
  isAppActive: boolean;
  wasPlayingBeforeBackground: boolean;
}

export interface UseReelsAudioManagerOptions {
  videoRefs: React.MutableRefObject<Map<string, Video>>;
  currentIndex: number;
  onPauseAll?: () => void;
  onResumeActive?: (index: number) => void;
}

export interface UseReelsAudioManagerReturn {
  pauseAllVideos: () => Promise<void>;
  resumeActiveVideo: () => Promise<void>;
  markVideoLoaded: (id: string) => void;
  markVideoUnloaded: (id: string) => void;
  isVideoLoaded: (id: string) => boolean;
  state: AudioManagerState;
}

/**
 * Mark a video as loaded and ready for playback control
 */
export const markVideoAsLoaded = (id: string): void => {
  loadedVideosSet.add(id);
};

/**
 * Mark a video as unloaded
 */
export const markVideoAsUnloaded = (id: string): void => {
  loadedVideosSet.delete(id);
};

/**
 * Check if a video is loaded
 */
export const isVideoLoaded = (id: string): boolean => {
  return loadedVideosSet.has(id);
};

/**
 * Clear all loaded video tracking
 */
export const clearLoadedVideos = (): void => {
  loadedVideosSet.clear();
};

/**
 * Custom hook for managing reels audio cleanup on navigation and app state changes
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
  const currentActiveVideoId = useRef<string | null>(null);

  /**
   * Pause all videos - used when navigating away or app goes to background
   * Requirement 16.1: Stop all video audio when leaving reels page
   * Requirement 16.2: Pause video playback and audio when switching to another app
   */
  const pauseAllVideos = useCallback(async (): Promise<void> => {
    const pausePromises: Promise<void>[] = [];
    
    for (const [id, video] of videoRefs.current.entries()) {
      if (video && loadedVideosSet.has(id)) {
        pausePromises.push(
          video.pauseAsync().catch((error) => {
            // Video might not be ready, ignore error
            console.log(`[AudioManager] Could not pause video ${id}:`, error?.message || 'unknown');
          })
        );
      }
    }

    await Promise.all(pausePromises);
    onPauseAll?.();
  }, [videoRefs, onPauseAll]);

  /**
   * Resume the currently active video
   * Requirement 16.3: Resume from paused state when returning to reels page
   */
  const resumeActiveVideo = useCallback(async (): Promise<void> => {
    if (!isPageFocused.current || !isAppActive.current) {
      return;
    }

    // Find the current active video
    const entries = Array.from(videoRefs.current.entries());
    const activeEntry = entries[currentIndex];
    
    if (activeEntry) {
      const [id, video] = activeEntry;
      if (video && loadedVideosSet.has(id)) {
        try {
          await video.playAsync();
          currentActiveVideoId.current = id;
          onResumeActive?.(currentIndex);
        } catch (error) {
          console.log(`[AudioManager] Could not resume video ${id}:`, (error as Error)?.message || 'unknown');
        }
      }
    }
  }, [videoRefs, currentIndex, onResumeActive]);

  /**
   * Handle app state changes (background/foreground)
   * Requirement 16.2: Pause when app goes to background
   * Requirement 16.3: Resume when app returns to foreground
   */
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
      const previousState = appState.current;
      
      // App going to background
      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        isAppActive.current = false;
        wasPlayingBeforeBackground.current = isPageFocused.current;
        await pauseAllVideos();
      }
      
      // App returning to foreground
      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        isAppActive.current = true;
        if (wasPlayingBeforeBackground.current && isPageFocused.current) {
          await resumeActiveVideo();
        }
      }
      
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Configure audio session for proper playback
    const configureAudio = async (): Promise<void> => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false, // Important: Don't play in background
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.warn('[AudioManager] Error configuring audio session:', error);
      }
    };

    configureAudio();

    return () => {
      subscription.remove();
    };
  }, [pauseAllVideos, resumeActiveVideo]);

  /**
   * Handle navigation focus/blur
   * Requirement 16.1: Stop all video audio when leaving reels page
   * Requirement 16.3: Resume when returning to reels page
   */
  useFocusEffect(
    useCallback(() => {
      // Screen is focused
      isPageFocused.current = true;
      console.log('[AudioManager] Reels page focused');
      
      // Resume active video if app is active
      if (isAppActive.current) {
        resumeActiveVideo();
      }

      // Cleanup when screen loses focus
      return () => {
        isPageFocused.current = false;
        console.log('[AudioManager] Reels page unfocused - stopping all videos');
        // Stop all videos when navigating away
        pauseAllVideos();
        
        // Also unload all videos to ensure audio stops completely
        for (const [id, video] of videoRefs.current.entries()) {
          if (video) {
            video.stopAsync().catch((error) => {
              console.log(`[AudioManager] Could not stop video ${id}:`, error?.message || 'unknown');
            });
          }
        }
      };
    }, [pauseAllVideos, resumeActiveVideo, videoRefs])
  );

  /**
   * Cleanup on unmount - stop all videos and clear tracking
   */
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
