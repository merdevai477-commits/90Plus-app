/**
 * Video Replay Limit Hook
 * 
 * Tracks replay count per video and enforces the 2 auto-replay limit.
 * Requirements 17.1, 17.2, 17.3, 17.4
 * 
 * - WHEN a video finishes playing THEN the system SHALL auto-replay up to 2 times
 * - WHEN the video has replayed twice THEN the Video SHALL pause and show a replay button
 * - WHEN the user taps the paused video THEN the Video SHALL play again from the beginning
 * - WHEN the user scrolls away and back THEN the Replay count SHALL reset
 */

import { useCallback, useRef, useState } from 'react';

export const MAX_AUTO_REPLAYS = 2;

export interface ReplayState {
  replayCount: number;
  isPausedByLimit: boolean;
}

export interface UseVideoReplayLimitResult {
  /** Current replay count for the video */
  replayCount: number;
  /** Whether the video is paused due to reaching replay limit */
  isPausedByLimit: boolean;
  /** Called when video finishes playing. Returns true if should continue playing, false if should pause */
  onVideoEnd: () => boolean;
  /** Called when user manually taps to replay after limit reached */
  onManualReplay: () => void;
  /** Called when video becomes inactive (scrolled away) to reset count */
  resetReplayCount: () => void;
  /** Check if video should auto-loop based on current replay count */
  shouldAutoLoop: () => boolean;
}

/**
 * Hook to manage video replay limit
 * @param videoId - Unique identifier for the video
 * @param maxReplays - Maximum number of auto-replays allowed (default: 2)
 */
export function useVideoReplayLimit(
  videoId: string,
  maxReplays: number = MAX_AUTO_REPLAYS
): UseVideoReplayLimitResult {
  const [replayCount, setReplayCount] = useState(0);
  const [isPausedByLimit, setIsPausedByLimit] = useState(false);
  
  // Track the video ID to reset state when it changes
  const currentVideoIdRef = useRef(videoId);
  
  // Reset state if video ID changes
  if (currentVideoIdRef.current !== videoId) {
    currentVideoIdRef.current = videoId;
    setReplayCount(0);
    setIsPausedByLimit(false);
  }

  /**
   * Called when video finishes playing
   * Returns true if should continue playing (auto-replay), false if should pause
   */
  const onVideoEnd = useCallback((): boolean => {
    const newCount = replayCount + 1;
    
    if (newCount >= maxReplays) {
      // Reached limit - pause the video
      setReplayCount(newCount);
      setIsPausedByLimit(true);
      return false;
    }
    
    // Can still auto-replay
    setReplayCount(newCount);
    return true;
  }, [replayCount, maxReplays]);

  /**
   * Called when user manually taps to replay after limit reached
   * Resets count and allows playback
   */
  const onManualReplay = useCallback(() => {
    setReplayCount(0);
    setIsPausedByLimit(false);
  }, []);

  /**
   * Called when video becomes inactive (scrolled away) to reset count
   * Requirement 17.4: Replay count SHALL reset when scrolling away and back
   */
  const resetReplayCount = useCallback(() => {
    setReplayCount(0);
    setIsPausedByLimit(false);
  }, []);

  /**
   * Check if video should auto-loop based on current replay count
   */
  const shouldAutoLoop = useCallback((): boolean => {
    return replayCount < maxReplays && !isPausedByLimit;
  }, [replayCount, maxReplays, isPausedByLimit]);

  return {
    replayCount,
    isPausedByLimit,
    onVideoEnd,
    onManualReplay,
    resetReplayCount,
    shouldAutoLoop,
  };
}

/**
 * Pure function to calculate if video should pause based on replay count
 * Used for property-based testing
 */
export function shouldPauseAfterReplay(
  currentReplayCount: number,
  maxReplays: number = MAX_AUTO_REPLAYS
): boolean {
  return currentReplayCount >= maxReplays;
}

/**
 * Pure function to get next replay state after video ends
 * Used for property-based testing
 */
export function getNextReplayState(
  currentCount: number,
  maxReplays: number = MAX_AUTO_REPLAYS
): ReplayState {
  const newCount = currentCount + 1;
  const shouldPause = newCount >= maxReplays;
  
  return {
    replayCount: newCount,
    isPausedByLimit: shouldPause,
  };
}

/**
 * Pure function to get state after manual replay
 * Used for property-based testing
 */
export function getStateAfterManualReplay(): ReplayState {
  return {
    replayCount: 0,
    isPausedByLimit: false,
  };
}

/**
 * Pure function to get state after scroll away (reset)
 * Used for property-based testing
 */
export function getStateAfterScrollAway(): ReplayState {
  return {
    replayCount: 0,
    isPausedByLimit: false,
  };
}
