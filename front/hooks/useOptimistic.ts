/**
 * useOptimistic Hook
 * Ultra-fast optimistic updates for instant UI response (0ms latency)
 * 
 * Updates UI immediately, then syncs with server in background.
 * Automatically rolls back on failure.
 */

import { useState, useCallback, useRef } from 'react';

type AsyncAction<T> = () => Promise<T>;
type RollbackFn = () => void;

interface OptimisticState<T> {
  data: T;
  isPending: boolean;
  error: Error | null;
}

interface UseOptimisticOptions {
  onError?: (error: Error) => void;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * Generic optimistic update hook
 * Usage:
 * const { execute, isPending } = useOptimistic({
 *   onOptimistic: () => setLiked(true),
 *   onRollback: () => setLiked(false),
 *   action: () => api.like(postId)
 * });
 */
export function useOptimisticAction(options: UseOptimisticOptions = {}) {
  const { onError, retryCount = 0, retryDelay = 1000 } = options;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pendingActionsRef = useRef<Map<string, AbortController>>(new Map());

  const execute = useCallback(async <T>(
    actionId: string,
    optimisticUpdate: () => void,
    rollback: RollbackFn,
    action: AsyncAction<T>
  ): Promise<T | null> => {
    // Cancel any pending action with same ID
    const existingController = pendingActionsRef.current.get(actionId);
    if (existingController) {
      existingController.abort();
    }

    const controller = new AbortController();
    pendingActionsRef.current.set(actionId, controller);

    // Apply optimistic update IMMEDIATELY
    optimisticUpdate();
    setIsPending(true);
    setError(null);

    let attempts = 0;
    const maxAttempts = retryCount + 1;

    while (attempts < maxAttempts) {
      try {
        if (controller.signal.aborted) {
          return null;
        }

        const result = await action();
        setIsPending(false);
        pendingActionsRef.current.delete(actionId);
        return result;
      } catch (err) {
        attempts++;
        
        if (attempts >= maxAttempts || controller.signal.aborted) {
          // All retries failed - rollback
          rollback();
          const error = err instanceof Error ? err : new Error('Action failed');
          setError(error);
          setIsPending(false);
          onError?.(error);
          pendingActionsRef.current.delete(actionId);
          return null;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return null;
  }, [onError, retryCount, retryDelay]);

  const cancel = useCallback((actionId: string) => {
    const controller = pendingActionsRef.current.get(actionId);
    if (controller) {
      controller.abort();
      pendingActionsRef.current.delete(actionId);
    }
  }, []);

  const cancelAll = useCallback(() => {
    pendingActionsRef.current.forEach(controller => controller.abort());
    pendingActionsRef.current.clear();
    setIsPending(false);
  }, []);

  return { execute, cancel, cancelAll, isPending, error };
}

/**
 * Optimistic Like Hook - instant like/unlike
 */
export function useOptimisticLike(
  initialLiked: boolean,
  initialCount: number,
  onLike: () => Promise<void>,
  onUnlike: () => Promise<void>
) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const { execute, isPending } = useOptimisticAction();

  const toggle = useCallback(async () => {
    const wasLiked = liked;
    const prevCount = count;

    await execute(
      'like',
      // Optimistic update - INSTANT
      () => {
        setLiked(!wasLiked);
        setCount(wasLiked ? prevCount - 1 : prevCount + 1);
      },
      // Rollback on failure
      () => {
        setLiked(wasLiked);
        setCount(prevCount);
      },
      // Actual API call
      () => wasLiked ? onUnlike() : onLike()
    );
  }, [liked, count, execute, onLike, onUnlike]);

  return { liked, count, toggle, isPending };
}

/**
 * Optimistic Follow Hook - instant follow/unfollow
 */
export function useOptimisticFollow(
  initialFollowing: boolean,
  initialCount: number,
  onFollow: () => Promise<void>,
  onUnfollow: () => Promise<void>
) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const { execute, isPending } = useOptimisticAction();

  const toggle = useCallback(async () => {
    const wasFollowing = following;
    const prevCount = count;

    await execute(
      'follow',
      () => {
        setFollowing(!wasFollowing);
        setCount(wasFollowing ? prevCount - 1 : prevCount + 1);
      },
      () => {
        setFollowing(wasFollowing);
        setCount(prevCount);
      },
      () => wasFollowing ? onUnfollow() : onFollow()
    );
  }, [following, count, execute, onFollow, onUnfollow]);

  return { following, count, toggle, isPending };
}

/**
 * Optimistic Save/Bookmark Hook
 */
export function useOptimisticSave(
  initialSaved: boolean,
  onSave: () => Promise<void>,
  onUnsave: () => Promise<void>
) {
  const [saved, setSaved] = useState(initialSaved);
  const { execute, isPending } = useOptimisticAction();

  const toggle = useCallback(async () => {
    const wasSaved = saved;

    await execute(
      'save',
      () => setSaved(!wasSaved),
      () => setSaved(wasSaved),
      () => wasSaved ? onUnsave() : onSave()
    );
  }, [saved, execute, onSave, onUnsave]);

  return { saved, toggle, isPending };
}

/**
 * Optimistic Counter Hook - for views, shares, etc.
 */
export function useOptimisticCounter(
  initialCount: number,
  onIncrement: () => Promise<void>
) {
  const [count, setCount] = useState(initialCount);
  const { execute, isPending } = useOptimisticAction();

  const increment = useCallback(async () => {
    const prevCount = count;

    await execute(
      'counter',
      () => setCount(prev => prev + 1),
      () => setCount(prevCount),
      onIncrement
    );
  }, [count, execute, onIncrement]);

  return { count, increment, isPending };
}

/**
 * Batch optimistic updates - for multiple actions at once
 */
export function useBatchOptimistic() {
  const [isPending, setIsPending] = useState(false);
  const [errors, setErrors] = useState<Error[]>([]);

  const executeBatch = useCallback(async (
    actions: Array<{
      optimistic: () => void;
      rollback: () => void;
      action: () => Promise<void>;
    }>
  ) => {
    setIsPending(true);
    setErrors([]);

    // Apply all optimistic updates immediately
    actions.forEach(a => a.optimistic());

    // Execute all actions in parallel
    const results = await Promise.allSettled(
      actions.map(a => a.action())
    );

    // Rollback failed actions
    const failedErrors: Error[] = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        actions[index].rollback();
        failedErrors.push(
          result.reason instanceof Error 
            ? result.reason 
            : new Error('Action failed')
        );
      }
    });

    setErrors(failedErrors);
    setIsPending(false);

    return failedErrors.length === 0;
  }, []);

  return { executeBatch, isPending, errors };
}

export default useOptimisticAction;
