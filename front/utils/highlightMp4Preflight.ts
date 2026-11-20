import {
  classifyHttpStatusForDirectSource,
  type PlaybackFailureReason,
} from './highlightPlaybackErrors';

export type Mp4PreflightSuccess = { ok: true; status: number };
export type Mp4PreflightFailure = { ok: false; reason: PlaybackFailureReason; status?: number };
export type Mp4PreflightResult = Mp4PreflightSuccess | Mp4PreflightFailure;

export type Mp4PreflightOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const inflight = new Map<string, Promise<Mp4PreflightResult>>();

/** Test helper — clears the in-flight dedupe map. */
export function clearMp4PreflightCache(): void {
  inflight.clear();
}

/**
 * Lightweight Range probe before mounting DirectClipPlayer.
 * Success means the object is reachable — not that AVPlayer will decode it.
 */
export function preflightDirectMp4(
  url: string,
  options: Mp4PreflightOptions = {},
): Promise<Mp4PreflightResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return Promise.resolve({ ok: false, reason: 'SOURCE_NOT_FOUND' });
  }

  const existing = inflight.get(trimmed);
  if (existing) return existing;

  const promise = runPreflight(trimmed, options).finally(() => {
    inflight.delete(trimmed);
  });
  inflight.set(trimmed, promise);
  return promise;
}

async function runPreflight(
  url: string,
  options: Mp4PreflightOptions,
): Promise<Mp4PreflightResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller &&
    setTimeout(() => {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-1',
        Accept: '*/*',
      },
      redirect: 'follow',
      signal: controller?.signal,
    });

    const status = response.status;
    if (status === 200 || status === 206) {
      return { ok: true, status };
    }

    const reason = classifyHttpStatusForDirectSource(status) ?? 'UNKNOWN_ERROR';
    return { ok: false, reason, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const name = error instanceof Error ? error.name : '';
    if (
      name === 'AbortError' ||
      /aborted|timeout/i.test(message)
    ) {
      return { ok: false, reason: 'PLAYBACK_TIMEOUT' };
    }
    if (/network|offline|failed to fetch|internet/i.test(message)) {
      return { ok: false, reason: 'NETWORK_ERROR' };
    }
    return { ok: false, reason: 'NETWORK_ERROR' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
