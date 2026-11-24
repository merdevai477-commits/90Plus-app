/**
 * Pure RN WebView bridge queue used by unit tests and mirrored in
 * public/embed/youtube.html (keep behavior in sync).
 *
 * Purpose: avoid silent message loss when ReactNativeWebView is not ready yet.
 */

export const YOUTUBE_BRIDGE_QUEUE_MAX = 20;
export const YOUTUBE_BRIDGE_RETRY_MS = 50;
export const YOUTUBE_BRIDGE_RETRY_WINDOW_MS = 5_000;

/** One-shot reasons that must not be delivered twice. */
const ONCE_REASONS = new Set([
  'BRIDGE_HELLO',
  'PAGE_SCRIPT_START',
  'PAGE_LOADED',
  'PLAYER_READY',
  'PLAYING',
  'SOURCE_NOT_FOUND',
  'EMBED_UNAVAILABLE',
  'USER_PLAY',
]);

export function isOnceBridgeReason(reason: string): boolean {
  if (ONCE_REASONS.has(reason)) return true;
  if (/^YT_ERROR:\d+$/i.test(reason)) return true;
  return false;
}

export function buildHostedBridgePayload(
  reason: string,
  videoId: string,
  href: string,
): string {
  return `reason:${reason}:${videoId}:${href}`;
}

export type BridgeSendFn = (payload: string) => boolean;

export type HostedBridgeQueue = {
  post: (reason: string) => void;
  flush: () => void;
  /** Test/introspection helpers */
  pendingCount: () => number;
  pendingPayloads: () => string[];
  wasDelivered: (reason: string) => boolean;
  stop: () => void;
};

/**
 * Create a bounded queue that retries delivery for a short window.
 * `now` / `schedule` are injectable for deterministic tests.
 */
export function createHostedBridgeQueue(options: {
  videoId: string;
  getHref: () => string;
  send: BridgeSendFn;
  now?: () => number;
  /** schedule(fn, ms) → cancel handle; return cancel function */
  schedule?: (fn: () => void, ms: number) => () => void;
  maxQueue?: number;
  retryMs?: number;
  retryWindowMs?: number;
}): HostedBridgeQueue {
  const now = options.now ?? (() => Date.now());
  const retryMs = options.retryMs ?? YOUTUBE_BRIDGE_RETRY_MS;
  const retryWindowMs = options.retryWindowMs ?? YOUTUBE_BRIDGE_RETRY_WINDOW_MS;
  const maxQueue = options.maxQueue ?? YOUTUBE_BRIDGE_QUEUE_MAX;

  const queue: string[] = [];
  const queuedOrSent = new Set<string>();
  const delivered = new Set<string>();
  let cancelTimer: (() => void) | null = null;
  let deadline = 0;

  const defaultSchedule = (fn: () => void, ms: number) => {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  };
  const schedule = options.schedule ?? defaultSchedule;

  const stop = () => {
    if (cancelTimer) {
      cancelTimer();
      cancelTimer = null;
    }
  };

  const flush = () => {
    while (queue.length > 0) {
      const payload = queue[0];
      if (!options.send(payload)) return;
      queue.shift();
      const reasonMatch = payload.match(/^reason:([^:]+(?::\d+)?):/);
      if (reasonMatch) delivered.add(reasonMatch[1]);
    }
    stop();
  };

  const ensureTimer = () => {
    if (cancelTimer) return;
    deadline = now() + retryWindowMs;
    cancelTimer = schedule(() => {
      flush();
      if (queue.length === 0) {
        stop();
        return;
      }
      if (now() >= deadline) {
        queue.length = 0;
        stop();
      }
    }, retryMs);
  };

  const post = (reason: string) => {
    if (isOnceBridgeReason(reason) && queuedOrSent.has(reason)) return;

    const payload = buildHostedBridgePayload(reason, options.videoId, options.getHref());

    if (options.send(payload)) {
      if (isOnceBridgeReason(reason)) {
        queuedOrSent.add(reason);
        delivered.add(reason);
      }
      return;
    }

    if (isOnceBridgeReason(reason)) queuedOrSent.add(reason);
    if (queue.length >= maxQueue) queue.shift();
    // Dedupe identical payloads still in queue.
    if (!queue.includes(payload)) queue.push(payload);
    ensureTimer();
  };

  return {
    post,
    flush,
    pendingCount: () => queue.length,
    pendingPayloads: () => [...queue],
    wasDelivered: (reason: string) => delivered.has(reason),
    stop,
  };
}
