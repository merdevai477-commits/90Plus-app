/**
 * Parks a share / QR / universal-link URL until the root navigator (and Clerk)
 * are ready. Without this, cold-start opens race `index` → matches/auth and
 * the profile deep link is lost.
 */

type PendingDeepLinkListener = (url: string | null) => void;

let pendingUrl: string | null = null;
let consumedThisLaunch = false;
const listeners = new Set<PendingDeepLinkListener>();

function notify(): void {
  const snapshot = pendingUrl;
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function setPendingDeepLink(url: string): void {
  const trimmed = url?.trim();
  if (!trimmed) return;
  if (/auth-callback/i.test(trimmed)) return;
  pendingUrl = trimmed;
  notify();
}

export function peekPendingDeepLink(): string | null {
  return pendingUrl;
}

export function hasPendingDeepLink(): boolean {
  return pendingUrl != null;
}

/** True after a share/QR deep link was navigated this process lifetime. */
export function wasDeepLinkConsumedThisLaunch(): boolean {
  return consumedThisLaunch;
}

/** Returns and clears the parked URL (if any). */
export function consumePendingDeepLink(): string | null {
  const url = pendingUrl;
  pendingUrl = null;
  if (url) {
    consumedThisLaunch = true;
    notify();
  }
  return url;
}

export function subscribePendingDeepLink(
  listener: PendingDeepLinkListener,
): () => void {
  listeners.add(listener);
  listener(pendingUrl);
  return () => {
    listeners.delete(listener);
  };
}
