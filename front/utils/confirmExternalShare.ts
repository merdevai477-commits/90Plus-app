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

export type ShareHandoffState = 'background' | 'inactive';

const SCHEME_HANDOFF: readonly ShareHandoffState[] = ['background', 'inactive'];
/** Android's share overlay often sets `inactive` without leaving the app. */
const SHEET_HANDOFF: readonly ShareHandoffState[] = ['background'];

function isHandoffState(
  next: string,
  accepted: readonly ShareHandoffState[],
): next is ShareHandoffState {
  return accepted.includes(next as ShareHandoffState);
}

export function confirmExternalShare(
  timeoutMs: number = SHARE_HANDOFF_MS,
  accepted: readonly ShareHandoffState[] = SCHEME_HANDOFF,
): Promise<boolean> {
  if (AppState.currentState === 'background') return Promise.resolve(true);
  if (accepted.includes('inactive') && AppState.currentState === 'inactive') {
    return Promise.resolve(true);
  }

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
      if (isHandoffState(next, accepted)) finish(true);
    });

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

/**
 * Watch whether a destination app opened during an OS share sheet.
 * Android reports `sharedAction` even when the sheet is cancelled; only a
 * real `background` (leaving this app) counts.
 */
export function watchShareHandoff(
  accepted: readonly ShareHandoffState[] = SHEET_HANDOFF,
) {
  let left = AppState.currentState === 'background';
  const sub = AppState.addEventListener('change', (next) => {
    if (isHandoffState(next, accepted)) left = true;
  });
  return {
    didLeave: () => left,
    stop: () => sub.remove(),
  };
}

/** iOS share-sheet copy is not a share. */
export function isCopyShareActivity(activityType: string | null | undefined): boolean {
  if (!activityType) return false;
  return /copy|pasteboard/i.test(activityType);
}
