import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { ReelsService } from '../src/services/authService';

export interface ReelSocialSnapshot {
  liked: boolean;
  likes: number;
  saved: boolean;
  shares: number;
}

interface UseReelSocialActionsOptions {
  reelId: string | null;
  initial: ReelSocialSnapshot;
  /** When false, skips API calls (e.g. invalid reel id) */
  enabled?: boolean;
}

/**
 * Optimistic reel like/save/share with debounced like API — shared by feed modal paths.
 */
export function useReelSocialActions({
  reelId,
  initial,
  enabled = true,
}: UseReelSocialActionsOptions) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [isLiked, setIsLiked] = useState(initial.liked);
  const [likes, setLikes] = useState(initial.likes);
  const [isSaved, setIsSaved] = useState(initial.saved);
  const [shares, setShares] = useState(initial.shares);

  const likeSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLikeRef = useRef<boolean | null>(null);

  useEffect(() => {
    setIsLiked(initial.liked);
    setLikes(initial.likes);
    setIsSaved(initial.saved);
    setShares(initial.shares);
  }, [reelId, initial.liked, initial.likes, initial.saved, initial.shares]);

  const handleLike = useCallback(() => {
    setIsLiked((prev) => {
      const next = !prev;
      pendingLikeRef.current = next;
      setLikes((count) => (next ? count + 1 : Math.max(0, count - 1)));

      if (likeSyncRef.current) clearTimeout(likeSyncRef.current);
      if (enabled && reelId) {
        likeSyncRef.current = setTimeout(async () => {
          likeSyncRef.current = null;
          const target = pendingLikeRef.current;
          if (target === null) return;
          try {
            const token = await getTokenRef.current();
            if (!token) return;
            const result = target
              ? await ReelsService.likeReel(token, reelId)
              : await ReelsService.unlikeReel(token, reelId);
            if (!result.success) throw new Error('Like sync failed');
            if (result.likesCount !== undefined) {
              setIsLiked(target);
              setLikes(result.likesCount);
            }
          } catch {
            setIsLiked(!target);
            setLikes((count) => (target ? Math.max(0, count - 1) : count + 1));
          }
        }, 300);
      }
      return next;
    });
  }, [enabled, reelId]);

  const handleSave = useCallback(async () => {
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    if (!enabled || !reelId) return;
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      if (nextSaved) await ReelsService.saveReel(token, reelId);
      else await ReelsService.unsaveReel(token, reelId);
    } catch {
      setIsSaved(!nextSaved);
    }
  }, [enabled, reelId, isSaved]);

  const recordShare = useCallback(
    async (platform: string) => {
      if (!enabled || !reelId) return;
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const res = await ReelsService.recordShare(token, reelId, platform);
        if (res.sharesCount !== undefined) setShares(res.sharesCount);
      } catch {
        /* non-blocking */
      }
    },
    [enabled, reelId],
  );

  return {
    isLiked,
    likes,
    isSaved,
    shares,
    handleLike,
    handleSave,
    recordShare,
    setShares,
  };
}
