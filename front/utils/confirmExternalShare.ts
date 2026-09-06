/**
 * Confirm that a native share actually handed the user to another app.
 *
 * Opening `whatsapp://` (or similar) succeeds even if the sheet is cancelled
 * or the scheme is a no-op. The reliable signal is the app leaving the
 * foreground: if we never background, the share did not go out.
 */

import { AppState } from 'react-native';

/** How long we wait for the OS to background us after openURL. */
export const SHARE_HANDOFF_MS = 2_500;

export function confirmExternalShare(
  timeoutMs: number = SHARE_HANDOFF_MS,
): Promise<boolean> {
  if (AppState.currentState !== 'active') return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.remove();
      resolve(ok);
    };

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') finish(true);
    });

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

/** iOS share-sheet copy is not a share. */
export function isCopyShareActivity(activityType: string | null | undefined): boolean {
  if (!activityType) return false;
  return /copy|pasteboard/i.test(activityType);
}
