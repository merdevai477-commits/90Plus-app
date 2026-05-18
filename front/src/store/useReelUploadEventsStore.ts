/**
 * useReelUploadEventsStore — cross-screen pub/sub for reel-upload lifecycle.
 *
 * The profile screen drives the upload + status polling. When a reel finishes
 * processing (Mux webhook → READY), it writes here. Other screens (reels feed,
 * other profile screens) watch the relevant fields and refetch / invalidate
 * their caches accordingly.
 *
 * No persistence — these events are runtime-only.
 */

import { create } from 'zustand';

interface ReelUploadEventsState {
  /** ID of the most recently uploaded reel that just transitioned to READY. */
  lastReadyReelId: string | null;
  /** Bumps every time a reel becomes READY — screens can watch this to trigger refetch. */
  readyTick: number;
  /** ID of a reel that just failed processing (so screens can drop optimistic placeholders). */
  lastFailedReelId: string | null;
  /** Bumps every time a reel fails. */
  failedTick: number;

  /** Called by the profile screen when its poller reports the reel is READY. */
  markReady: (reelId: string) => void;
  /** Called by the profile screen when its poller reports the reel FAILED. */
  markFailed: (reelId: string) => void;
}

export const useReelUploadEventsStore = create<ReelUploadEventsState>((set) => ({
  lastReadyReelId: null,
  readyTick: 0,
  lastFailedReelId: null,
  failedTick: 0,

  markReady: (reelId: string) =>
    set((s) => ({ lastReadyReelId: reelId, readyTick: s.readyTick + 1 })),

  markFailed: (reelId: string) =>
    set((s) => ({ lastFailedReelId: reelId, failedTick: s.failedTick + 1 })),
}));
