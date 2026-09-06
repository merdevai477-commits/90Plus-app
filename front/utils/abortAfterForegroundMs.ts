import { AppState, type AppStateStatus } from 'react-native';

/**
 * Abort `controller` after `ms` of foreground time only.
 * Leaving the app pauses the timer so resume does not instantly AbortError.
 */
export function abortAfterForegroundMs(
  controller: AbortController,
  ms: number,
): () => void {
  let remaining = ms;
  let startedAt = Date.now();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timeoutId == null) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  const arm = () => {
    clearTimer();
    if (controller.signal.aborted) return;
    if (AppState.currentState !== 'active') return;
    startedAt = Date.now();
    timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) controller.abort();
    }, Math.max(0, remaining));
  };

  const onChange = (next: AppStateStatus) => {
    if (next !== 'active') {
      if (timeoutId != null) {
        remaining -= Date.now() - startedAt;
        clearTimer();
      }
      return;
    }
    remaining = Math.max(remaining, 4_000);
    arm();
  };

  const sub = AppState.addEventListener('change', onChange);
  arm();

  return () => {
    clearTimer();
    sub.remove();
  };
}
